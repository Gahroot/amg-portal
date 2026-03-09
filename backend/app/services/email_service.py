"""Email service for sending notifications and communications."""

import logging
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import aiosmtplib
from jinja2 import Template

from app.core.config import settings

logger = logging.getLogger(__name__)


async def render_jinja_template(template_str: str, variables: dict[str, Any]) -> str:
    """Render a Jinja2 template with the given variables."""
    template = Template(template_str)
    return template.render(**variables)


async def send_email(
    to: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> None:
    """Send an email via SMTP.

    Args:
        to: Recipient email address
        subject: Email subject
        body_html: HTML body content
        body_text: Plain text body content (optional)
    """
    if settings.SMTP_HOST is None:
        logger.info(f"[STUB] Email would be sent to {to}: {subject}")
        return

    message = MIMEMultipart("alternative")
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject

    if body_text:
        message.attach(MIMEText(body_text, "plain", "utf-8"))

    message.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_TLS,
        )
        logger.info(f"Email sent successfully to {to}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        raise


async def send_email_with_attachment(
    to: str,
    subject: str,
    body_html: str,
    attachment: bytes,
    attachment_filename: str,
    attachment_content_type: str = "application/pdf",
) -> None:
    """Send an email with a file attachment.

    Args:
        to: Recipient email address
        subject: Email subject
        body_html: HTML body content
        attachment: Raw attachment bytes
        attachment_filename: Filename for the attachment
        attachment_content_type: MIME type of the attachment
    """
    if settings.SMTP_HOST is None:
        logger.info(
            "[STUB] Email with attachment would be sent to %s: %s (file: %s)",
            to,
            subject,
            attachment_filename,
        )
        return

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

    import email.encoders

    email.encoders.encode_base64(part)
    part.add_header(
        "Content-Disposition",
        "attachment",
        filename=attachment_filename,
    )
    message.attach(part)

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_TLS,
        )
        logger.info("Email with attachment sent to %s", to)
    except Exception as e:
        logger.error(
            "Failed to send email with attachment to %s: %s",
            to,
            e,
        )
        raise


async def send_welcome_email(email: str, name: str, portal_url: str | None = None) -> None:
    """Send welcome email to new client."""
    subject = "Welcome to AMG Portal"

    portal_link = f'<p><a href="{portal_url}">Access Portal</a></p>' if portal_url else ""
    body_html = f"""
    <html>
        <body>
            <h2>Welcome to AMG Portal</h2>
            <p>Dear {name},</p>
            <p>Welcome to the AMG Portal! We are delighted to have you as our client.</p>
            <p>You can now access your personalized dashboard to track your programs
            and communications.</p>
            {portal_link}
            <p>Best regards,<br>AMG Team</p>
        </body>
    </html>
    """

    await send_email(to=email, subject=subject, body_html=body_html)


async def send_compliance_notification(
    email: str,
    profile_name: str,
    status: str,
) -> None:
    """Send compliance status notification."""
    subject = f"Compliance Status Update: {profile_name}"

    status_text = {
        "cleared": "has been cleared",
        "flagged": "requires attention - has been flagged",
        "rejected": "has been rejected",
    }.get(status, f"is now {status}")

    body_html = f"""
    <html>
        <body>
            <h2>Compliance Status Update</h2>
            <p>The profile for <strong>{profile_name}</strong> {status_text}.</p>
            <p>Please review the details in the portal.</p>
        </body>
    </html>
    """

    await send_email(to=email, subject=subject, body_html=body_html)


async def send_notification_digest(
    email: str,
    notifications: list[dict[str, Any]],
    portal_url: str,
) -> None:
    """Send email digest of notifications."""
    subject = "AMG Portal - Notification Digest"

    # Group by type
    grouped: dict[str, list[dict[str, Any]]] = {}
    for notif in notifications:
        notif_type = notif.get("notification_type", "system")
        if notif_type not in grouped:
            grouped[notif_type] = []
        grouped[notif_type].append(notif)

    notifications_html = ""
    for notif_type, items in grouped.items():
        notifications_html += f"<h3>{notif_type.replace('_', ' ').title()}</h3>"
        notifications_html += "<ul>"
        for item in items:
            link = f"{portal_url}/notifications/{item['id']}"
            title = item["title"]
            notifications_html += f'<li><a href="{link}">{title}</a></li>'
        notifications_html += "</ul>"

    body_html = f"""
    <html>
        <body>
            <h2>AMG Portal - Notification Digest</h2>
            <p>You have {len(notifications)} new notification(s):</p>
            {notifications_html}
            <p><a href="{portal_url}/notifications">View all notifications in the portal</a></p>
        </body>
    </html>
    """

    await send_email(to=email, subject=subject, body_html=body_html)
