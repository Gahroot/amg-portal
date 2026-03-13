"""Email service for sending notifications and communications.

Sends emails via SMTP using ``aiosmtplib``.  When ``SMTP_HOST`` is not
configured the service degrades gracefully — every public function logs
the email that *would* have been sent and returns without error so that
callers are never disrupted.

For local development you can use `Mailpit <https://mailpit.axllent.org>`_
or `MailHog <https://github.com/mailhog/MailHog>`_ to capture emails::

    SMTP_HOST=localhost SMTP_PORT=1025 SMTP_TLS=false SMTP_STARTTLS=false
"""

import email.encoders
import logging
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

import aiosmtplib
from jinja2 import Environment, FileSystemLoader

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Jinja2 template environment for email templates
# ---------------------------------------------------------------------------

_TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "email"

_env: Environment | None = None


def _get_template_env() -> Environment:
    """Return (and lazily create) the Jinja2 template environment."""
    global _env  # noqa: PLW0603
    if _env is None:
        _env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=True,
        )
    return _env


def render_template(template_name: str, variables: dict[str, Any]) -> str:
    """Render a Jinja2 email template to an HTML string.

    ``template_name`` is relative to ``backend/app/templates/email/``,
    e.g. ``"notification.html"``.
    """
    env = _get_template_env()
    template = env.get_template(template_name)
    return template.render(**variables)


# ---------------------------------------------------------------------------
# Low-level SMTP helpers
# ---------------------------------------------------------------------------

def _smtp_configured() -> bool:
    """Return True when SMTP credentials are present."""
    return bool(settings.SMTP_HOST)


