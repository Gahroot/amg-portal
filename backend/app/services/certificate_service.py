"""Service for compliance clearance certificate generation and management."""

import logging
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

from jinja2 import BaseLoader, Environment
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clearance_certificate import (
    CertificateTemplate,
    ClearanceCertificate,
    ClearanceCertificateHistory,
)
from app.models.client import Client
from app.models.milestone import Milestone
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.models.user import User
from app.services.pdf_service import pdf_service
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

# Default certificate template
DEFAULT_TEMPLATE = """
<h1>Compliance Clearance Certificate</h1>

<p><strong>Certificate Number:</strong> {{ certificate_number }}</p>
<p><strong>Issue Date:</strong> {{ issue_date }}</p>
{% if expiry_date %}
<p><strong>Valid Until:</strong> {{ expiry_date }}</p>
{% endif %}

<h2>Certificate Details</h2>
<p><strong>Type:</strong> {{ certificate_type | title }}</p>
<p><strong>Title:</strong> {{ title }}</p>

<h2>Client Information</h2>
<p><strong>Client:</strong> {{ client_name }}</p>
{% if client_legal_name %}
<p><strong>Legal Entity:</strong> {{ client_legal_name }}</p>
{% endif %}

{% if program_title %}
<h2>Program Information</h2>
<p><strong>Program:</strong> {{ program_title }}</p>
<p><strong>Status:</strong> {{ program_status | title }}</p>
{% if program_start_date %}
<p><strong>Start Date:</strong> {{ program_start_date }}</p>
{% endif %}
{% if program_end_date %}
<p><strong>End Date:</strong> {{ program_end_date }}</p>
{% endif %}
<p><strong>Milestone Completion:</strong> {{ completed_milestones }} / {{ total_milestones }}</p>
<p><strong>Deliverables Approved:</strong> {{ approved_deliverables }} / {{ total_deliverables }}</p>
{% endif %}

<h2>Declaration</h2>
<p>This certificate confirms that the above-named client{% if program_title %} and program{% endif %} have been reviewed and cleared for compliance purposes as of the issue date.</p>

<p><em>This certificate is issued by Anchor Mill Group and is confidential.</em></p>

<p style="margin-top: 40px;">
<strong>Issued By:</strong> {{ issued_by }}<br>
<strong>Date:</strong> {{ issue_date }}
</p>
"""


# Compliance clearance template for auto-generation
COMPLIANCE_CLEARANCE_TEMPLATE = """
<h1>Compliance Clearance Certificate</h1>

<p><strong>Certificate Number:</strong> {{ certificate_number }}</p>
<p><strong>Issue Date:</strong> {{ issue_date }}</p>

<h2>Client Information</h2>
<p><strong>Client Name:</strong> {{ client_name }}</p>
{% if client_legal_name %}
<p><strong>Legal Entity:</strong> {{ client_legal_name }}</p>
{% endif %}
{% if entity_type %}
<p><strong>Entity Type:</strong> {{ entity_type }}</p>
{% endif %}
{% if jurisdiction %}
<p><strong>Jurisdiction:</strong> {{ jurisdiction }}</p>
{% endif %}

<h2>Clearance Declaration</h2>
<p>This certificate confirms that the above-named client has been reviewed and <strong>cleared</strong> for compliance purposes as of the issue date.</p>

<p>All Know Your Customer (KYC) and Anti-Money Laundering (AML) documentation has been verified and approved.</p>

<h2>Review Details</h2>
<p><strong>Reviewed By:</strong> {{ reviewed_by_name }}</p>
<p><strong>Review Date:</strong> {{ reviewed_at }}</p>
{% if review_notes %}
<p><strong>Notes:</strong> {{ review_notes }}</p>
{% endif %}

<p style="margin-top: 40px;">
<strong>Issued By:</strong> {{ issued_by }}<br>
<strong>Date:</strong> {{ issue_date }}
</p>

<p><em>This certificate is issued by Anchor Mill Group and is confidential.</em></p>
"""


