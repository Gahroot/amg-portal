"""PDF report generation using WeasyPrint + Jinja2."""

import io
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

# Template directory
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "reports"


class PDFService:
    def __init__(self) -> None:
        self._env: Environment | None = None

    @property
    def env(self) -> Environment:
        if self._env is None:
            self._env = Environment(
                loader=FileSystemLoader(str(TEMPLATE_DIR)),
                autoescape=True,
            )
        return self._env

    def render_html(self, template_name: str, data: dict[str, Any]) -> str:
        """Render a Jinja2 template to HTML string."""
        template = self.env.get_template(template_name)
        return template.render(**data)

    def render_html_to_pdf(self, html: str) -> bytes:
        """Convert HTML string to PDF bytes using WeasyPrint."""
        from weasyprint import HTML

        return HTML(string=html).write_pdf()  # type: ignore[no-any-return]

    def generate_portfolio_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate portfolio overview PDF."""
        html = self.render_html("portfolio_overview.html", data)
        return self.render_html_to_pdf(html)

    def generate_program_status_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate program status PDF."""
        html = self.render_html("program_status.html", data)
        return self.render_html_to_pdf(html)

    def generate_completion_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate completion report PDF."""
        html = self.render_html("completion_report.html", data)
        return self.render_html_to_pdf(html)

    def generate_annual_review_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate annual review PDF."""
        html = self.render_html("annual_review.html", data)
        return self.render_html_to_pdf(html)

    async def store_report_pdf(
        self,
        pdf_bytes: bytes,
        report_type: str,
        entity_id: str,
    ) -> str:
        """Upload PDF to MinIO and return the object path."""
        from app.services.storage import storage_service

        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        object_name = f"reports/{report_type}/{entity_id}_{timestamp}.pdf"

        file_data = io.BytesIO(pdf_bytes)
        storage_service.client.put_object(
            storage_service.bucket,
            object_name,
            file_data,
            len(pdf_bytes),
            content_type="application/pdf",
        )
        return object_name


pdf_service = PDFService()
