import logging

logger = logging.getLogger(__name__)


async def send_welcome_email(email: str, name: str) -> None:
    logger.info(f"[STUB] Welcome email would be sent to {email} for {name}")


async def send_compliance_notification(email: str, profile_name: str, status: str) -> None:
    logger.info(f"[STUB] Compliance notification: {profile_name} is now {status}, notify {email}")