class CertificateService:
    """Service for managing compliance clearance certificates."""

    def __init__(self) -> None:
        self._jinja_env = Environment(loader=BaseLoader(), autoescape=True)

    def _generate_certificate_number(self) -> str:
        """Generate a unique certificate number."""
        timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M")
        unique_id = uuid4().hex[:6].upper()
        return f"AMG-CL-{timestamp}-{unique_id}"

    def _get_template_env(self) -> Environment:
        """Get Jinja2 environment for rendering."""
        return self._jinja_env

    async def get_program_data_for_certificate(
        self, db: AsyncSession, program_id: UUID
    ) -> dict[str, Any]:
        """Extract program data for certificate auto-population."""
        # Get program with client
        result = await db.execute(
            select(Program)
            .options(selectinload(Program.client))
            .where(Program.id == program_id)
        )
        program = result.scalar_one_or_none()
        if not program:
            raise ValueError("Program not found")

        # Get milestones
        milestone_result = await db.execute(
            select(Milestone).where(Milestone.program_id == program_id)
        )
        milestones = milestone_result.scalars().all()
        total_milestones = len(milestones)
        completed_milestones = sum(
            1 for m in milestones if m.status == "completed"
        )

        # Get partner assignments
        assignment_result = await db.execute(
            select(PartnerAssignment)
            .options(selectinload(PartnerAssignment.partner))
            .where(PartnerAssignment.program_id == program_id)
        )
        assignments = assignment_result.scalars().all()
        assigned_partners = [
            {
                "firm_name": a.partner.firm_name if a.partner else "Unknown",
                "service_type": a.service_type,
                "status": a.status,
            }
            for a in assignments
        ]

        # Get deliverable counts (via partner assignments)
        from app.models.deliverable import Deliverable
        deliv_result = await db.execute(
            select(func.count()).select_from(Deliverable)
            .join(PartnerAssignment, Deliverable.assignment_id == PartnerAssignment.id)
            .where(PartnerAssignment.program_id == program_id)
        )
        total_deliverables = deliv_result.scalar() or 0

        approved_result = await db.execute(
            select(func.count()).select_from(Deliverable)
            .join(PartnerAssignment, Deliverable.assignment_id == PartnerAssignment.id)
            .where(
                PartnerAssignment.program_id == program_id,
                Deliverable.status == "approved",
            )
        )
        approved_deliverables = approved_result.scalar() or 0

        # Get client profile for legal name (linked via user_id on Client's RM)
        profile = None

        return {
            "program_id": str(program.id),
            "program_title": program.title,
            "program_status": program.status,
            "client_id": str(program.client_id),
            "client_name": program.client.name if program.client else "Unknown",
            "client_legal_name": profile.legal_name if profile else None,
            "start_date": program.start_date,
            "end_date": program.end_date,
            "objectives": program.objectives,
            "scope": program.scope,
            "budget_envelope": float(program.budget_envelope) if program.budget_envelope else None,
            "total_milestones": total_milestones,
            "completed_milestones": completed_milestones,
            "total_deliverables": total_deliverables,
            "approved_deliverables": approved_deliverables,
            "assigned_partners": assigned_partners,
            "completion_date": program.end_date if program.status == "completed" else None,
        }

    async def get_client_data_for_certificate(
        self, db: AsyncSession, client_id: UUID
    ) -> dict[str, Any]:
        """Extract client data for certificate auto-population."""
        result = await db.execute(
            select(Client).where(Client.id == client_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise ValueError("Client not found")

        # Get client profile
        from app.models.client_profile import ClientProfile
        profile_result = await db.execute(
            select(ClientProfile).where(ClientProfile.client_id == client_id)
        )
        profile = profile_result.scalar_one_or_none()

        # Get program counts
        program_result = await db.execute(
            select(func.count()).select_from(Program).where(
                Program.client_id == client_id
            )
        )
        total_programs = program_result.scalar() or 0

        completed_result = await db.execute(
            select(func.count()).select_from(Program).where(
                Program.client_id == client_id,
                Program.status == "completed"
            )
        )
        completed_programs = completed_result.scalar() or 0

        return {
            "client_id": str(client.id),
            "client_name": client.name,
            "client_legal_name": profile.legal_name if profile else None,
            "entity_type": profile.entity_type if profile else None,
            "jurisdiction": profile.jurisdiction if profile else None,
            "compliance_status": profile.compliance_status if profile else None,
            "total_programs": total_programs,
            "completed_programs": completed_programs,
        }

    def render_certificate_content(
        self,
        template_content: str,
        data: dict[str, Any],
    ) -> str:
        """Render certificate content using template and data."""
        env = self._get_template_env()
        template = env.from_string(template_content)
        return template.render(**data)

    def get_available_placeholders(self, certificate_type: str) -> list[str]:
        """Get list of available placeholders for a certificate type."""
        common = [
            "certificate_number",
            "issue_date",
            "expiry_date",
            "certificate_type",
            "title",
            "client_name",
            "client_legal_name",
            "issued_by",
        ]

        if certificate_type in ("program_completion", "program"):
            return common + [
                "program_title",
                "program_status",
                "program_start_date",
                "program_end_date",
                "total_milestones",
                "completed_milestones",
                "total_deliverables",
                "approved_deliverables",
                "assigned_partners",
            ]

        return common

    async def generate_certificate_pdf(
        self,
        certificate: ClearanceCertificate,
        issued_by_name: str,
    ) -> bytes:
        """Generate PDF for a certificate."""
        # Build data for template
        data = certificate.populated_data or {}
        data.update({
            "certificate_number": certificate.certificate_number,
            "issue_date": certificate.issue_date or datetime.now(UTC).date(),
            "expiry_date": certificate.expiry_date,
            "certificate_type": certificate.certificate_type,
            "title": certificate.title,
            "issued_by": issued_by_name,
            "generated_at": datetime.now(UTC).isoformat(),
        })

        # Render HTML content
        html_content = self.render_certificate_content(
            certificate.content,
            data
        )

        # Wrap with base template styling
        full_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page {{ size: A4; margin: 2cm; }}
        body {{ font-family: 'Georgia', serif; color: #2c2c2c; line-height: 1.6; font-size: 11pt; }}
        h1 {{ color: #8B4513; font-size: 22pt; border-bottom: 2px solid #D2691E; padding-bottom: 8px; }}
        h2 {{ color: #A0522D; font-size: 16pt; margin-top: 20px; }}
        h3 {{ color: #8B4513; font-size: 13pt; }}
        table {{ width: 100%; border-collapse: collapse; margin: 12px 0; }}
        th {{ background-color: #8B4513; color: white; padding: 8px 10px; text-align: left; font-size: 10pt; }}
        td {{ padding: 6px 10px; border-bottom: 1px solid #ddd; font-size: 10pt; }}
        tr:nth-child(even) td {{ background-color: #faf5f0; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .header .logo {{ font-size: 28pt; color: #8B4513; font-weight: bold; letter-spacing: 2px; }}
        .header .subtitle {{ color: #666; font-size: 10pt; }}
        .footer {{ text-align: center; color: #999; font-size: 8pt; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; }}
        .certificate-border {{ border: 3px double #8B4513; padding: 30px; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">AMG</div>
        <div class="subtitle">Anchor Mill Group — Private Client Services</div>
    </div>
    <div class="certificate-border">
        {html_content}
    </div>
    <div class="footer">
        <p>Confidential — Certificate ID: {certificate.certificate_number} — AMG Portal</p>
    </div>
</body>
</html>
"""

        return await pdf_service.render_html_to_pdf(full_html)

    async def store_certificate_pdf(
        self,
        pdf_bytes: bytes,
        certificate_id: UUID,
    ) -> str:
        """Store certificate PDF in MinIO and return path."""
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        object_name = f"certificates/{certificate_id}/{timestamp}.pdf"

        await storage_service.upload_bytes(object_name, pdf_bytes, "application/pdf")
        return object_name

    async def create_certificate(
        self,
        db: AsyncSession,
        data: dict[str, Any],
        user: User,
    ) -> ClearanceCertificate:
        """Create a new clearance certificate."""
        # Generate certificate number
        certificate_number = self._generate_certificate_number()

        # Get template if specified
        template = None
        template_content = DEFAULT_TEMPLATE
        if data.get("template_id"):
            result = await db.execute(
                select(CertificateTemplate).where(
                    CertificateTemplate.id == data["template_id"]
                )
            )
            template = result.scalar_one_or_none()
            if template:
                template_content = template.content

        # Get populated data
        populated_data: dict[str, Any] = {}
        if data.get("program_id"):
            populated_data = await self.get_program_data_for_certificate(
                db, data["program_id"]
            )
        elif data.get("client_id"):
            populated_data = await self.get_client_data_for_certificate(
                db, data["client_id"]
            )

        # Render content
        content = data.get("content")
        if not content:
            render_data = {
                **populated_data,
                "certificate_number": certificate_number,
                "certificate_type": data.get("certificate_type", "general"),
                "title": data.get("title", "Compliance Clearance Certificate"),
                "issue_date": data.get("issue_date") or datetime.now(UTC).date(),
                "expiry_date": data.get("expiry_date"),
                "issued_by": user.full_name,
            }
            content = self.render_certificate_content(template_content, render_data)

        certificate = ClearanceCertificate(
            certificate_number=certificate_number,
            template_id=data.get("template_id"),
            program_id=data.get("program_id"),
            client_id=data["client_id"],
            title=data.get("title", "Compliance Clearance Certificate"),
            content=content,
            populated_data=populated_data,
            certificate_type=data.get("certificate_type", "general"),
            status="draft",
            issue_date=data.get("issue_date"),
            expiry_date=data.get("expiry_date"),
            created_by=user.id,
        )

        db.add(certificate)
        await db.flush()

        # Create history entry
        history = ClearanceCertificateHistory(
            certificate_id=certificate.id,
            action="created",
            to_status="draft",
            actor_id=user.id,
            actor_name=user.full_name,
        )
        db.add(history)
        await db.commit()
        await db.refresh(certificate)

        return certificate

    async def issue_certificate(
        self,
        db: AsyncSession,
        certificate_id: UUID,
        user: User,
        issue_date: date | None = None,
        expiry_date: date | None = None,
        review_notes: str | None = None,
    ) -> ClearanceCertificate:
        """Issue a certificate (finalize and generate PDF)."""
        result = await db.execute(
            select(ClearanceCertificate)
            .options(selectinload(ClearanceCertificate.client))
            .where(ClearanceCertificate.id == certificate_id)
        )
        certificate = result.scalar_one_or_none()
        if not certificate:
            raise ValueError("Certificate not found")

        if certificate.status != "draft":
            raise ValueError("Only draft certificates can be issued")

        # Update certificate
        certificate.status = "issued"
        certificate.issue_date = issue_date or datetime.now(UTC).date()
        certificate.expiry_date = expiry_date
        certificate.reviewed_by = user.id
        certificate.reviewed_at = datetime.now(UTC)
        certificate.review_notes = review_notes

        # Generate and store PDF
        pdf_bytes = await self.generate_certificate_pdf(
            certificate,
            user.full_name,
        )
        pdf_path = await self.store_certificate_pdf(pdf_bytes, certificate.id)
        certificate.pdf_path = pdf_path

        # Create history entry
        history = ClearanceCertificateHistory(
            certificate_id=certificate.id,
            action="issued",
            from_status="draft",
            to_status="issued",
            actor_id=user.id,
            actor_name=user.full_name,
            notes=review_notes,
        )
        db.add(history)
        await db.commit()
        await db.refresh(certificate)

        return certificate

    async def revoke_certificate(
        self,
        db: AsyncSession,
        certificate_id: UUID,
        user: User,
        reason: str,
    ) -> ClearanceCertificate:
        """Revoke an issued certificate."""
        result = await db.execute(
            select(ClearanceCertificate).where(ClearanceCertificate.id == certificate_id)
        )
        certificate = result.scalar_one_or_none()
        if not certificate:
            raise ValueError("Certificate not found")

        if certificate.status != "issued":
            raise ValueError("Only issued certificates can be revoked")

        certificate.status = "revoked"
        certificate.review_notes = reason

        # Create history entry
        history = ClearanceCertificateHistory(
            certificate_id=certificate.id,
            action="revoked",
            from_status="issued",
            to_status="revoked",
            actor_id=user.id,
            actor_name=user.full_name,
            notes=reason,
        )
        db.add(history)
        await db.commit()
        await db.refresh(certificate)

        return certificate

    async def auto_generate_compliance_clearance_certificate(
        self,
        db: AsyncSession,
        client_id: UUID,
        reviewer: User,
        profile_data: dict[str, Any],
    ) -> ClearanceCertificate | None:
        """Auto-generate and immediately issue a compliance clearance certificate.

        This method is called when a compliance officer clears a client profile.
        It creates a certificate, immediately issues it (generates PDF), and
        attaches it to the client record.

        Args:
            db: Database session
            client_id: UUID of the Client record
            reviewer: User who performed the compliance review
            profile_data: Client profile data for certificate population

        Returns:
            The created and issued ClearanceCertificate, or None if client not found
        """
        # Verify client exists
        result = await db.execute(
            select(Client).where(Client.id == client_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            logger.warning(
                "Client %s not found — compliance clearance certificate not generated",
                client_id,
            )
            return None

        # Generate certificate number
        certificate_number = self._generate_certificate_number()
        issue_date = datetime.now(UTC).date()

        # Build render data from profile
        render_data = {
            "certificate_number": certificate_number,
            "client_name": profile_data.get("client_name", client.name),
            "client_legal_name": profile_data.get("client_legal_name"),
            "entity_type": profile_data.get("entity_type"),
            "jurisdiction": profile_data.get("jurisdiction"),
            "reviewed_by_name": profile_data.get("reviewed_by_name", reviewer.full_name),
            "reviewed_at": profile_data.get("reviewed_at", datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")),
            "review_notes": profile_data.get("review_notes"),
            "issue_date": issue_date,
            "issued_by": reviewer.full_name,
        }

        # Render content using the compliance clearance template
        content = self.render_certificate_content(COMPLIANCE_CLEARANCE_TEMPLATE, render_data)

        # Create the certificate directly in "issued" status
        certificate = ClearanceCertificate(
            certificate_number=certificate_number,
            client_id=client_id,
            title="Compliance Clearance Certificate",
            content=content,
            populated_data={
                "client_name": render_data["client_name"],
                "client_legal_name": render_data.get("client_legal_name"),
                "entity_type": render_data.get("entity_type"),
                "jurisdiction": render_data.get("jurisdiction"),
                "reviewed_by_name": render_data["reviewed_by_name"],
                "reviewed_at": render_data["reviewed_at"],
            },
            certificate_type="compliance_clearance",
            status="issued",
            issue_date=issue_date,
            reviewed_by=reviewer.id,
            reviewed_at=datetime.now(UTC),
            created_by=reviewer.id,
        )

        db.add(certificate)
        await db.flush()

        # Generate and store PDF
        pdf_bytes = await self.generate_certificate_pdf(
            certificate,
            reviewer.full_name,
        )
        pdf_path = await self.store_certificate_pdf(pdf_bytes, certificate.id)
        certificate.pdf_path = pdf_path

        # Create history entries
        history_created = ClearanceCertificateHistory(
            certificate_id=certificate.id,
            action="created",
            to_status="issued",
            actor_id=reviewer.id,
            actor_name=reviewer.full_name,
            notes="Auto-generated on compliance clearance",
        )
        history_issued = ClearanceCertificateHistory(
            certificate_id=certificate.id,
            action="issued",
            from_status="draft",
            to_status="issued",
            actor_id=reviewer.id,
            actor_name=reviewer.full_name,
            notes="Auto-issued on compliance clearance",
        )
        db.add(history_created)
        db.add(history_issued)
        await db.commit()
        await db.refresh(certificate)

        logger.info(
            "Auto-generated compliance clearance certificate %s for client %s",
            certificate.certificate_number,
            client_id,
        )

        return certificate


certificate_service = CertificateService()
