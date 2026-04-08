"""PDF report generation using WeasyPrint + Jinja2."""

import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi.concurrency import run_in_threadpool
from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

# Root templates directory — all templates are addressed relative to this path.
TEMPLATE_DIR = Path(__file__).parent.parent / "templates"


class PDFService:
    def __init__(self) -> None:
        self._env: Environment | None = None

    @property
    def env(self) -> Environment:
        if self._env is None:
            # Search both the root templates dir and the reports subdirectory so that:
            # - top-level templates (e.g. brief.html) are found directly
            # - sub-templates that extend "base.html" still resolve it from reports/
            self._env = Environment(
                loader=FileSystemLoader(
                    [str(TEMPLATE_DIR), str(TEMPLATE_DIR / "reports")]
                ),
                autoescape=True,
            )
        return self._env

    def render_html(self, template_name: str, data: dict[str, Any]) -> str:
        """Render a Jinja2 template to HTML string."""
        template = self.env.get_template(template_name)
        return template.render(**data)

    async def render_html_to_pdf(self, html: str) -> bytes:
        """Convert HTML string to PDF bytes using WeasyPrint."""
        from weasyprint import HTML

        return await run_in_threadpool(lambda: HTML(string=html).write_pdf())

    async def generate_portfolio_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate portfolio overview PDF."""
        html = self.render_html("reports/portfolio_overview.html", data)
        return await self.render_html_to_pdf(html)

    async def generate_program_status_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate program status PDF."""
        html = self.render_html("reports/program_status.html", data)
        return await self.render_html_to_pdf(html)

    async def generate_completion_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate completion report PDF."""
        html = self.render_html("reports/completion_report.html", data)
        return await self.render_html_to_pdf(html)

    async def generate_annual_review_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate annual review PDF."""
        html = self.render_html("reports/annual_review.html", data)
        return await self.render_html_to_pdf(html)

    async def generate_brief_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate a partner assignment brief PDF."""
        html = self.render_html("brief.html", data)
        return await self.render_html_to_pdf(html)

    async def generate_custom_report_pdf(self, data: dict[str, Any]) -> bytes:
        """Generate a custom report PDF."""
        html = self.render_html("reports/custom_report.html", data)
        return await self.render_html_to_pdf(html)

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

        await storage_service.upload_bytes(object_name, pdf_bytes, "application/pdf")
        return object_name


pdf_service = PDFService()
