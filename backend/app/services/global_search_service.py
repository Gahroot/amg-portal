"""Global search service for unified search across all entities."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.document import Document
from app.models.milestone import Milestone
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.models.task import Task


class SearchEntityType(StrEnum):
    """Entity types available for search."""

    program = "program"
    client = "client"
    partner = "partner"
    document = "document"
    task = "task"


@dataclass
class SearchOperator:
    """Parsed search operator from query string."""

    operator: str  # "exact", "exclude", "type"
    value: str
    raw: str  # Original operator string (e.g., "type:client")


@dataclass
class ParsedQuery:
    """Parsed search query with operators extracted."""

    terms: list[str]  # Search terms
    operators: list[SearchOperator]
    original: str
    # Extracted filters
    entity_types: list[SearchEntityType] = field(default_factory=list)
    exact_match: bool = False
    excluded_terms: list[str] = field(default_factory=list)


@dataclass
class SearchResult:
    """A single search result with relevance scoring."""

    id: str
    type: SearchEntityType
    title: str
    subtitle: str | None
    url: str
    metadata: dict[str, Any]
    relevance_score: float = 0.0
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class GroupedSearchResults:
    """Search results grouped by entity type."""

    query: str
    groups: dict[str, list[SearchResult]]
    total: int
    total_by_type: dict[str, int]
    has_more: dict[str, bool]


class QueryParser:
    """Parse search queries with support for operators."""

    # Operator patterns
    EXACT_PATTERN = re.compile(r'"([^"]+)"')
    EXCLUDE_PATTERN = re.compile(r"-(\S+)")
    TYPE_PATTERN = re.compile(r"type:(\S+)", re.IGNORECASE)

    @classmethod
    def parse(cls, query: str) -> ParsedQuery:
        """Parse a search query into terms and operators."""
        original = query
        operators: list[SearchOperator] = []
        entity_types: list[SearchEntityType] = []
        excluded_terms: list[str] = []
        exact_match = False

        # Extract exact match phrases
        exact_matches = cls.EXACT_PATTERN.findall(query)
        if exact_matches:
            exact_match = True
            for match in exact_matches:
                operators.append(SearchOperator("exact", match, f'"{match}"'))
            query = cls.EXACT_PATTERN.sub("", query)

        # Extract type filters
        type_matches = cls.TYPE_PATTERN.findall(query)
        for type_match in type_matches:
            try:
                entity_type = SearchEntityType(type_match.lower())
                entity_types.append(entity_type)
                operators.append(
                    SearchOperator("type", type_match, f"type:{type_match}")
                )
            except ValueError:
                pass  # Invalid type, ignore
        query = cls.TYPE_PATTERN.sub("", query)

        # Extract excluded terms
        exclude_matches = cls.EXCLUDE_PATTERN.findall(query)
        for excluded in exclude_matches:
            excluded_terms.append(excluded)
            operators.append(SearchOperator("exclude", excluded, f"-{excluded}"))
        query = cls.EXCLUDE_PATTERN.sub("", query)

        # Remaining terms
        terms = [t.strip().lower() for t in query.split() if t.strip()]

        return ParsedQuery(
            terms=terms,
            operators=operators,
            original=original,
            entity_types=entity_types,
            exact_match=exact_match,
            excluded_terms=excluded_terms,
        )


class RelevanceScorer:
    """Calculate relevance scores for search results."""

    @staticmethod
    def score(
        result: SearchResult,
        search_terms: list[str],
        exact_match: bool = False,
    ) -> float:
        """Calculate relevance score for a result.

        Scoring factors:
        - Title match (higher weight)
        - Subtitle match (medium weight)
        - Exact phrase match (bonus)
        - Recency bonus
        - Status boost (active > inactive)
        """
        score = 0.0
        title_lower = result.title.lower()
        subtitle_lower = (result.subtitle or "").lower()

        for term in search_terms:
            # Title exact match
            if exact_match and term == title_lower:
                score += 100.0
            elif term in title_lower:
                # Bonus for word boundary match
                if re.search(rf"\b{re.escape(term)}\b", title_lower):
                    score += 50.0
                else:
                    score += 30.0

            # Subtitle match
            if term in subtitle_lower:
                if re.search(rf"\b{re.escape(term)}\b", subtitle_lower):
                    score += 20.0
                else:
                    score += 10.0

        # Recency bonus (results updated in last 7 days)
        if result.updated_at:
            days_since_update = (datetime.now(result.updated_at.tzinfo) - result.updated_at).days
            if days_since_update < 7:
                score += 10.0 * (7 - days_since_update) / 7

        # Status boost for active items
        status = result.metadata.get("status", "")
        if status in ("active", "in_progress", "accepted"):
            score += 5.0

        return score


class GlobalSearchService:
    """Service for performing global search across entities."""

    # Limits per entity type
    DEFAULT_LIMIT = 20
    PER_TYPE_LIMIT = 10
    MAX_RESULTS_PER_TYPE = 50

    def __init__(self, db: AsyncSession):
        self.db = db
        self.scorer = RelevanceScorer()

    async def search(
        self,
        query: str,
        entity_types: list[SearchEntityType] | None = None,
        limit: int = DEFAULT_LIMIT,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        statuses: list[str] | None = None,
        priorities: list[str] | None = None,
        assigned_to: UUID | None = None,
        program_id: UUID | None = None,
        client_id: UUID | None = None,
    ) -> GroupedSearchResults:
        """Perform global search across all entity types.

        Args:
            query: Search query string (supports operators)
            entity_types: Filter by specific entity types (None = all)
            limit: Maximum results per type
            date_from: Filter results created after this date
            date_to: Filter results created before this date
            statuses: Filter by entity status values
            priorities: Filter by task priority values
            assigned_to: Filter by assigned user ID
            program_id: Filter by program ID
            client_id: Filter by client ID

        Returns:
            GroupedSearchResults with results organized by type
        """
        parsed = QueryParser.parse(query)

        # Determine which types to search
        types_to_search = (
            parsed.entity_types
            if parsed.entity_types
            else (entity_types or list(SearchEntityType))
        )

        all_results: list[SearchResult] = []
        per_type_limit = min(limit, self.PER_TYPE_LIMIT)

        # Search each entity type
        if SearchEntityType.program in types_to_search:
            program_results = await self._search_programs(
                parsed, per_type_limit, date_from, date_to, statuses, client_id
            )
            all_results.extend(program_results)

        if SearchEntityType.client in types_to_search:
            client_results = await self._search_clients(
                parsed, per_type_limit, date_from, date_to, statuses
            )
            all_results.extend(client_results)

        if SearchEntityType.partner in types_to_search:
            partner_results = await self._search_partners(
                parsed, per_type_limit, date_from, date_to, statuses
            )
            all_results.extend(partner_results)

        if SearchEntityType.document in types_to_search:
            document_results = await self._search_documents(
                parsed, per_type_limit, date_from, date_to, program_id
            )
            all_results.extend(document_results)

        if SearchEntityType.task in types_to_search:
            task_results = await self._search_tasks(
                parsed,
                per_type_limit,
                date_from,
                date_to,
                statuses,
                priorities,
                assigned_to,
                program_id,
            )
            all_results.extend(task_results)

        # Calculate relevance scores
        for result in all_results:
            result.relevance_score = self.scorer.score(
                result, parsed.terms, parsed.exact_match
            )

        # Group results by type
        groups: dict[str, list[SearchResult]] = {}
        total_by_type: dict[str, int] = {}
        has_more: dict[str, bool] = {}

        for result in all_results:
            type_key = result.type.value
            if type_key not in groups:
                groups[type_key] = []
            groups[type_key].append(result)

        # Sort each group by relevance and calculate totals
        for type_key, results in groups.items():
            results.sort(key=lambda r: r.relevance_score, reverse=True)
            total_by_type[type_key] = len(results)
            has_more[type_key] = len(results) > per_type_limit
            groups[type_key] = results[:per_type_limit]

        return GroupedSearchResults(
            query=query,
            groups=groups,
            total=sum(len(r) for r in groups.values()),
            total_by_type=total_by_type,
            has_more=has_more,
        )

    async def _search_programs(
        self,
        parsed: ParsedQuery,
        limit: int,
        date_from: datetime | None,
        date_to: datetime | None,
        statuses: list[str] | None = None,
        client_id: UUID | None = None,
    ) -> list[SearchResult]:
        """Search programs."""
        results: list[SearchResult] = []

        if not parsed.terms:
            return results

        # Build search conditions
        conditions = []
        for term in parsed.terms:
            if parsed.exact_match:
                conditions.append(func.lower(Program.title) == term)
            else:
                conditions.append(
                    or_(
                        func.lower(Program.title).like(f"%{term}%"),
                        func.lower(Program.status).like(f"%{term}%"),
                        func.lower(Program.objectives).like(f"%{term}%"),
                    )
                )

        # Exclude terms
        for excluded in parsed.excluded_terms:
            conditions.append(
                func.lower(Program.title).not_like(f"%{excluded}%")
            )

        # Status filter
        if statuses:
            conditions.append(func.lower(Program.status).in_(statuses))

        # Client filter
        if client_id:
            conditions.append(Program.client_id == client_id)

        stmt = (
            select(Program)
            .where(*conditions)
            .order_by(Program.updated_at.desc().nullslast())
            .limit(limit)
        )

        # Date filtering
        if date_from:
            stmt = stmt.where(Program.created_at >= date_from)
        if date_to:
            stmt = stmt.where(Program.created_at <= date_to)

        rows = await self.db.execute(stmt)
        for p in rows.scalars().all():
            results.append(
                SearchResult(
                    id=str(p.id),
                    type=SearchEntityType.program,
                    title=p.title,
                    subtitle=f"Status: {p.status}",
                    url=f"/programs/{p.id}",
                    metadata={
                        "status": str(p.status),
                        "client_id": str(p.client_id),
                        "start_date": str(p.start_date) if p.start_date else None,
                        "end_date": str(p.end_date) if p.end_date else None,
                    },
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
            )

        return results

    async def _search_clients(
        self,
        parsed: ParsedQuery,
        limit: int,
        date_from: datetime | None,
        date_to: datetime | None,
        statuses: list[str] | None = None,
    ) -> list[SearchResult]:
        """Search clients."""
        results: list[SearchResult] = []

        if not parsed.terms:
            return results

        conditions = []
        for term in parsed.terms:
            if parsed.exact_match:
                conditions.append(func.lower(Client.name) == term)
            else:
                conditions.append(
                    or_(
                        func.lower(Client.name).like(f"%{term}%"),
                        func.lower(Client.client_type).like(f"%{term}%"),
                        func.lower(Client.notes).like(f"%{term}%"),
                    )
                )

        for excluded in parsed.excluded_terms:
            conditions.append(func.lower(Client.name).not_like(f"%{excluded}%"))

        # Status filter
        if statuses:
            conditions.append(func.lower(Client.status).in_(statuses))

        stmt = (
            select(Client)
            .where(*conditions)
            .order_by(Client.updated_at.desc().nullslast())
            .limit(limit)
        )

        if date_from:
            stmt = stmt.where(Client.created_at >= date_from)
        if date_to:
            stmt = stmt.where(Client.created_at <= date_to)

        rows = await self.db.execute(stmt)
        for c in rows.scalars().all():
            results.append(
                SearchResult(
                    id=str(c.id),
                    type=SearchEntityType.client,
                    title=c.name,
                    subtitle=f"Type: {c.client_type}",
                    url=f"/clients/{c.id}",
                    metadata={
                        "status": str(c.status),
                        "client_type": str(c.client_type),
                    },
                    created_at=c.created_at,
                    updated_at=c.updated_at,
                )
            )

        return results

    async def _search_partners(
        self,
        parsed: ParsedQuery,
        limit: int,
        date_from: datetime | None,
        date_to: datetime | None,
        statuses: list[str] | None = None,
    ) -> list[SearchResult]:
        """Search partners."""
        results: list[SearchResult] = []

        if not parsed.terms:
            return results

        conditions = []
        for term in parsed.terms:
            if parsed.exact_match:
                conditions.append(
                    or_(
                        func.lower(PartnerProfile.firm_name) == term,
                        func.lower(PartnerProfile.contact_name) == term,
                    )
                )
            else:
                conditions.append(
                    or_(
                        func.lower(PartnerProfile.firm_name).like(f"%{term}%"),
                        func.lower(PartnerProfile.contact_name).like(f"%{term}%"),
                        func.lower(PartnerProfile.contact_email).like(f"%{term}%"),
                        func.lower(PartnerProfile.notes).like(f"%{term}%"),
                    )
                )

        for excluded in parsed.excluded_terms:
            conditions.append(
                or_(
                    func.lower(PartnerProfile.firm_name).not_like(f"%{excluded}%"),
                    func.lower(PartnerProfile.contact_name).not_like(f"%{excluded}%"),
                )
            )

        # Status filter
        if statuses:
            conditions.append(func.lower(PartnerProfile.status).in_(statuses))

        stmt = (
            select(PartnerProfile)
            .where(*conditions)
            .order_by(PartnerProfile.updated_at.desc().nullslast())
            .limit(limit)
        )

        if date_from:
            stmt = stmt.where(PartnerProfile.created_at >= date_from)
        if date_to:
            stmt = stmt.where(PartnerProfile.created_at <= date_to)

        rows = await self.db.execute(stmt)
        for p in rows.scalars().all():
            results.append(
                SearchResult(
                    id=str(p.id),
                    type=SearchEntityType.partner,
                    title=str(p.firm_name),
                    subtitle=str(p.contact_name),
                    url=f"/partners/{p.id}",
                    metadata={
                        "status": str(p.status),
                        "contact_email": str(p.contact_email),
                    },
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
            )

        return results

    async def _search_documents(
        self,
        parsed: ParsedQuery,
        limit: int,
        date_from: datetime | None,
        date_to: datetime | None,
        program_id: UUID | None = None,
    ) -> list[SearchResult]:
        """Search documents."""
        results: list[SearchResult] = []

        if not parsed.terms:
            return results

        conditions = []
        for term in parsed.terms:
            if parsed.exact_match:
                conditions.append(func.lower(Document.file_name) == term)
            else:
                conditions.append(
                    or_(
                        func.lower(Document.file_name).like(f"%{term}%"),
                        func.lower(Document.description).like(f"%{term}%"),
                        func.lower(Document.category).like(f"%{term}%"),
                    )
                )

        for excluded in parsed.excluded_terms:
            conditions.append(func.lower(Document.file_name).not_like(f"%{excluded}%"))

        # Program filter - documents linked to a specific program
        if program_id:
            conditions.append(Document.entity_id == program_id)

        stmt = (
            select(Document)
            .where(*conditions)
            .order_by(Document.updated_at.desc().nullslast())
            .limit(limit)
        )

        if date_from:
            stmt = stmt.where(Document.created_at >= date_from)
        if date_to:
            stmt = stmt.where(Document.created_at <= date_to)

        rows = await self.db.execute(stmt)
        for d in rows.scalars().all():
            results.append(
                SearchResult(
                    id=str(d.id),
                    type=SearchEntityType.document,
                    title=str(d.file_name),
                    subtitle=f"Category: {d.category}",
                    url=f"/documents/{d.id}",
                    metadata={
                        "entity_type": str(d.entity_type),
                        "entity_id": str(d.entity_id),
                        "category": str(d.category),
                    },
                    created_at=d.created_at,
                    updated_at=d.updated_at,
                )
            )

        return results

    async def _search_tasks(  # noqa: PLR0912
        self,
        parsed: ParsedQuery,
        limit: int,
        date_from: datetime | None,
        date_to: datetime | None,
        statuses: list[str] | None = None,
        priorities: list[str] | None = None,
        assigned_to: UUID | None = None,
        program_id: UUID | None = None,
    ) -> list[SearchResult]:
        """Search tasks."""
        results: list[SearchResult] = []

        if not parsed.terms:
            return results

        conditions = []
        for term in parsed.terms:
            if parsed.exact_match:
                conditions.append(func.lower(Task.title) == term)
            else:
                conditions.append(
                    or_(
                        func.lower(Task.title).like(f"%{term}%"),
                        func.lower(Task.description).like(f"%{term}%"),
                        func.lower(Task.status).like(f"%{term}%"),
                    )
                )

        for excluded in parsed.excluded_terms:
            conditions.append(func.lower(Task.title).not_like(f"%{excluded}%"))

        # Status filter
        if statuses:
            conditions.append(func.lower(Task.status).in_(statuses))

        # Priority filter
        if priorities:
            conditions.append(func.lower(Task.priority).in_(priorities))

        # Assigned to filter
        if assigned_to:
            conditions.append(Task.assigned_to == assigned_to)

        # Program filter - tasks linked to milestones in a specific program
        if program_id:
            stmt = (
                select(Task)
                .join(Milestone, Task.milestone_id == Milestone.id)
                .where(*conditions, Milestone.program_id == program_id)
                .order_by(Task.updated_at.desc().nullslast())
                .limit(limit)
            )
        else:
            stmt = (
                select(Task)
                .where(*conditions)
                .order_by(Task.updated_at.desc().nullslast())
                .limit(limit)
            )

        if date_from:
            stmt = stmt.where(Task.created_at >= date_from)
        if date_to:
            stmt = stmt.where(Task.created_at <= date_to)

        rows = await self.db.execute(stmt)
        for t in rows.scalars().all():
            results.append(
                SearchResult(
                    id=str(t.id),
                    type=SearchEntityType.task,
                    title=t.title,
                    subtitle=f"Status: {t.status} • Priority: {t.priority}",
                    url=f"/tasks/{t.id}",
                    metadata={
                        "status": str(t.status),
                        "priority": str(t.priority),
                        "milestone_id": str(t.milestone_id),
                        "due_date": str(t.due_date) if t.due_date else None,
                    },
                    created_at=t.created_at,
                    updated_at=t.updated_at,
                )
            )

        return results
