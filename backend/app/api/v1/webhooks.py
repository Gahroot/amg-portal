"""Partner webhook configuration endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import DB, CurrentPartner, CurrentUser, RLSContext
from app.core.exceptions import NotFoundException
from app.schemas.webhook import (
    WEBHOOK_EVENT_DESCRIPTIONS,
    WEBHOOK_EVENT_TYPES,
    WebhookCreate,
    WebhookDeliveryListResponse,
    WebhookDeliveryResponse,
    WebhookListResponse,
    WebhookResponse,
    WebhookTestRequest,
    WebhookTestResponse,
    WebhookUpdate,
)
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/event-types")
async def get_available_event_types() -> dict[str, list[dict[str, str]]]:
    """Get available webhook event types with descriptions."""
    return {
        "event_types": [
            {"type": event_type, "description": WEBHOOK_EVENT_DESCRIPTIONS.get(event_type, "")}
            for event_type in WEBHOOK_EVENT_TYPES
        ]
    }


@router.get("", response_model=WebhookListResponse)
async def list_webhooks(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    include_inactive: bool = Query(False, description="Include inactive webhooks"),
) -> WebhookListResponse:
    """List all webhooks for the current partner."""
    service = WebhookService(db)
    webhooks = await service.get_webhooks_for_partner(
        partner_id=partner.id,
        include_inactive=include_inactive,
    )
    return WebhookListResponse(
        webhooks=[WebhookResponse.from_webhook(w) for w in webhooks],
        total=len(webhooks),
    )


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    data: WebhookCreate,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> WebhookResponse:
    """Create a new webhook configuration."""
    service = WebhookService(db)
    webhook = await service.create_webhook(
        partner_id=partner.id,
        data=data,
    )
    return WebhookResponse.from_webhook(webhook)


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> WebhookResponse:
    """Get a specific webhook configuration."""
    service = WebhookService(db)
    webhook = await service.get_webhook(webhook_id, partner.id)
    if not webhook:
        raise NotFoundException("Webhook not found")
    return WebhookResponse.from_webhook(webhook)


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: UUID,
    data: WebhookUpdate,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> WebhookResponse:
    """Update a webhook configuration."""
    service = WebhookService(db)
    webhook = await service.update_webhook(webhook_id, partner.id, data)
    if not webhook:
        raise NotFoundException("Webhook not found")
    return WebhookResponse.from_webhook(webhook)


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> None:
    """Delete a webhook configuration."""
    service = WebhookService(db)
    deleted = await service.delete_webhook(webhook_id, partner.id)
    if not deleted:
        raise NotFoundException("Webhook not found")


@router.post("/{webhook_id}/test", response_model=WebhookTestResponse)
async def test_webhook(
    webhook_id: UUID,
    data: WebhookTestRequest,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> WebhookTestResponse:
    """Test a webhook by sending a test payload."""
    service = WebhookService(db)
    success, status_code, error_message, duration_ms, payload = await service.test_webhook(
        webhook_id=webhook_id,
        partner_id=partner.id,
        data=data,
    )
    return WebhookTestResponse(
        success=success,
        status_code=status_code,
        error_message=error_message,
        duration_ms=duration_ms,
        payload=payload,
    )


@router.get("/{webhook_id}/deliveries", response_model=WebhookDeliveryListResponse)
async def list_webhook_deliveries(
    webhook_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> WebhookDeliveryListResponse:
    """Get delivery logs for a specific webhook."""
    service = WebhookService(db)
    deliveries, total = await service.get_deliveries(
        webhook_id=webhook_id,
        partner_id=partner.id,
        limit=limit,
        offset=offset,
    )
    return WebhookDeliveryListResponse(
        deliveries=[WebhookDeliveryResponse.model_validate(d) for d in deliveries],
        total=total,
    )


@router.get("/deliveries", response_model=WebhookDeliveryListResponse)
async def list_all_deliveries(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> WebhookDeliveryListResponse:
    """Get all delivery logs for the partner's webhooks."""
    service = WebhookService(db)
    deliveries, total = await service.get_all_deliveries_for_partner(
        partner_id=partner.id,
        limit=limit,
        offset=offset,
    )
    return WebhookDeliveryListResponse(
        deliveries=[WebhookDeliveryResponse.model_validate(d) for d in deliveries],
        total=total,
    )
