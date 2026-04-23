"""Auto-dispatch: base dispatch helper and program lifecycle hooks."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.communication import Communication
from app.models.communication_template import CommunicationTemplate
from app.models.program import Program
from app.schemas.notification import CreateNotificationRequest
from app.services.notification_service import notification_service
from app.services.template_service import template_service

logger = logging.getLogger(__name__)


async def dispatch_template_message(
    db: AsyncSession,
    template_type: str,
    recipient_user_ids: list[uuid.UUID],
    variables: dict[str, Any],
    program_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    partner_id: uuid.UUID | None = None,
) -> None:
    """Dispatch a template-based message to recipients.

    Looks up the template, renders it, creates a
    Communication record, and notifies each recipient.
    """
    if not recipient_user_ids:
        logger.warning(
            "No recipients for template '%s', skipping",
            template_type,
        )
        return

    # Find active template by type
    result = await db.execute(
        select(CommunicationTemplate)
        .where(
            CommunicationTemplate.template_type == template_type,
            CommunicationTemplate.is_active.is_(True),
        )
        .order_by(
            # Prefer system templates
            CommunicationTemplate.is_system.desc()
        )
        .limit(1)
    )
    template = result.scalar_one_or_none()
    if not template:
        logger.error(
            "No active template found for type '%s'",
            template_type,
        )
        return

    # Render the template
    rendered = await template_service.render_template(db, template.id, variables)
    if not rendered:
        logger.error(
            "Failed to render template '%s'",
            template_type,
        )
        return

    subject = rendered.get("subject", "")
    body = rendered.get("body", "")

    # Build recipients JSON
    recipients_json = {str(uid): {"role": "to"} for uid in recipient_user_ids}

    # Create Communication record
    comm = Communication(
        channel="in_portal",
        status="sent",
        recipients=recipients_json,
        subject=subject,
        body=body,
        client_id=client_id,
        program_id=program_id,
        partner_id=partner_id,
        sent_at=datetime.now(UTC),
    )
    db.add(comm)
    await db.flush()

    # Create in-portal notification for each recipient.
    # create_notification handles the per-type preference gate (never/immediate/daily/weekly)
    # and will send an immediate email if the user's preference calls for it.
    for uid in recipient_user_ids:
        notif_request = CreateNotificationRequest(
            user_id=uid,
            notification_type=template_type,
            title=subject or template.name,
            body=body or "",
            entity_type="communication",
            entity_id=comm.id,
            priority="normal",
        )
        await notification_service.create_notification(db, notif_request)

    await db.commit()
    logger.info(
        "Dispatched '%s' to %d recipient(s)",
        template_type,
        len(recipient_user_ids),
    )


# ---- Program lifecycle hooks ----


async def on_program_created(
    db: AsyncSession,
    program: Program,
) -> None:
    """Send program_kickoff notification when created."""
    # Look up client to get RM
    result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = result.scalar_one_or_none()
    if not client:
        logger.warning(
            "Client not found for program %s",
            program.id,
        )
        return

    start_date = str(program.start_date) if program.start_date else "TBD"

    await dispatch_template_message(
        db,
        template_type="program_kickoff",
        recipient_user_ids=[client.rm_id],
        variables={
            "program_title": program.title,
            "client_name": client.name,
            "start_date": start_date,
        },
        program_id=program.id,
        client_id=program.client_id,
    )


async def on_program_activated(
    db: AsyncSession,
    program: Program,
) -> None:
    """Send program_kickoff notification when a program transitions to active."""
    result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = result.scalar_one_or_none()
    if not client:
        logger.warning(
            "Client not found for program %s — skipping activation notification",
            program.id,
        )
        return

    start_date = str(program.start_date) if program.start_date else "TBD"

    await dispatch_template_message(
        db,
        template_type="program_kickoff",
        recipient_user_ids=[client.rm_id],
        variables={
            "program_title": program.title,
            "client_name": client.name,
            "start_date": start_date,
        },
        program_id=program.id,
        client_id=program.client_id,
    )


async def on_program_completed(
    db: AsyncSession,
    program: Program,
) -> None:
    """Send completion_note when program is completed."""
    result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = result.scalar_one_or_none()
    if not client:
        return

    recipients = [program.created_by, client.rm_id]
    # De-duplicate
    unique_recipients = list(set(recipients))

    await dispatch_template_message(
        db,
        template_type="completion_note",
        recipient_user_ids=unique_recipients,
        variables={
            "program_title": program.title,
            "client_name": client.name,
        },
        program_id=program.id,
        client_id=program.client_id,
    )
