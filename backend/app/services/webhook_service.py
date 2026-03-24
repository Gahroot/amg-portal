"""Service for webhook operations with HMAC signing and retry logic."""

import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.webhook import Webhook, WebhookDelivery
from app.schemas.webhook import (
    WebhookCreate,
    WebhookTestRequest,
    WebhookUpdate,
)

logger = logging.getLogger(__name__)

# HTTP client timeout
WEBHOOK_TIMEOUT_SECONDS = 30

# Maximum retries for failed webhooks
MAX_RETRIES = 3

# Retry delays in seconds (exponential backoff)
RETRY_DELAYS = [60, 300, 900]  # 1 min, 5 min, 15 min

# Maximum failure count before disabling webhook
MAX_FAILURE_COUNT = 10


class WebhookService:
    """Service for managing and delivering webhooks."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _compute_signature(self, secret: str, payload: str, timestamp: str) -> str:
        """Compute HMAC-SHA256 signature for the payload.

        The signature format is: t=<timestamp>,v1=<signature>
        This follows a similar pattern to Stripe's webhook signatures.
        """
        signed_payload = f"{timestamp}.{payload}"
        signature = hmac.new(
            secret.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return f"t={timestamp},v1={signature}"

    def _build_headers(self, secret: str, payload: str, event_type: str) -> dict[str, str]:
        """Build headers for the webhook request."""
        timestamp = str(int(time.time()))
        signature = self._compute_signature(secret, payload, timestamp)
        app_version = getattr(settings, "APP_VERSION", "1.0")
        return {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": event_type,
            "X-Webhook-Timestamp": timestamp,
            "User-Agent": f"AMG-Portal-Webhook/{app_version}",
        }

    async def create_webhook(
        self,
        partner_id: uuid.UUID,
        data: WebhookCreate,
    ) -> Webhook:
        """Create a new webhook configuration for a partner."""
        webhook = Webhook(
            partner_id=partner_id,
            url=data.url,
            secret=data.secret,
            events=data.events,
            description=data.description,
            is_active=True,
            failure_count=0,
        )
        self.db.add(webhook)
        await self.db.commit()
        await self.db.refresh(webhook)
        logger.info(f"Created webhook {webhook.id} for partner {partner_id}")
        return webhook

    async def get_webhooks_for_partner(
        self,
        partner_id: uuid.UUID,
        include_inactive: bool = False,
    ) -> list[Webhook]:
        """Get all webhooks for a partner."""
        query = select(Webhook).where(Webhook.partner_id == partner_id)
        if not include_inactive:
            query = query.where(Webhook.is_active == True)  # noqa: E712
        query = query.order_by(Webhook.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_webhook(self, webhook_id: uuid.UUID, partner_id: uuid.UUID) -> Webhook | None:
        """Get a specific webhook, ensuring it belongs to the partner."""
        result = await self.db.execute(
            select(Webhook).where(
                Webhook.id == webhook_id,
                Webhook.partner_id == partner_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_webhook(
        self,
        webhook_id: uuid.UUID,
        partner_id: uuid.UUID,
        data: WebhookUpdate,
    ) -> Webhook | None:
        """Update a webhook configuration."""
        webhook = await self.get_webhook(webhook_id, partner_id)
        if not webhook:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(webhook, field, value)

        await self.db.commit()
        await self.db.refresh(webhook)
        logger.info(f"Updated webhook {webhook_id}")
        return webhook

    async def delete_webhook(self, webhook_id: uuid.UUID, partner_id: uuid.UUID) -> bool:
        """Delete a webhook configuration."""
        webhook = await self.get_webhook(webhook_id, partner_id)
        if not webhook:
            return False

        await self.db.delete(webhook)
        await self.db.commit()
        logger.info(f"Deleted webhook {webhook_id}")
        return True

    async def test_webhook(
        self,
        webhook_id: uuid.UUID,
        partner_id: uuid.UUID,
        data: WebhookTestRequest,
    ) -> tuple[bool, int | None, str | None, int | None, str]:
        """Test a webhook by sending a test payload.

        Returns: (success, status_code, error_message, duration_ms, payload)
        """
        webhook = await self.get_webhook(webhook_id, partner_id)
        if not webhook:
            return False, None, "Webhook not found", None, ""

        # Build test payload
        payload = self._build_test_payload(data.event_type, str(webhook.partner_id))
        payload_json = json.dumps(payload)

        # Send the test request
        success, status_code, error_message, duration_ms = await self._send_webhook(
            webhook.url, webhook.secret, data.event_type, payload_json
        )

        # Log the delivery
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type=data.event_type,
            payload=payload_json,
            status_code=status_code,
            error_message=error_message,
            success=success,
            attempt_number=1,
            duration_ms=duration_ms,
        )
        self.db.add(delivery)
        await self.db.commit()

        return success, status_code, error_message, duration_ms, payload_json

    def _build_test_payload(self, event_type: str, partner_id: str) -> dict[str, Any]:
        """Build a test payload for the given event type."""
        now = datetime.now(UTC).isoformat()
        test_id = str(uuid.uuid4())

        data: dict[str, Any] = {
            "test": True,
            "partner_id": partner_id,
        }

        # Add event-specific mock data
        if event_type == "assignment.created":
            data["assignment"] = {
                "id": str(uuid.uuid4()),
                "title": "[TEST] New Assignment",
                "status": "dispatched",
                "created_at": now,
            }
        elif event_type == "assignment.accepted":
            data["assignment"] = {
                "id": str(uuid.uuid4()),
                "title": "[TEST] Accepted Assignment",
                "status": "accepted",
                "accepted_at": now,
            }
        elif event_type == "assignment.completed":
            data["assignment"] = {
                "id": str(uuid.uuid4()),
                "title": "[TEST] Completed Assignment",
                "status": "completed",
                "completed_at": now,
            }
        elif event_type == "deliverable.uploaded":
            data["deliverable"] = {
                "id": str(uuid.uuid4()),
                "title": "[TEST] Deliverable Document",
                "status": "submitted",
                "submitted_at": now,
            }
        elif event_type == "payment.processed":
            data["payment"] = {
                "id": str(uuid.uuid4()),
                "amount": "1000.00",
                "currency": "USD",
                "status": "processed",
                "processed_at": now,
            }

        return {
            "id": test_id,
            "event_type": event_type,
            "timestamp": now,
            "data": data,
        }

    async def _send_webhook(
        self,
        url: str,
        secret: str,
        event_type: str,
        payload: str,
    ) -> tuple[bool, int | None, str | None, int | None]:
        """Send a webhook request.

        Returns: (success, status_code, error_message, duration_ms)
        """
        headers = self._build_headers(secret, payload, event_type)
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT_SECONDS) as client:
                response = await client.post(url, content=payload, headers=headers)
                duration_ms = int((time.time() - start_time) * 1000)

                if 200 <= response.status_code < 300:
                    return True, response.status_code, None, duration_ms
                else:
                    error_msg = f"HTTP {response.status_code}: {response.text[:500]}"
                    return False, response.status_code, error_msg, duration_ms

        except httpx.TimeoutException:
            duration_ms = int((time.time() - start_time) * 1000)
            return False, None, "Request timed out", duration_ms
        except httpx.RequestError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return False, None, str(e), duration_ms
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.exception("Unexpected error sending webhook")
            return False, None, str(e), duration_ms

    async def trigger_webhooks(
        self,
        partner_id: uuid.UUID,
        event_type: str,
        payload: dict[str, Any],
    ) -> list[WebhookDelivery]:
        """Trigger all webhooks subscribed to the given event type.

        This is called by the assignment/deliverable/payment services.
        """
        # Find all active webhooks for this partner that subscribe to this event
        result = await self.db.execute(
            select(Webhook).where(
                Webhook.partner_id == partner_id,
                Webhook.is_active == True,  # noqa: E712
                Webhook.events.contains([event_type]),
            )
        )
        webhooks = list(result.scalars().all())

        if not webhooks:
            logger.debug(f"No webhooks found for partner {partner_id}, event {event_type}")
            return []

        deliveries: list[WebhookDelivery] = []
        payload_json = json.dumps(payload, default=str)

        for webhook in webhooks:
            delivery = await self._deliver_webhook(webhook, event_type, payload_json)
            deliveries.append(delivery)

        return deliveries

    async def _deliver_webhook(
        self,
        webhook: Webhook,
        event_type: str,
        payload: str,
    ) -> WebhookDelivery:
        """Deliver a webhook and log the result."""
        success, status_code, error_message, duration_ms = await self._send_webhook(
            webhook.url, webhook.secret, event_type, payload
        )

        # Create delivery log
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type=event_type,
            payload=payload,
            status_code=status_code,
            response_body=None,
            error_message=error_message,
            success=success,
            attempt_number=1,
            duration_ms=duration_ms,
        )
        self.db.add(delivery)

        # Update webhook stats
        webhook.last_triggered_at = datetime.now(UTC)
        if success:
            webhook.failure_count = 0
        else:
            webhook.failure_count += 1
            if webhook.failure_count >= MAX_FAILURE_COUNT:
                webhook.is_active = False
                logger.warning(
                    f"Disabled webhook {webhook.id} after {webhook.failure_count} failures"
                )

        await self.db.commit()
        await self.db.refresh(delivery)

        if success:
            logger.info(f"Webhook {webhook.id} delivered successfully for event {event_type}")
        else:
            logger.warning(
                f"Webhook {webhook.id} failed for event {event_type}: {error_message}"
            )

        return delivery

    async def get_deliveries(
        self,
        webhook_id: uuid.UUID,
        partner_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[WebhookDelivery], int]:
        """Get delivery logs for a webhook."""
        # Verify ownership
        webhook = await self.get_webhook(webhook_id, partner_id)
        if not webhook:
            return [], 0

        # Get deliveries
        query = (
            select(WebhookDelivery)
            .where(WebhookDelivery.webhook_id == webhook_id)
            .order_by(WebhookDelivery.created_at.desc())
        )
        count_query = (
            select(func.count())
            .select_from(WebhookDelivery)
            .where(WebhookDelivery.webhook_id == webhook_id)
        )

        total = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(query.offset(offset).limit(limit))
        deliveries = list(result.scalars().all())

        return deliveries, total

    async def get_all_deliveries_for_partner(
        self,
        partner_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[WebhookDelivery], int]:
        """Get all delivery logs for a partner's webhooks."""
        # Get webhook IDs for this partner
        webhooks_result = await self.db.execute(
            select(Webhook.id).where(Webhook.partner_id == partner_id)
        )
        webhook_ids = [row[0] for row in webhooks_result.all()]

        if not webhook_ids:
            return [], 0

        # Get deliveries
        query = (
            select(WebhookDelivery)
            .where(WebhookDelivery.webhook_id.in_(webhook_ids))
            .order_by(WebhookDelivery.created_at.desc())
        )
        count_query = (
            select(func.count())
            .select_from(WebhookDelivery)
            .where(WebhookDelivery.webhook_id.in_(webhook_ids))
        )

        total = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(query.offset(offset).limit(limit))
        deliveries = list(result.scalars().all())

        return deliveries, total


# Global function to trigger webhooks from other services
async def trigger_partner_webhooks(
    db: AsyncSession,
    partner_id: uuid.UUID,
    event_type: str,
    data: dict[str, Any],
) -> list[WebhookDelivery]:
    """Trigger webhooks for a partner event.

    This is the public interface for triggering webhooks from other services.
    """
    service = WebhookService(db)

    # Build the full payload
    payload = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "timestamp": datetime.now(UTC).isoformat(),
        "data": data,
    }

    return await service.trigger_webhooks(partner_id, event_type, payload)
