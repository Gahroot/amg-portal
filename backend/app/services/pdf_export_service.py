"""PDF export service for generating professional PDF exports of reports and data tables."""

import logging
from datetime import UTC, datetime
from typing import Any

from jinja2 import Environment, FileSystemLoader

from app.services.pdf_service import TEMPLATE_DIR

logger = logging.getLogger(__name__)


class PDFExportOptions:
    """Options for PDF export configuration."""

    def __init__(
        self,
        orientation: str = "portrait",
        include_header: bool = True,
        include_footer: bool = True,
        include_timestamp: bool = True,
        include_filters: bool = False,
        page_size: str = "A4",
        company_name: str = "AMG",
        company_subtitle: str = "Anchor Mill Group — Private Client Services",
    ):
        self.orientation = orientation
        self.include_header = include_header
        self.include_footer = include_footer
        self.include_timestamp = include_timestamp
        self.include_filters = include_filters
        self.page_size = page_size
        self.company_name = company_name
        self.company_subtitle = company_subtitle


class PDFExportService:
    """Service for generating professional PDF exports of data and reports."""

    def __init__(self) -> None:
        self._env: Environment | None = None

    @property
    def env(self) -> Environment:
        if self._env is None:
            self._env = Environment(
                loader=FileSystemLoader(
                    [str(TEMPLATE_DIR), str(TEMPLATE_DIR / "exports")]
                ),
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

    def _build_export_data(
        self,
        title: str,
        headers: list[str],
        rows: list[list[Any]],
        options: PDFExportOptions,
        filters: dict[str, Any] | None = None,
        summary: dict[str, Any] | None = None,
        user_name: str | None = None,
    ) -> dict[str, Any]:
        """Build data dictionary for template rendering."""
        generated_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
        return {
            "title": title,
            "headers": headers,
            "rows": rows,
            "row_count": len(rows),
            "generated_at": generated_at,
            "generated_by": user_name,
            "orientation": options.orientation,
            "include_header": options.include_header,
            "include_footer": options.include_footer,
            "include_timestamp": options.include_timestamp,
            "include_filters": options.include_filters,
            "filters": filters,
            "summary": summary,
            "company_name": options.company_name,
            "company_subtitle": options.company_subtitle,
            "page_size": options.page_size,
        }

    def generate_table_pdf(
        self,
        title: str,
        headers: list[str],
        rows: list[list[Any]],
        options: PDFExportOptions | None = None,
        filters: dict[str, Any] | None = None,
        summary: dict[str, Any] | None = None,
        user_name: str | None = None,
    ) -> bytes:
        """Generate a PDF from tabular data."""
        if options is None:
            options = PDFExportOptions()

        data = self._build_export_data(
            title=title,
            headers=headers,
            rows=rows,
            options=options,
            filters=filters,
            summary=summary,
            user_name=user_name,
        )

        html = self.render_html("data_table.html", data)
        return self.render_html_to_pdf(html)

    def generate_program_summary_pdf(
        self,
        program_data: dict[str, Any],
        options: PDFExportOptions | None = None,
        user_name: str | None = None,
    ) -> bytes:
        """Generate a program summary PDF."""
        if options is None:
            options = PDFExportOptions()

        program_data.setdefault("generated_at", datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"))
        program_data.setdefault("generated_by", user_name)
        program_data.setdefault("company_name", options.company_name)
        program_data.setdefault("company_subtitle", options.company_subtitle)

        html = self.render_html("program_summary.html", program_data)
        return self.render_html_to_pdf(html)

    def generate_client_profile_pdf(
        self,
        client_data: dict[str, Any],
        options: PDFExportOptions | None = None,
        user_name: str | None = None,
    ) -> bytes:
        """Generate a client profile PDF."""
        if options is None:
            options = PDFExportOptions()

        client_data.setdefault("generated_at", datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"))
        client_data.setdefault("generated_by", user_name)
        client_data.setdefault("company_name", options.company_name)
        client_data.setdefault("company_subtitle", options.company_subtitle)

        html = self.render_html("client_profile.html", client_data)
        return self.render_html_to_pdf(html)

    def generate_financial_report_pdf(
        self,
        financial_data: dict[str, Any],
        options: PDFExportOptions | None = None,
        user_name: str | None = None,
    ) -> bytes:
        """Generate a financial report PDF."""
        if options is None:
            options = PDFExportOptions(orientation="landscape")

        financial_data.setdefault("generated_at", datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"))
        financial_data.setdefault("generated_by", user_name)
        financial_data.setdefault("company_name", options.company_name)
        financial_data.setdefault("company_subtitle", options.company_subtitle)

        html = self.render_html("financial_report.html", financial_data)
        return self.render_html_to_pdf(html)

    def generate_custom_report_pdf(
        self,
        report_data: dict[str, Any],
        template_name: str = "custom_report.html",
        options: PDFExportOptions | None = None,
        user_name: str | None = None,
    ) -> bytes:
        """Generate a custom report PDF using specified template."""
        if options is None:
            options = PDFExportOptions()

        report_data.setdefault("generated_at", datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"))
        report_data.setdefault("generated_by", user_name)
        report_data.setdefault("company_name", options.company_name)
        report_data.setdefault("company_subtitle", options.company_subtitle)

        html = self.render_html(template_name, report_data)
        return self.render_html_to_pdf(html)


# Singleton instance
pdf_export_service = PDFExportService()
