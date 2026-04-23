"""Global search service for unified search across all entities."""

from __future__ import annotations

import asyncio
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.document import Document
from app.models.milestone import Milestone
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.models.task import Task
from app.services.search_parsers_scoring import (
    GroupedSearchResults,
    ParsedQuery,
    QueryParser,
    RelevanceScorer,
    SearchEntityType,
    SearchOperator,
    SearchResult,
)

__all__ = [
    "GlobalSearchService",
    "GroupedSearchResults",
    "ParsedQuery",
    "QueryParser",
    "RelevanceScorer",
    "SearchEntityType",
    "SearchOperator",
    "SearchResult",
]


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
            parsed.entity_types if parsed.entity_types else (entity_types or list(SearchEntityType))
        )

        per_type_limit = min(limit, self.PER_TYPE_LIMIT)

        # Build coroutines for each requested entity type and run them in parallel
        coros = []
        if SearchEntityType.program in types_to_search:
            coros.append(
                self._search_programs(
                    parsed, per_type_limit, date_from, date_to, statuses, client_id
                )
            )
        if SearchEntityType.client in types_to_search:
            coros.append(self._search_clients(parsed, per_type_limit, date_from, date_to, statuses))
        if SearchEntityType.partner in types_to_search:
            coros.append(
                self._search_partners(parsed, per_type_limit, date_from, date_to, statuses)
            )
        if SearchEntityType.document in types_to_search:
            coros.append(
                self._search_documents(parsed, per_type_limit, date_from, date_to, program_id)
            )
        if SearchEntityType.task in types_to_search:
            coros.append(
                self._search_tasks(
                    parsed,
                    per_type_limit,
                    date_from,
                    date_to,
                    statuses,
                    priorities,
                    assigned_to,
                    program_id,
                )
            )

        result_lists = await asyncio.gather(*coros)
        all_results: list[SearchResult] = [item for sublist in result_lists for item in sublist]

        # Calculate relevance scores
        for result in all_results:
            result.relevance_score = self.scorer.score(result, parsed.terms, parsed.exact_match)

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
                        Program.title.ilike(f"%{term}%"),
                        Program.status.ilike(f"%{term}%"),
                        Program.objectives.ilike(f"%{term}%"),
                    )
                )

        # Exclude terms
        for excluded in parsed.excluded_terms:
            conditions.append(~Program.title.ilike(f"%{excluded}%"))

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
                        Client.name.ilike(f"%{term}%"),
                        Client.client_type.ilike(f"%{term}%"),
                        Client.notes.ilike(f"%{term}%"),
                    )
                )

        for excluded in parsed.excluded_terms:
            conditions.append(~Client.name.ilike(f"%{excluded}%"))

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
                        PartnerProfile.firm_name.ilike(f"%{term}%"),
                        PartnerProfile.contact_name.ilike(f"%{term}%"),
                        PartnerProfile.contact_email.ilike(f"%{term}%"),
                        PartnerProfile.notes.ilike(f"%{term}%"),
                    )
                )

        for excluded in parsed.excluded_terms:
            conditions.append(~PartnerProfile.firm_name.ilike(f"%{excluded}%"))
            conditions.append(~PartnerProfile.contact_name.ilike(f"%{excluded}%"))

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
                        Document.file_name.ilike(f"%{term}%"),
                        Document.description.ilike(f"%{term}%"),
                        Document.category.ilike(f"%{term}%"),
                    )
                )

        for excluded in parsed.excluded_terms:
            conditions.append(~Document.file_name.ilike(f"%{excluded}%"))

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
                        Task.title.ilike(f"%{term}%"),
                        Task.description.ilike(f"%{term}%"),
                        Task.status.ilike(f"%{term}%"),
                    )
                )

        for excluded in parsed.excluded_terms:
            conditions.append(~Task.title.ilike(f"%{excluded}%"))

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