async def _smtp_send(message: MIMEMultipart) -> None:
    """Send a pre-built MIME message via the configured SMTP relay.

    Raises on failure — callers should catch and handle.

    ``aiosmtplib`` distinguishes between:
    * ``use_tls`` — implicit TLS (connect directly over TLS, typically port 465)
    * ``start_tls`` — STARTTLS upgrade (connect plaintext, then upgrade, port 587)

    The ``SMTP_TLS`` setting enables *implicit* TLS (port 465).
    The ``SMTP_STARTTLS`` setting enables the STARTTLS upgrade (port 587).
    For local dev relays (Mailpit / MailHog) set both to ``false``.
    """
    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER or None,
        password=settings.SMTP_PASSWORD or None,
        use_tls=settings.SMTP_TLS and not settings.SMTP_STARTTLS,
        start_tls=settings.SMTP_STARTTLS,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def send_email(
    to: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> bool:
    """Send an email via SMTP.

    Returns ``True`` on success, ``False`` on failure.  Never raises — the
    caller can check the return value but is never disrupted.
    """
    if not _smtp_configured():
        logger.warning(
            "SMTP not configured — skipping email to %s (subject: %s)",
            to,
            subject,
        )
        return False

    message = MIMEMultipart("alternative")
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject

    if body_text:
        message.attach(MIMEText(body_text, "plain", "utf-8"))

    message.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        await _smtp_send(message)
        logger.info("Email sent to %s (subject: %s)", to, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s (subject: %s)", to, subject)
        return False


async def send_email_with_attachment(
    to: str,
    subject: str,
    body_html: str,
    attachment: bytes,
    attachment_filename: str,
    attachment_content_type: str = "application/pdf",
) -> bool:
    """Send an email with a file attachment.

    Returns ``True`` on success, ``False`` on failure.  Never raises.
    """
    if not _smtp_configured():
        logger.warning(
            "SMTP not configured — skipping email with attachment to %s "
            "(subject: %s, file: %s)",
            to,
            subject,
            attachment_filename,
        )
        return False

    message = MIMEMultipart("mixed")
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject

    # HTML body
    message.attach(MIMEText(body_html, "html", "utf-8"))

    # Attachment
    maintype, _, subtype = attachment_content_type.partition("/")
    part = MIMEBase(maintype, subtype or "octet-stream")
    part.set_payload(attachment)
    email.encoders.encode_base64(part)
    part.add_header(
        "Content-Disposition",
        "attachment",
        filename=attachment_filename,
    )
    message.attach(part)

    try:
        await _smtp_send(message)
        logger.info(
            "Email with attachment sent to %s (file: %s)",
            to,
            attachment_filename,
        )
        return True
    except Exception:
        logger.exception(
            "Failed to send email with attachment to %s (file: %s)",
            to,
            attachment_filename,
        )
        return False


# ---------------------------------------------------------------------------
# Higher-level helpers (templated emails)
# ---------------------------------------------------------------------------


async def send_welcome_email(
    email_address: str,
    name: str,
    portal_url: str | None = None,
    temporary_password: str | None = None,
) -> bool:
    """Send welcome email to new client with login credentials."""
    subject = "Welcome to AMG Portal"

    credentials_section = ""
    if temporary_password:
        credentials_section = (
            '<div style="background:#f5f5f0;border:1px solid #ddd;padding:16px;'
            'border-radius:4px;margin:16px 0;">'
            '<p style="margin:0 0 8px 0;font-weight:bold;">Your Login Credentials</p>'
            f'<p style="margin:0;">Email: <strong>{email_address}</strong></p>'
            f'<p style="margin:0;">Temporary Password: <strong>{temporary_password}</strong></p>'
            '<p style="margin:8px 0 0 0;font-size:0.9em;color:#666;">'
            "Please change your password after your first login.</p></div>"
        )

    body_html = render_template("notification.html", {
        "title": "Welcome to AMG Portal",
        "body": (
            f"Dear {name}, welcome to the AMG Portal! "
            "We are delighted to have you as our client. "
            "You can now access your personalized dashboard to track "
            "your programs and communications."
        ),
        "action_url": portal_url,
        "action_label": "Access Portal",
    })

    # Inject credentials section before the closing content block
    if credentials_section:
        body_html = body_html.replace(
            "Best regards,",
            f"{credentials_section}<br>Best regards,",
        )

    return await send_email(to=email_address, subject=subject, body_html=body_html)


async def send_compliance_notification(
    email_address: str,
    profile_name: str,
    status: str,
) -> bool:
    """Send compliance status notification."""
    subject = f"Compliance Status Update: {profile_name}"

    status_text = {
        "cleared": "has been cleared",
        "flagged": "requires attention — has been flagged",
        "rejected": "has been rejected",
    }.get(status, f"is now {status}")

    body_html = render_template("notification.html", {
        "title": "Compliance Status Update",
        "body": f"The profile for {profile_name} {status_text}. "
                "Please review the details in the portal.",
    })

    return await send_email(to=email_address, subject=subject, body_html=body_html)


async def send_notification_email(
    email_address: str,
    title: str,
    body: str,
    action_url: str | None = None,
    action_label: str | None = None,
) -> bool:
    """Send a single notification email using the branded template."""
    subject = f"AMG Portal — {title}"

    body_html = render_template("notification.html", {
        "title": title,
        "body": body,
        "action_url": action_url,
        "action_label": action_label or "View Details",
    })

    return await send_email(to=email_address, subject=subject, body_html=body_html)


async def send_notification_digest(
    email_address: str,
    notifications: list[dict[str, Any]],
    portal_url: str,
) -> bool:
    """Send email digest of notifications.

    Each notification dict may contain: id, notification_type, title, body,
    action_url.  The digest groups by type and renders a rich HTML email.
    """
    subject = f"AMG Portal — Notification Digest ({len(notifications)} new)"

    # Group by type
    grouped: dict[str, list[dict[str, Any]]] = {}
    for notif in notifications:
        notif_type = notif.get("notification_type", "system")
        if notif_type not in grouped:
            grouped[notif_type] = []
        grouped[notif_type].append(notif)

    body_html = render_template("digest.html", {
        "total_count": len(notifications),
        "grouped": grouped,
        "portal_url": portal_url,
    })

    return await send_email(to=email_address, subject=subject, body_html=body_html)


async def send_report_email(
    email_address: str,
    report_type: str,
    attachment_bytes: bytes,
    attachment_filename: str,
    attachment_content_type: str = "application/pdf",
    recipient_count: int = 1,
    portal_url: str | None = None,
) -> bool:
    """Send a scheduled report email with the report file attached."""
    from datetime import UTC, datetime

    report_title = report_type.replace("_", " ").title()
    subject = f"AMG Portal — Scheduled Report: {report_title}"

    fmt = "PDF" if "pdf" in attachment_content_type else "CSV"
    body_html = render_template("report_delivery.html", {
        "report_title": report_title,
        "report_type": report_type,
        "format": fmt,
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"),
        "recipient_count": recipient_count,
        "portal_url": portal_url or settings.FRONTEND_URL,
    })

    return await send_email_with_attachment(
        to=email_address,
        subject=subject,
        body_html=body_html,
        attachment=attachment_bytes,
        attachment_filename=attachment_filename,
        attachment_content_type=attachment_content_type,
    )
