"""Service for generating report files, storing them in MinIO, and creating Document records."""

import io
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.report_schedule import ReportSchedule

logger = logging.getLogger(__name__)


async def _get_report_data(
    schedule: ReportSchedule,
    db: AsyncSession,
) -> dict[str, object] | None:
    """Fetch report data based on schedule type."""
    from app.services.report_service import report_service

    entity_id = uuid.UUID(schedule.entity_id) if schedule.entity_id else None
    if entity_id is None:
        return None

    report_type: str = schedule.report_type
    if report_type == "portfolio":
        return await report_service.get_portfolio_overview(db, entity_id)
    if report_type == "program_status":
        return await report_service.get_program_status_report(db, entity_id)
    if report_type == "completion":
        return await report_service.get_completion_report(db, entity_id)
    if report_type == "annual_review":
        year = datetime.now(UTC).year
        return await report_service.get_annual_review(db, entity_id, year)
    return None


def _generate_attachment_bytes(
    schedule: ReportSchedule,
    report_data: dict[str, object],
) -> bytes:
    """Generate PDF or CSV bytes from report data."""
    import csv

    from app.services.pdf_service import pdf_service

    fmt = schedule.format or "pdf"
    report_type = schedule.report_type

    if fmt == "pdf":
        if report_type == "portfolio":
            return pdf_service.generate_portfolio_pdf(report_data)
        elif report_type == "program_status":
            return pdf_service.generate_program_status_pdf(report_data)
        elif report_type == "completion":
            return pdf_service.generate_completion_pdf(report_data)
        elif report_type == "annual_review":
            return pdf_service.generate_annual_review_pdf(report_data)
        return b""

    # CSV fallback — flatten report data
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Key", "Value"])
    for key, value in report_data.items():
        if not isinstance(value, (list, dict)):
            writer.writerow([key, value])
    return output.getvalue().encode("utf-8")


async def generate_report_for_schedule(
    db: AsyncSession,
    schedule: ReportSchedule,
) -> Document | None:
    """Generate a report file, store in MinIO, and create a Document record.

    Returns the created Document or None if no data was available.
    """
    from app.services.storage import storage_service

    report_data = await _get_report_data(schedule, db)
    if report_data is None:
        logger.warning("No data for schedule %s", schedule.id)
        return None

    attachment_bytes = _generate_attachment_bytes(schedule, report_data)
    if not attachment_bytes:
        logger.warning("Empty attachment for schedule %s", schedule.id)
        return None

    ext = schedule.format or "pdf"
    content_type = "application/pdf" if ext == "pdf" else "text/csv"
    now = datetime.now(UTC)
    filename = f"{schedule.report_type}_{now.strftime('%Y%m%d_%H%M%S')}.{ext}"
    object_name = f"reports/{schedule.id}/{filename}"

    # Upload to MinIO
    storage_service._ensure_bucket()
    storage_service.client.put_object(
        storage_service.bucket,
        object_name,
        io.BytesIO(attachment_bytes),
        len(attachment_bytes),
        content_type=content_type,
    )

    # Create Document record
    doc = Document(
        id=uuid.uuid4(),
        file_path=object_name,
        file_name=filename,
        file_size=len(attachment_bytes),
        content_type=content_type,
        entity_type="report_schedule",
        entity_id=schedule.id,
        category="report",
        description=f"Scheduled {schedule.report_type.replace('_', ' ')} report",
        version=1,
        uploaded_by=schedule.created_by,
    )
    db.add(doc)
    await db.flush()

    logger.info(
        "Generated report document %s for schedule %s (%s bytes)",
        doc.id,
        schedule.id,
        len(attachment_bytes),
    )
    return doc
