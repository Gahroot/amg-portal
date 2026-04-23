"""Scheduled-report CRUD endpoints."""

import contextlib
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, status
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
    require_internal,
    require_rm_or_above,
)
from app.core.exceptions import NotFoundException, ValidationException
from app.models.report_schedule import ReportSchedule
from app.schemas.report_schedule import (
    ReportScheduleCreate,
    ReportScheduleResponse,
    ReportScheduleUpdate,
)

router = APIRouter()

VALID_REPORT_TYPES = {
    "portfolio",
    "program_status",
    "completion",
    "annual_review",
    "partner_performance",
}
VALID_FREQUENCIES = {"daily", "weekly", "monthly", "quarterly"}
VALID_FORMATS = {"pdf", "csv"}


def _calculate_initial_next_run(frequency: str) -> datetime:
    """Calculate the first next_run based on frequency."""
    now = datetime.now(UTC)
    if frequency == "daily":
        # Tomorrow at 06:00 UTC
        tomorrow = now + timedelta(days=1)
        return tomorrow.replace(hour=6, minute=0, second=0, microsecond=0)
    elif frequency == "weekly":
        # Next Monday at 06:00 UTC
        days_ahead = 7 - now.weekday()  # Monday = 0
        if days_ahead <= 0:
            days_ahead += 7
        next_monday = now + timedelta(days=days_ahead)
        return next_monday.replace(hour=6, minute=0, second=0, microsecond=0)
    elif frequency == "monthly":
        # 1st of next month at 06:00 UTC
        if now.month == 12:
            return now.replace(
                year=now.year + 1,
                month=1,
                day=1,
                hour=6,
                minute=0,
                second=0,
                microsecond=0,
            )
        return now.replace(
            month=now.month + 1,
            day=1,
            hour=6,
            minute=0,
            second=0,
            microsecond=0,
        )
    elif frequency == "quarterly":
        # 1st of next quarter at 06:00 UTC
        quarter_start_months = [1, 4, 7, 10]
        current_quarter_idx = (now.month - 1) // 3
        next_quarter_idx = (current_quarter_idx + 1) % 4
        next_quarter_month = quarter_start_months[next_quarter_idx]
        next_year = now.year if next_quarter_idx > 0 else now.year + 1
        return now.replace(
            year=next_year,
            month=next_quarter_month,
            day=1,
            hour=6,
            minute=0,
            second=0,
            microsecond=0,
        )
    # Fallback: tomorrow
    tomorrow = now + timedelta(days=1)
    return tomorrow.replace(hour=6, minute=0, second=0, microsecond=0)


@router.post(
    "/schedules",
    response_model=ReportScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
async def create_report_schedule(
    body: ReportScheduleCreate,
    db: DB,
    current_user: CurrentUser,
) -> ReportSchedule:
    """Create a new report schedule."""
    if body.report_type not in VALID_REPORT_TYPES:
        raise ValidationException(
            f"Invalid report_type. Must be one of: {', '.join(sorted(VALID_REPORT_TYPES))}"
        )
    if body.frequency not in VALID_FREQUENCIES:
        raise ValidationException(
            f"Invalid frequency. Must be one of: {', '.join(sorted(VALID_FREQUENCIES))}"
        )
    if body.format not in VALID_FORMATS:
        raise ValidationException(
            f"Invalid format. Must be one of: {', '.join(sorted(VALID_FORMATS))}"
        )

    schedule = ReportSchedule(
        report_type=body.report_type,
        entity_id=body.entity_id,
        frequency=body.frequency,
        next_run=_calculate_initial_next_run(body.frequency),
        recipients=body.recipients,
        format=body.format,
        created_by=current_user.id,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.get(
    "/schedules",
    response_model=list[ReportScheduleResponse],
    dependencies=[Depends(require_internal)],
)
async def list_report_schedules(
    db: DB,
    current_user: CurrentUser,
) -> list[ReportSchedule]:
    """List all report schedules."""
    result = await db.execute(select(ReportSchedule).order_by(ReportSchedule.created_at.desc()))
    return list(result.scalars().all())


@router.patch(
    "/schedules/{schedule_id}",
    response_model=ReportScheduleResponse,
    dependencies=[Depends(require_internal)],
)
async def update_report_schedule(
    schedule_id: uuid.UUID,
    body: ReportScheduleUpdate,
    db: DB,
    current_user: CurrentUser,
) -> ReportSchedule:
    """Update a report schedule."""
    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise NotFoundException("Schedule not found")

    if body.frequency is not None:
        if body.frequency not in VALID_FREQUENCIES:
            raise ValidationException(
                f"Invalid frequency. Must be one of: {', '.join(sorted(VALID_FREQUENCIES))}"
            )
        schedule.frequency = body.frequency
        schedule.next_run = _calculate_initial_next_run(body.frequency)
    if body.recipients is not None:
        schedule.recipients = body.recipients
    if body.format is not None:
        if body.format not in VALID_FORMATS:
            raise ValidationException(
                f"Invalid format. Must be one of: {', '.join(sorted(VALID_FORMATS))}"
            )
        schedule.format = body.format
    if body.is_active is not None:
        schedule.is_active = body.is_active

    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete(
    "/schedules/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_internal)],
)
async def delete_report_schedule(
    schedule_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> None:
    """Delete a report schedule."""
    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise NotFoundException("Schedule not found")

    await db.delete(schedule)
    await db.commit()


@router.post(
    "/schedules/{schedule_id}/execute",
    response_model=ReportScheduleResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def execute_report_schedule(
    schedule_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> ReportSchedule:
    """Manually trigger execution of a report schedule."""
    from app.services.email_service import send_email_with_attachment
    from app.services.report_generator_service import (
        _generate_attachment_bytes,
        _get_report_data,
        generate_report_for_schedule,
    )

    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise NotFoundException("Schedule not found")

    doc = await generate_report_for_schedule(db, schedule)
    if doc is None:
        raise ValidationException(
            "Could not generate report — no data available for this schedule."
        )

    now = datetime.now(UTC)
    schedule.last_run = now
    schedule.last_generated_document_id = doc.id
    await db.commit()
    await db.refresh(schedule)

    # Email the report to recipients in background (best-effort)
    report_data = await _get_report_data(schedule, db)
    if report_data:
        attachment_bytes = await _generate_attachment_bytes(schedule, report_data)
        ext = schedule.format or "pdf"
        content_type = "application/pdf" if ext == "pdf" else "text/csv"
        subject = f"AMG Portal — Scheduled Report: {schedule.report_type.replace('_', ' ').title()}"
        body_html = (
            "<html><body>"
            "<h2>Scheduled Report</h2>"
            "<p>Please find your scheduled "
            f"{schedule.report_type.replace('_', ' ')} "
            "report attached.</p>"
            "<p>Best regards,<br>AMG Portal</p>"
            "</body></html>"
        )
        recipients: list[str] = schedule.recipients or []
        for recipient in recipients:
            with contextlib.suppress(Exception):
                await send_email_with_attachment(
                    to=recipient,
                    subject=subject,
                    body_html=body_html,
                    attachment=attachment_bytes,
                    attachment_filename=str(doc.file_name),
                    attachment_content_type=content_type,
                )

    return schedule
