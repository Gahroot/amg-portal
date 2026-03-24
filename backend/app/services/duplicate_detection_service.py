"""Service for detecting duplicate client and partner profiles."""

import logging
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from enum import StrEnum
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_profile import ClientProfile
from app.models.partner import PartnerProfile

logger = logging.getLogger(__name__)

# Thresholds
NAME_SIMILARITY_THRESHOLD = 0.75  # SequenceMatcher ratio
FUZZY_SEARCH_LIMIT = 200  # Max candidates to load for fuzzy comparison


class DuplicateEntityType(StrEnum):
    """Type of entity being checked for duplicates."""

    CLIENT = "client"
    PARTNER = "partner"


@dataclass
class DuplicateMatch:
    """A potential duplicate client profile."""

    client_id: UUID
    legal_name: str
    display_name: str | None
    primary_email: str
    phone: str | None
    similarity_score: float
    match_reasons: list[str]


@dataclass
class PartnerDuplicateMatch:
    """A potential duplicate partner profile."""

    partner_id: UUID
    firm_name: str
    contact_name: str
    contact_email: str
    contact_phone: str | None
    similarity_score: float
    match_reasons: list[str]


def _normalize_name(name: str) -> str:
    """Normalise a name for comparison: lowercase, remove accents, strip punctuation."""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower()
    name = re.sub(r"[^a-z0-9\s]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _normalize_email(email: str) -> str:
    return email.lower().strip()


def _normalize_phone(phone: str) -> str:
    """Strip all non-digit characters, drop a leading country code if >10 digits."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) > 10:
        digits = digits[-10:]  # keep last 10 digits (national number)
    return digits


def _name_similarity(a: str, b: str) -> float:
    """Return a 0–1 similarity ratio between two normalised names."""
    na, nb = _normalize_name(a), _normalize_name(b)
    if not na or not nb:
        return 0.0
    # Full-string ratio
    ratio = SequenceMatcher(None, na, nb).ratio()
    # Token-set ratio: sort token bags and compare
    tokens_a = sorted(na.split())
    tokens_b = sorted(nb.split())
    token_ratio = SequenceMatcher(None, " ".join(tokens_a), " ".join(tokens_b)).ratio()
    return max(ratio, token_ratio)


def _compute_match(
    candidate: ClientProfile,
    query_name: str | None,
    query_email: str | None,
    query_phone: str | None,
) -> DuplicateMatch | None:
    """Compute similarity between query fields and a candidate profile.

    Returns a DuplicateMatch if any field exceeds its threshold, else None.
    """
    reasons: list[str] = []
    score = 0.0

    # --- Email check (exact match on normalised email) ---
    if query_email and candidate.primary_email:
        qe = _normalize_email(query_email)
        ce = _normalize_email(candidate.primary_email)
        if qe == ce:
            reasons.append("Exact email match")
            score = max(score, 1.0)
        elif qe.split("@")[0] == ce.split("@")[0]:
            # Same local part, different domain — likely a typo
            reasons.append("Similar email (same local part)")
            score = max(score, 0.85)

    # Secondary email
    if query_email and candidate.secondary_email:
        qe = _normalize_email(query_email)
        se = _normalize_email(candidate.secondary_email)
        if qe == se:
            reasons.append("Matches secondary email")
            score = max(score, 0.95)

    # --- Name check ---
    if query_name:
        name_sim = _name_similarity(query_name, candidate.legal_name)
        if name_sim >= NAME_SIMILARITY_THRESHOLD:
            label = "Exact name match" if name_sim >= 0.99 else "Similar name"
            reasons.append(f"{label} ({int(name_sim * 100)}%)")
            score = max(score, name_sim)

        # Also check display_name if present
        if candidate.display_name:
            dn_sim = _name_similarity(query_name, candidate.display_name)
            if dn_sim >= NAME_SIMILARITY_THRESHOLD:
                label = "Exact display name match" if dn_sim >= 0.99 else "Similar display name"
                reasons.append(f"{label} ({int(dn_sim * 100)}%)")
                score = max(score, dn_sim * 0.9)  # slightly lower weight

    # --- Phone check ---
    if query_phone and candidate.phone:
        qp = _normalize_phone(query_phone)
        cp = _normalize_phone(candidate.phone)
        if qp and cp and len(qp) >= 7 and qp == cp:
            reasons.append("Same phone number")
            score = max(score, 0.9)

    if not reasons:
        return None

    return DuplicateMatch(
        client_id=candidate.id,
        legal_name=candidate.legal_name,
        display_name=candidate.display_name,
        primary_email=candidate.primary_email,
        phone=candidate.phone,
        similarity_score=round(score, 3),
        match_reasons=reasons,
    )


async def check_duplicates(
    db: AsyncSession,
    *,
    legal_name: str | None = None,
    primary_email: str | None = None,
    phone: str | None = None,
    exclude_id: UUID | None = None,
) -> list[DuplicateMatch]:
    """Find existing client profiles that may be duplicates of the supplied fields.

    Performs:
    - Exact + similar-local-part email comparison
    - Fuzzy name matching (SequenceMatcher token-set ratio ≥ 0.75)
    - Normalised phone comparison

    Returns a list of DuplicateMatch objects sorted by descending similarity_score.
    """
    if not any([legal_name, primary_email, phone]):
        return []

    # Build a broad initial filter to reduce the candidate set loaded from DB.
    # We rely on Python-side fuzzy logic for final scoring.
    conditions = []

    if primary_email:
        email_norm = _normalize_email(primary_email)
        conditions.append(ClientProfile.primary_email.ilike(email_norm))
        local_part = email_norm.split("@")[0]
        if local_part:
            conditions.append(ClientProfile.primary_email.ilike(f"{local_part}@%"))
            conditions.append(ClientProfile.secondary_email.ilike(f"{local_part}@%"))

    if legal_name:
        # Grab first word of the name for a broad DB filter
        first_token = _normalize_name(legal_name).split()[0] if legal_name.strip() else ""
        if first_token and len(first_token) >= 3:
            conditions.append(ClientProfile.legal_name.ilike(f"%{first_token}%"))
            conditions.append(ClientProfile.display_name.ilike(f"%{first_token}%"))

    if phone:
        norm_phone = _normalize_phone(phone)
        if norm_phone and len(norm_phone) >= 7:
            # Last 7 digits suffix match
            conditions.append(ClientProfile.phone.ilike(f"%{norm_phone[-7:]}"))

    if not conditions:
        return []

    stmt = select(ClientProfile).where(or_(*conditions)).limit(FUZZY_SEARCH_LIMIT)
    if exclude_id:
        stmt = stmt.where(ClientProfile.id != exclude_id)

    result = await db.execute(stmt)
    candidates = result.scalars().all()

    matches: list[DuplicateMatch] = []
    for candidate in candidates:
        match = _compute_match(candidate, legal_name, primary_email, phone)
        if match:
            matches.append(match)

    # Sort by score descending; cap at top 10
    matches.sort(key=lambda m: m.similarity_score, reverse=True)
    matches = matches[:10]

    if matches:
        logger.info(
            "Duplicate check found %d potential match(es) for name=%r email=%r",
            len(matches),
            legal_name,
            primary_email,
        )

    return matches


def _compute_partner_match(
    candidate: PartnerProfile,
    query_firm_name: str | None,
    query_contact_name: str | None,
    query_email: str | None,
    query_phone: str | None,
) -> PartnerDuplicateMatch | None:
    """Compute similarity between query fields and a candidate partner profile.

    Returns a PartnerDuplicateMatch if any field exceeds its threshold, else None.
    """
    reasons: list[str] = []
    score = 0.0

    # --- Email check (exact match on normalised email) ---
    if query_email and candidate.contact_email:
        qe = _normalize_email(query_email)
        ce = _normalize_email(candidate.contact_email)  # type: ignore[arg-type]
        if qe == ce:
            reasons.append("Exact email match")
            score = max(score, 1.0)
        elif qe.split("@")[0] == ce.split("@")[0]:
            # Same local part, different domain — likely a typo
            reasons.append("Similar email (same local part)")
            score = max(score, 0.85)

    # --- Firm name check ---
    if query_firm_name:
        firm_sim = _name_similarity(query_firm_name, candidate.firm_name)  # type: ignore[arg-type]
        if firm_sim >= NAME_SIMILARITY_THRESHOLD:
            label = "Exact firm name match" if firm_sim >= 0.99 else "Similar firm name"
            reasons.append(f"{label} ({int(firm_sim * 100)}%)")
            score = max(score, firm_sim)

    # --- Contact name check ---
    if query_contact_name:
        contact_sim = _name_similarity(query_contact_name, candidate.contact_name)  # type: ignore[arg-type]
        if contact_sim >= NAME_SIMILARITY_THRESHOLD:
            label = "Exact contact match" if contact_sim >= 0.99 else "Similar contact name"
            reasons.append(f"{label} ({int(contact_sim * 100)}%)")
            score = max(score, contact_sim * 0.95)  # slightly lower weight than firm name

    # --- Phone check ---
    if query_phone and candidate.contact_phone:
        qp = _normalize_phone(query_phone)
        cp = _normalize_phone(candidate.contact_phone)  # type: ignore[arg-type]
        if qp and cp and len(qp) >= 7 and qp == cp:
            reasons.append("Same phone number")
            score = max(score, 0.9)

    if not reasons:
        return None

    return PartnerDuplicateMatch(
        partner_id=candidate.id,  # type: ignore[arg-type]
        firm_name=candidate.firm_name,  # type: ignore[arg-type]
        contact_name=candidate.contact_name,  # type: ignore[arg-type]
        contact_email=candidate.contact_email,  # type: ignore[arg-type]
        contact_phone=candidate.contact_phone,  # type: ignore[arg-type]
        similarity_score=round(score, 3),
        match_reasons=reasons,
    )


async def check_partner_duplicates(  # noqa: PLR0912
    db: AsyncSession,
    *,
    firm_name: str | None = None,
    contact_name: str | None = None,
    contact_email: str | None = None,
    contact_phone: str | None = None,
    exclude_id: UUID | None = None,
) -> list[PartnerDuplicateMatch]:
    """Find existing partner profiles that may be duplicates of the supplied fields.

    Performs:
    - Exact + similar-local-part email comparison
    - Fuzzy firm name matching (SequenceMatcher token-set ratio ≥ 0.75)
    - Fuzzy contact name matching
    - Normalised phone comparison

    Returns a list of PartnerDuplicateMatch objects sorted by descending similarity_score.
    """
    if not any([firm_name, contact_name, contact_email, contact_phone]):
        return []

    # Build a broad initial filter to reduce the candidate set loaded from DB.
    conditions = []

    if contact_email:
        email_norm = _normalize_email(contact_email)
        conditions.append(PartnerProfile.contact_email.ilike(email_norm))
        local_part = email_norm.split("@")[0]
        if local_part:
            conditions.append(PartnerProfile.contact_email.ilike(f"{local_part}@%"))

    if firm_name:
        first_token = _normalize_name(firm_name).split()[0] if firm_name.strip() else ""
        if first_token and len(first_token) >= 3:
            conditions.append(PartnerProfile.firm_name.ilike(f"%{first_token}%"))

    if contact_name:
        first_token = _normalize_name(contact_name).split()[0] if contact_name.strip() else ""
        if first_token and len(first_token) >= 3:
            conditions.append(PartnerProfile.contact_name.ilike(f"%{first_token}%"))

    if contact_phone:
        norm_phone = _normalize_phone(contact_phone)
        if norm_phone and len(norm_phone) >= 7:
            conditions.append(PartnerProfile.contact_phone.ilike(f"%{norm_phone[-7:]}"))

    if not conditions:
        return []

    stmt = select(PartnerProfile).where(or_(*conditions)).limit(FUZZY_SEARCH_LIMIT)
    if exclude_id:
        stmt = stmt.where(PartnerProfile.id != exclude_id)

    result = await db.execute(stmt)
    candidates = result.scalars().all()

    matches: list[PartnerDuplicateMatch] = []
    for candidate in candidates:
        match = _compute_partner_match(
            candidate, firm_name, contact_name, contact_email, contact_phone
        )
        if match:
            matches.append(match)

    # Sort by score descending; cap at top 10
    matches.sort(key=lambda m: m.similarity_score, reverse=True)
    matches = matches[:10]

    if matches:
        logger.info(
            "Partner duplicate check found %d potential match(es) for firm=%r email=%r",
            len(matches),
            firm_name,
            contact_email,
        )

    return matches


# ---------------------------------------------------------------------------
# Duplicate Warning Logging
# ---------------------------------------------------------------------------


async def log_duplicate_warning(
    db: AsyncSession,
    *,
    entity_type: DuplicateEntityType,
    entity_id: UUID | None,
    duplicate_ids: list[UUID],
    action_taken: str,
    user_id: UUID,
    notes: str | None = None,
) -> None:
    """Log a duplicate warning event for auditing purposes.

    Args:
        db: Database session
        entity_type: Type of entity (client or partner)
        entity_id: ID of the entity being created/merged (None if cancelled)
        duplicate_ids: IDs of the matched duplicate entities
        action_taken: One of "proceeded", "merged", "cancelled"
        user_id: ID of the user who triggered the check
        notes: Optional notes about the decision
    """
    logger.info(
        "Duplicate warning: entity_type=%s action=%s user=%s duplicates=%d "
        "entity_id=%s notes=%s",
        entity_type.value,
        action_taken,
        str(user_id),
        len(duplicate_ids),
        str(entity_id) if entity_id else "N/A",
        notes,
    )
