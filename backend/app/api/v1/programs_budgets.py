import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    require_admin,
    require_rm_or_above,
)
from app.core.exceptions import NotFoundException, ValidationException
from app.models.enums import ProgramStatus, UserRole
from app.models.milestone import Milestone
from app.models.program import Program
from app.schemas.program import (
    EmergencyActivationRequest,
    ProgramDetailResponse,
    ProgramResponse,
    ProgramSummary,
    ProgramSummaryMilestone,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/{program_id}/emergency-activate",
    response_model=ProgramDetailResponse,
    dependencies=[Depends(require_admin)],
)
async def emergency_activate_program(
    program_id: uuid.UUID,
    data: EmergencyActivationRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ProgramDetailResponse:
    """Emergency activation: MD bypasses budget approval, activates immediately.

    Guards:
    - Program must be in 'design' status.
    - Program must have at least one milestone.

    Side effects:
    - Sets status to 'active', records emergency_reason and retrospective_due_at.
    - Writes an audit log entry flagged as emergency.
    - Notifies all active managing directors in-portal.
    - Fires the standard design→active side effect (kickoff notification).
    """
    from app.models.audit_log import AuditLog
    from app.models.user import User
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service
    from app.services.program_state_machine import _effect_design_to_active

    from .programs import build_program_detail_response

    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    if str(program.status) != "design":
        raise ValidationException(
            f"Emergency activation requires program to be in 'design' status; "
            f"current status is '{program.status}'."
        )

    milestone_result = await db.execute(
        select(Milestone).where(Milestone.program_id == program.id).limit(1)
    )
    if milestone_result.scalar_one_or_none() is None:
        raise ValidationException("Cannot activate program: it must have at least one milestone.")

    now = datetime.now(UTC)
    retrospective_due = now + timedelta(hours=4)

    from_status = str(program.status)
    program.status = ProgramStatus.active
    program.emergency_reason = data.emergency_reason
    program.retrospective_due_at = retrospective_due

    audit = AuditLog(
        user_id=uuid.UUID(str(current_user.id)),
        user_email=current_user.email,
        action="emergency_activate",
        entity_type="program",
        entity_id=str(program.id),
        before_state={"status": from_status},
        after_state={
            "status": "active",
            "emergency_reason": data.emergency_reason,
            "retrospective_due_at": retrospective_due.isoformat(),
        },
    )
    db.add(audit)
    await db.flush()

    logger.warning(
        "EMERGENCY ACTIVATION: Program %s ('%s') activated by MD %s — "
        "retrospective due by %s. Reason: %s",
        program.id,
        program.title,
        current_user.email,
        retrospective_due.isoformat(),
        data.emergency_reason,
    )

    try:
        md_result = await db.execute(
            select(User).where(
                User.role == UserRole.managing_director.value,
                User.status == "active",
            )
        )
        md_users = list(md_result.scalars().all())
        for md in md_users:
            notif = CreateNotificationRequest(
                user_id=uuid.UUID(str(md.id)),
                notification_type="emergency_activation",
                title=f"Emergency Activation: {program.title}",
                body=(
                    f"MD {current_user.email} has emergency-activated program "
                    f"'{program.title}'. A formal retrospective must be completed "
                    f"by {retrospective_due.strftime('%H:%M UTC on %d %b %Y')}. "
                    f"Reason: {data.emergency_reason}"
                ),
                action_url=f"/programs/{program.id}",
                action_label="View Program",
                entity_type="program",
                entity_id=program.id,
                priority="high",
            )
            await notification_service.create_notification(db, notif)
    except Exception:
        logger.exception(
            "Failed to send emergency activation notifications for program %s",
            program.id,
        )

    await db.commit()

    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one()

    try:
        await _effect_design_to_active(db, program)
    except Exception:
        logger.exception(
            "Failed to fire activation side effect for emergency-activated program %s",
            program.id,
        )

    return build_program_detail_response(program)


@router.post(
    "/{program_id}/brief/share",
    response_model=ProgramResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def share_program_brief(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    """Mark the program brief as visible to the client and record the share timestamp."""
    from .programs import build_program_response

    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")
    program.brief_visible_to_client = True
    program.brief_shared_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(program)
    return build_program_response(program)


@router.get("/{program_id}/summary", response_model=ProgramSummary)
async def get_program_summary(
    program_id: uuid.UUID, db: DB, current_user: CurrentUser, _rls: RLSContext
) -> Any:
    result = await db.execute(
        select(Program).options(selectinload(Program.milestones)).where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    milestones = program.milestones or []
    total = len(milestones)
    completed = sum(1 for m in milestones if m.status == "completed")
    progress = (completed / total * 100) if total > 0 else 0.0

    return ProgramSummary(
        id=program.id,
        title=program.title,
        status=program.status,
        start_date=program.start_date,
        end_date=program.end_date,
        milestone_progress=progress,
        milestones=[
            ProgramSummaryMilestone(title=m.title, status=m.status, due_date=m.due_date)
            for m in milestones
        ],
    )
