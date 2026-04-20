"""Public API webhook endpoints for external integrations."""

import hashlib
import hmac
import json
import logging
import secrets
import time
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.db.session import get_db
from app.models.api_key import APIKey
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.public_api import (
    PUBLIC_API_EVENT_DESCRIPTIONS,
    PUBLIC_API_EVENT_TYPES,
    APIInfoResponse,
    CreateTaskRequest,
    CreateTaskResponse,
    PublicWebhookCreate,
    PublicWebhookListResponse,
    PublicWebhookResponse,
    UpdateStatusRequest,
    UpdateStatusResponse,
    ZapierPollResponse,
    ZapierTestResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# HTTP client timeout
WEBHOOK_TIMEOUT_SECONDS = 30


# ============ API Key Authentication ============


async def get_api_key_user(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate API key and return the associated user."""
    # Extract key prefix for quick lookup
    key_prefix = x_api_key[:12] if len(x_api_key) >= 12 else x_api_key

    # Find API key by prefix
    result = await db.execute(
        select(APIKey).where(
            APIKey.key_prefix == key_prefix,
            APIKey.is_active == True,  # noqa: E712
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise UnauthorizedException("Invalid API key")

    # Verify the full key
    if not api_key.verify_key(x_api_key):
        raise UnauthorizedException("Invalid API key")

    # Get the user
    user_result = await db.execute(select(User).where(User.id == api_key.user_id))
    user = user_result.scalar_one_or_none()

    if not user or user.status != "active":
        raise UnauthorizedException("User not found or inactive")

    # Record usage
    api_key.record_usage()
    await db.commit()

    return user


# Type alias for dependency
APIUser = Depends(get_api_key_user)


# ============ Webhook Subscription Model ============


class PublicWebhook:
    """Simple webhook subscription storage.

    In production, this would be a proper database model.
    For now, we use in-memory storage with optional Redis backup.
    """

    _webhooks: dict[uuid.UUID, dict[str, Any]] = {}

    @classmethod
    def create(
        cls,
        user_id: uuid.UUID,
        url: str,
        events: list[str],
        description: str | None = None,
    ) -> dict[str, Any]:
        """Create a new webhook subscription."""
        webhook_id = uuid.uuid4()
        secret = secrets.token_urlsafe(32)
        now = datetime.now(UTC)

        webhook = {
            "id": webhook_id,
            "user_id": user_id,
            "url": url,
            "secret": secret,
            "events": events,
            "description": description,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        cls._webhooks[webhook_id] = webhook
        return webhook

    @classmethod
    def get(cls, webhook_id: uuid.UUID, user_id: uuid.UUID) -> dict[str, Any] | None:
        """Get a webhook by ID and user."""
        webhook = cls._webhooks.get(webhook_id)
        if webhook and webhook["user_id"] == user_id:
            return webhook
        return None

    @classmethod
    def list_for_user(cls, user_id: uuid.UUID) -> list[dict[str, Any]]:
        """List all webhooks for a user."""
        return [w for w in cls._webhooks.values() if w["user_id"] == user_id]

    @classmethod
    def delete(cls, webhook_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete a webhook."""
        webhook = cls.get(webhook_id, user_id)
        if webhook:
            del cls._webhooks[webhook_id]
            return True
        return False


# ============ API Info ============


@router.get("", response_model=APIInfoResponse)
async def get_api_info() -> APIInfoResponse:
    """Get public API information and available event types."""
    return APIInfoResponse(
        event_types=[
            {"type": event_type, "description": PUBLIC_API_EVENT_DESCRIPTIONS.get(event_type, "")}
            for event_type in PUBLIC_API_EVENT_TYPES
        ]
    )


@router.get("/event-types")
async def list_event_types() -> dict[str, list[dict[str, str]]]:
    """List all available event types for webhooks."""
    return {
        "event_types": [
            {"type": event_type, "description": PUBLIC_API_EVENT_DESCRIPTIONS.get(event_type, "")}
            for event_type in PUBLIC_API_EVENT_TYPES
        ]
    }


# ============ Webhook Subscriptions ============


@router.post("/webhooks", response_model=PublicWebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    data: PublicWebhookCreate,
    user: User = APIUser,
) -> PublicWebhookResponse:
    """Create a new webhook subscription.

    The returned secret should be stored securely - it's used to verify webhook signatures.
    """
    # Validate events
    invalid = [e for e in data.events if e not in PUBLIC_API_EVENT_TYPES]
    if invalid:
        raise BadRequestException(f"Invalid event types: {invalid}")

    webhook = PublicWebhook.create(
        user_id=user.id,
        url=data.url,
        events=data.events,
        description=data.description,
    )

    logger.info(f"Created webhook {webhook['id']} for user {user.id}")

    return PublicWebhookResponse(**webhook)


@router.get("/webhooks", response_model=PublicWebhookListResponse)
async def list_webhooks(
    user: User = APIUser,
) -> PublicWebhookListResponse:
    """List all webhook subscriptions for the authenticated user."""
    webhooks = PublicWebhook.list_for_user(user.id)
    return PublicWebhookListResponse(
        webhooks=[PublicWebhookResponse(**w) for w in webhooks],
        total=len(webhooks),
    )


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: uuid.UUID,
    user: User = APIUser,
) -> None:
    """Delete a webhook subscription."""
    deleted = PublicWebhook.delete(webhook_id, user.id)
    if not deleted:
        raise NotFoundException("Webhook not found")
    logger.info(f"Deleted webhook {webhook_id}")


# ============ Zapier/Make Test Endpoint ============


@router.post("/test", response_model=ZapierTestResponse)
async def test_connection(user: User = APIUser) -> ZapierTestResponse:
    """Test API connection and return user info.

    This endpoint is used by Zapier and Make to verify API credentials.
    """
    return ZapierTestResponse(
        success=True,
        user={
            "id": str(user.id),
            "name": user.full_name,
            "email": user.email,
            "role": user.role,
        },
        message="Connection successful",
    )


# ============ Polling Endpoints for Zapier ============


@router.get("/poll/tasks", response_model=ZapierPollResponse)
async def poll_tasks(
    user: User = APIUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
) -> ZapierPollResponse:
    """Poll for new/updated tasks.

    Used by Zapier as a polling trigger when webhooks aren't available.
    """
    from app.models.client import Client
    from app.models.milestone import Milestone
    from app.models.program import Program
    from app.models.task import Task

    # Build query based on user role
    query = select(Task).join(Milestone).join(Program).join(Client)

    # Filter by user's accessible programs
    if user.role in [UserRole.relationship_manager, UserRole.coordinator]:
        query = query.where(Client.rm_id == user.id)
    elif user.role == UserRole.partner:
        # Partners can see tasks from their assignments
        from app.models.partner_assignment import PartnerAssignment

        query = query.join(
            PartnerAssignment,
            PartnerAssignment.program_id == Program.id,
        ).where(PartnerAssignment.partner_id == user.id)

    # Use cursor for pagination
    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(Task.updated_at > cursor_dt)
        except ValueError:
            pass

    query = query.order_by(Task.updated_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    tasks = list(result.scalars().all())

    has_more = len(tasks) > limit
    if has_more:
        tasks = tasks[:limit]

    results = [
        {
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        }
        for task in tasks
    ]

    next_cursor = None
    if has_more and tasks:
        next_cursor = tasks[-1].updated_at.isoformat() if tasks[-1].updated_at else None

    return ZapierPollResponse(results=results, has_more=has_more, next_cursor=next_cursor)


@router.get("/poll/assignments", response_model=ZapierPollResponse)
async def poll_assignments(
    user: User = APIUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
) -> ZapierPollResponse:
    """Poll for new/updated assignments.

    Used by Zapier as a polling trigger when webhooks aren't available.
    """
    from app.models.client import Client
    from app.models.partner_assignment import PartnerAssignment
    from app.models.program import Program

    query = select(PartnerAssignment).join(Program).join(Client)

    # Filter by user role
    if user.role == UserRole.partner:
        query = query.where(PartnerAssignment.partner_id == user.id)
    elif user.role in [UserRole.relationship_manager, UserRole.coordinator]:
        query = query.where(Client.rm_id == user.id)

    # Use cursor for pagination
    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(PartnerAssignment.updated_at > cursor_dt)
        except ValueError:
            pass

    query = query.order_by(PartnerAssignment.updated_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    assignments = list(result.scalars().all())

    has_more = len(assignments) > limit
    if has_more:
        assignments = assignments[:limit]

    results = [
        {
            "id": str(a.id),
            "title": a.title,
            "status": a.status,
            "program_id": str(a.program_id),
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "created_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in assignments
    ]

    next_cursor = None
    if has_more and assignments:
        next_cursor = assignments[-1].updated_at.isoformat() if assignments[-1].updated_at else None

    return ZapierPollResponse(results=results, has_more=has_more, next_cursor=next_cursor)


# ============ Action Endpoints ============


@router.post("/tasks", response_model=CreateTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: CreateTaskRequest,
    user: User = APIUser,
    db: AsyncSession = Depends(get_db),
) -> CreateTaskResponse:
    """Create a new task via the public API.

    This is used by Zapier/Make actions to create tasks.
    """
    from app.models.enums import TaskPriority, TaskStatus
    from app.models.milestone import Milestone
    from app.models.program import Program
    from app.models.task import Task

    # Validate milestone if provided
    milestone_id = data.milestone_id
    if milestone_id:
        result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
        milestone = result.scalar_one_or_none()
        if not milestone:
            raise NotFoundException("Milestone not found")
    # If program_id provided but no milestone, create/find a default milestone
    elif data.program_id:
        program_result = await db.execute(select(Program).where(Program.id == data.program_id))
        program = program_result.scalar_one_or_none()
        if not program:
            raise NotFoundException("Program not found")

        # Find or create "Integrations" milestone
        result = await db.execute(
            select(Milestone).where(
                Milestone.program_id == data.program_id,
                Milestone.title == "Integrations",
            )
        )
        milestone = result.scalar_one_or_none()
        if not milestone:
            milestone = Milestone(
                program_id=data.program_id,
                title="Integrations",
                description="Tasks created via integrations (Zapier, Make, etc.)",
                status="in_progress",
            )
            db.add(milestone)
            await db.flush()
        milestone_id = milestone.id
    else:
        raise BadRequestException("Either milestone_id or program_id is required")

    # Parse due date
    due_date = None
    if data.due_date:
        try:
            due_date = datetime.fromisoformat(data.due_date).date()
        except ValueError:
            raise BadRequestException(
                "Invalid due_date format. Use ISO format (YYYY-MM-DD)"
            ) from None

    # Create task
    task = Task(
        milestone_id=milestone_id,
        title=data.title,
        description=data.description,
        status=TaskStatus.todo,
        priority=TaskPriority(data.priority),
        due_date=due_date,
        assigned_to=data.assigned_to_id,
    )

    db.add(task)
    await db.commit()
    await db.refresh(task)

    logger.info(f"Created task {task.id} via public API by user {user.id}")

    return CreateTaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date.isoformat() if task.due_date else None,
        program_id=data.program_id,
        milestone_id=milestone_id,
        assigned_to_id=task.assigned_to,
        created_at=task.created_at,
    )


@router.patch("/tasks/{task_id}/status", response_model=UpdateStatusResponse)
async def update_task_status(
    task_id: uuid.UUID,
    data: UpdateStatusRequest,
    user: User = APIUser,
    db: AsyncSession = Depends(get_db),
) -> UpdateStatusResponse:
    """Update a task's status.

    This is used by Zapier/Make actions to update task status.
    """
    from app.models.enums import TaskStatus
    from app.models.task import Task

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise NotFoundException("Task not found")

    try:
        task.status = TaskStatus(data.status)
    except ValueError:
        raise BadRequestException(
            f"Invalid status. Valid values: {[s.value for s in TaskStatus]}"
        ) from None

    await db.commit()
    await db.refresh(task)

    logger.info(f"Updated task {task.id} status to {task.status} via public API")

    return UpdateStatusResponse(
        id=task.id,
        status=task.status,
        updated_at=task.updated_at,
    )


@router.patch("/assignments/{assignment_id}/status", response_model=UpdateStatusResponse)
async def update_assignment_status(
    assignment_id: uuid.UUID,
    data: UpdateStatusRequest,
    user: User = APIUser,
    db: AsyncSession = Depends(get_db),
) -> UpdateStatusResponse:
    """Update an assignment's status.

    This is used by Zapier/Make actions to update assignment status.
    """
    from app.models.enums import AssignmentStatus
    from app.models.partner_assignment import PartnerAssignment

    result = await db.execute(
        select(PartnerAssignment).where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise NotFoundException("Assignment not found")

    # Verify user has access (is the assigned partner)
    if user.role == UserRole.partner and assignment.partner_id != user.id:
        raise ForbiddenException("You don't have access to this assignment")

    try:
        assignment.status = AssignmentStatus(data.status)
    except ValueError:
        raise BadRequestException(
            f"Invalid status. Valid values: {[s.value for s in AssignmentStatus]}"
        ) from None

    await db.commit()
    await db.refresh(assignment)

    logger.info(f"Updated assignment {assignment.id} status to {assignment.status} via public API")

    return UpdateStatusResponse(
        id=assignment.id,
        status=assignment.status,
        updated_at=assignment.updated_at,
    )


# ============ Inbound Webhook Receiver ============


@router.post("/inbound/{webhook_token}")
async def receive_inbound_webhook(
    webhook_token: str,
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Receive an inbound webhook from external services.

    This allows external services to trigger actions in the portal.
    The webhook_token is a unique identifier for the webhook configuration.
    """
    # In production, this would look up the webhook configuration by token
    # and validate the payload against expected schema

    logger.info(f"Received inbound webhook with token {webhook_token[:8]}...")

    # Process the webhook payload
    # This would typically:
    # 1. Validate the webhook token
    # 2. Parse the payload
    # 3. Trigger appropriate actions (create task, update status, etc.)

    return {"status": "received", "message": "Webhook processed successfully"}


# ============ Webhook Delivery ============


async def send_webhook(
    url: str,
    secret: str,
    event_type: str,
    payload: dict[str, Any],
) -> tuple[bool, int | None, str | None]:
    """Send a webhook notification.

    Returns: (success, status_code, error_message)
    """
    timestamp = str(int(time.time()))
    payload_json = json.dumps(payload, default=str)

    # Compute signature
    signed_payload = f"{timestamp}.{payload_json}"
    signature = hmac.new(
        secret.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    signature_header = f"t={timestamp},v1={signature}"

    headers = {
        "Content-Type": "application/json",
        "X-AMG-Signature": signature_header,
        "X-AMG-Event": event_type,
        "User-Agent": "AMG-Portal-Webhook/1.0",
    }

    # User-supplied URL — safe_request runs SSRF + DNS-rebinding checks via
    # the shared external client (follow_redirects=False).
    from app.core.http_client import UnsafeURLError, safe_request

    try:
        response = await safe_request(
            "POST",
            url,
            content=payload_json,
            headers=headers,
            timeout=WEBHOOK_TIMEOUT_SECONDS,
        )

        if 200 <= response.status_code < 300:
            return True, response.status_code, None
        else:
            return False, response.status_code, f"HTTP {response.status_code}"

    except UnsafeURLError as e:
        return False, None, f"Unsafe webhook URL: {e}"
    except httpx.TimeoutException:
        return False, None, "Request timed out"
    except Exception as e:
        return False, None, str(e)


async def trigger_public_webhooks(
    db: AsyncSession,
    event_type: str,
    data: dict[str, Any],
    actor: User | None = None,
) -> list[dict[str, Any]]:
    """Trigger webhooks for an event.

    This is called by other services when events occur.
    """
    webhooks = PublicWebhook.list_for_user(actor.id) if actor else []
    results = []

    payload = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "timestamp": datetime.now(UTC).isoformat(),
        "data": data,
        "actor": {
            "id": str(actor.id),
            "name": actor.full_name,
            "email": actor.email,
            "role": actor.role,
        }
        if actor
        else None,
    }

    for webhook in webhooks:
        if event_type in webhook["events"]:
            success, status_code, error = await send_webhook(
                webhook["url"],
                webhook["secret"],
                event_type,
                payload,
            )
            results.append(
                {
                    "webhook_id": str(webhook["id"]),
                    "success": success,
                    "status_code": status_code,
                    "error": error,
                }
            )

    return results
