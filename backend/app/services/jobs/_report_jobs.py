"""Report-related background jobs."""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import TypedDict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.middleware.audit import with_system_audit_context
from app.models.program import Program
from app.models.report_schedule import ReportSchedule
from app.services.auto_dispatch_service import dispatch_template_message
from app.services.email_service import send_email_with_attachment
from app.services.report_generator_service import (
    _generate_attachment_bytes,
    _get_report_data,
    generate_report_for_schedule,
)

logger = logging.getLogger(__name__)


class _MilestoneSnapshot(TypedDict):
    status: str
    due_date: date | None
    title: str


class _ProgramSnapshot(TypedDict):
    id: UUID
    title: str
    created_by: UUID
    milestones: list[_MilestoneSnapshot]


def _calculate_next_run(
    frequency: str,
    from_time: datetime,
) -> datetime:
    """Calculate the next run time based on frequency."""

    if frequency == "daily":
        return from_time + timedelta(days=1)
    elif frequency == "weekly":
        return from_time + timedelta(days=7)
    elif frequency == "monthly":
        return from_time + timedelta(days=30)
    return from_time + timedelta(days=1)


@with_system_audit_context
async def _send_weekly_status_reports_job() -> None:
    """Friday job: send weekly status reports for active programs."""
    logger.info("Running weekly status reports job")

    # Plain-Python snapshots of each program's data — extracted while the session
    # is still open so we never touch detached ORM-managed attributes afterward.
    snapshots: list[_ProgramSnapshot] = []

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Program)
                .options(selectinload(Program.milestones))
                .where(Program.status.notin_(["completed", "cancelled"]))
            )
            programs = result.scalars().all()

            # Extract all data we need while the session is open.
            for program in programs:
                milestones_data: list[_MilestoneSnapshot] = [
                    _MilestoneSnapshot(
                        status=str(m.status),
                        due_date=m.due_date,
                        title=str(m.title),
                    )
                    for m in (program.milestones or [])
                ]
                snapshots.append(
                    _ProgramSnapshot(
                        id=UUID(str(program.id)),
                        title=str(program.title),
                        created_by=UUID(str(program.created_by)),
                        milestones=milestones_data,
                    )
                )

        for snapshot in snapshots:
            try:
                async with AsyncSessionLocal() as db:
                    milestones = snapshot["milestones"]
                    total = len(milestones)
                    completed = sum(1 for m in milestones if m["status"] == "completed")
                    progress = f"{completed}/{total}" if total > 0 else "0/0"

                    # Compute RAG status
                    today = datetime.now(UTC).date()
                    rag = "green"
                    for m in milestones:
                        if (
                            m["status"] != "completed"
                            and m["due_date"] is not None
                            and m["due_date"] < today
                        ):
                            rag = "red"
                            break
                    if rag != "red":
                        for m in milestones:
                            if (
                                m["status"] != "completed"
                                and m["due_date"] is not None
                                and m["due_date"] <= today + timedelta(days=7)
                            ):
                                rag = "amber"
                                break

                    active = [
                        m for m in milestones if m["status"] not in ("completed", "cancelled")
                    ]
                    active_text = "\n".join(
                        f"- {m['title']} (due: {m['due_date']})" for m in active
                    )
                    if not active_text:
                        active_text = "No active milestones"

                    await dispatch_template_message(
                        db,
                        template_type="weekly_status",
                        recipient_user_ids=[snapshot["created_by"]],
                        variables={
                            "program_title": snapshot["title"],
                            "rag_status": rag,
                            "milestone_progress": progress,
                            "active_milestones": active_text,
                        },
                        program_id=snapshot["id"],
                    )
            except Exception:
                logger.exception(
                    "Error sending weekly status for program %s",
                    snapshot["id"],
                )

        logger.info(
            "Weekly status reports complete — %d programs processed",
            len(snapshots),
        )
    except Exception:
        logger.exception("Error in weekly status reports job")


@with_system_audit_context
async def _process_report_schedules_job() -> None:
    """Daily job: process scheduled reports, store in MinIO, and email them."""
    logger.info("Running report schedules job")
    try:
        async with AsyncSessionLocal() as db:
            now = datetime.now(UTC)
            result = await db.execute(
                select(ReportSchedule).where(
                    ReportSchedule.is_active.is_(True),
                    ReportSchedule.next_run <= now,
                )
            )
            schedules = result.scalars().all()

        logger.info(
            "Found %d report schedules to process",
            len(schedules),
        )

        for schedule in schedules:
            try:
                async with AsyncSessionLocal() as db:
                    now = datetime.now(UTC)
                    # Re-fetch schedule within this session
                    sched_result = await db.execute(
                        select(ReportSchedule).where(ReportSchedule.id == schedule.id)
                    )
                    sched = sched_result.scalar_one()

                    doc = await generate_report_for_schedule(db, sched)
                    if doc is None:
                        continue

                    # Read the attachment bytes for emailing
                    report_data = await _get_report_data(sched, db)
                    attachment_bytes = (
                        await _generate_attachment_bytes(sched, report_data) if report_data else b""
                    )

                    ext = sched.format or "pdf"
                    content_type = "application/pdf" if ext == "pdf" else "text/csv"
                    filename = str(doc.file_name)

                    # Update schedule fields
                    sched.last_run = now
                    sched.next_run = _calculate_next_run(sched.frequency, now)
                    sched.last_generated_document_id = doc.id
                    await db.commit()

                # Email the attachment to recipients
                subject = (
                    f"AMG Portal — Scheduled Report: "
                    f"{schedule.report_type.replace('_', ' ').title()}"
                )
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
                    try:
                        await send_email_with_attachment(
                            to=recipient,
                            subject=subject,
                            body_html=body_html,
                            attachment=attachment_bytes,
                            attachment_filename=filename,
                            attachment_content_type=content_type,
                        )
                    except Exception:
                        logger.exception(
                            "Error sending report email to %s for schedule %s",
                            recipient,
                            schedule.id,
                        )

            except Exception:
                logger.exception(
                    "Error processing schedule %s",
                    schedule.id,
                )

        logger.info(
            "Report schedules job complete — %d schedules processed",
            len(schedules),
        )
    except Exception:
        logger.exception("Error in report schedules job")
