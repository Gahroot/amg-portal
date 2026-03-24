"""Service for compiling and sending message email digests."""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Communication
from app.models.conversation import Conversation
from app.models.message_digest import MessageDigestPreference
from app.models.user import User
from app.schemas.message_digest import DigestMessageSummary

logger = logging.getLogger(__name__)

# Maximum characters to include in body preview
_PREVIEW_LENGTH = 200


async def get_or_create_digest_preference(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> MessageDigestPreference:
    """Get or lazily create a digest preference row for the user."""
    result = await db.execute(
        select(MessageDigestPreference).where(MessageDigestPreference.user_id == user_id)
    )
    pref = result.scalar_one_or_none()
    if pref is None:
        pref = MessageDigestPreference(user_id=user_id, digest_frequency="daily")
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
    return pref


async def update_digest_preference(
    db: AsyncSession,
    user_id: uuid.UUID,
    frequency: str,
) -> MessageDigestPreference:
    """Update the user's message digest frequency."""
    pref = await get_or_create_digest_preference(db, user_id)
    pref.digest_frequency = frequency
    await db.commit()
    await db.refresh(pref)
    return pref


async def compile_digest(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[DigestMessageSummary]:
    """Gather unread messages since the user's last digest was sent.

    Returns a list of DigestMessageSummary objects.
    """
    pref = await get_or_create_digest_preference(db, user_id)
    since = pref.last_digest_sent_at or datetime.now(UTC) - timedelta(days=7)

    return await _get_unread_messages_since(db, user_id, since)


async def _get_unread_messages_since(
    db: AsyncSession,
    user_id: uuid.UUID,
    since: datetime,
) -> list[DigestMessageSummary]:
    """Fetch unread conversation messages for user_id after `since`."""
    # Get all conversations the user participates in
    conv_query = select(Conversation).where(
        Conversation.participant_ids.contains([user_id])
    )
    conv_result = await db.execute(conv_query)
    conversations = {c.id: c for c in conv_result.scalars().all()}

    if not conversations:
        return []

    # Get messages in those conversations after `since`, not sent by the user
    msg_query = (
        select(Communication)
        .where(
            Communication.conversation_id.in_(list(conversations.keys())),
            Communication.created_at > since,
            Communication.sender_id != user_id,
        )
        .order_by(Communication.created_at.desc())
        .limit(100)
    )
    msg_result = await db.execute(msg_query)
    messages = msg_result.scalars().all()

    # Filter to only unread messages (user_id not in read_receipts)
    unread: list[Communication] = []
    uid_str = str(user_id)
    for msg in messages:
        receipts = msg.read_receipts or {}
        if uid_str not in receipts:
            unread.append(msg)

    if not unread:
        return []

    # Resolve sender names
    sender_ids = {m.sender_id for m in unread if m.sender_id}
    sender_map: dict[uuid.UUID, str] = {}
    if sender_ids:
        sender_result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(list(sender_ids)))
        )
        for row in sender_result.all():
            sender_map[row.id] = row.full_name

    summaries: list[DigestMessageSummary] = []
    for msg in unread:
        conv = conversations.get(msg.conversation_id)  # type: ignore[arg-type]
        preview = msg.body[:_PREVIEW_LENGTH] + ("…" if len(msg.body) > _PREVIEW_LENGTH else "")
        summaries.append(
            DigestMessageSummary(
                message_id=str(msg.id),
                conversation_id=str(msg.conversation_id),
                conversation_title=conv.title if conv else None,
                sender_name=sender_map.get(msg.sender_id) if msg.sender_id else None,
                body_preview=preview,
                sent_at=msg.created_at,
            )
        )

    return summaries


async def send_digest(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> bool:
    """Compile and send the message digest email for a user.

    Returns True if an email was sent, False if there was nothing to send.
    """
    from app.services.email_service import send_email

    summaries = await compile_digest(db, user_id)
    if not summaries:
        return False

    # Look up user email
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.email:
        logger.warning("Cannot send digest — user %s not found or missing email", user_id)
        return False

    # Build email HTML
    subject = f"AMG Portal — {len(summaries)} unread message(s)"
    messages_html = ""
    for s in summaries:
        conv_label = s.conversation_title or "Conversation"
        sender_label = s.sender_name or "Unknown"
        messages_html += (
            f"<tr>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #eee;'>"
            f"<strong>{sender_label}</strong> in <em>{conv_label}</em><br>"
            f"<span style='color:#555;'>{s.body_preview}</span><br>"
            f"<small style='color:#999;'>{s.sent_at:%Y-%m-%d %H:%M UTC}</small>"
            f"</td></tr>"
        )

    body_html = f"""
    <html>
    <body>
        <h2>Message Digest</h2>
        <p>You have <strong>{len(summaries)}</strong> unread message(s):</p>
        <table style="width:100%;border-collapse:collapse;">{messages_html}</table>
        <p style="margin-top:16px;">
            <a href="#">Open AMG Portal</a> to view and reply.
        </p>
        <p>Best regards,<br>AMG Team</p>
    </body>
    </html>
    """

    try:
        await send_email(to=user.email, subject=subject, body_html=body_html)
    except Exception:
        logger.exception("Failed to send message digest to %s", user.email)
        return False

    # Update last_digest_sent_at
    pref = await get_or_create_digest_preference(db, user_id)
    pref.last_digest_sent_at = datetime.now(UTC)
    await db.commit()

    logger.info("Message digest sent to %s with %d messages", user.email, len(summaries))
    return True


async def process_all_digests(
    db: AsyncSession,
    frequency: str,
) -> int:
    """Process message digests for all users with the given frequency.

    Returns the number of digests sent.
    """
    result = await db.execute(
        select(MessageDigestPreference.user_id).where(
            MessageDigestPreference.digest_frequency == frequency
        )
    )
    user_ids = list(result.scalars().all())

    sent = 0
    for uid in user_ids:
        try:
            if await send_digest(db, uid):
                sent += 1
        except Exception:
            logger.exception("Error processing message digest for user %s", uid)

    logger.info(
        "Message digest batch (%s) complete — %d/%d users had content",
        frequency,
        sent,
        len(user_ids),
    )
    return sent
