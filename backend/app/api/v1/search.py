"""Global search endpoint for the command palette."""

from __future__ import annotations

import contextlib
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.models.client import Client
from app.models.document import Document
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.services.global_search_service import (
    GlobalSearchService,
    SearchEntityType,
)

router = APIRouter()


class SearchResultItem(BaseModel):
    """A single search result."""

    id: str
    type: str  # "program" | "client" | "partner" | "document" | "task"
    title: str
    subtitle: str | None = None
    url: str
    metadata: dict[str, Any] | None = None
    relevance_score: float = Field(default=0.0, description="Relevance score for ordering")


class SearchResultGroup(BaseModel):
    """A group of search results by entity type."""

    type: str
    label: str
    results: list[SearchResultItem]
    total: int
    has_more: bool = False


class GlobalSearchResponse(BaseModel):
    """Response for global search."""

    query: str
    groups: list[SearchResultGroup]
    total: int
    total_by_type: dict[str, int]
    operators: dict[str, Any] = Field(
        default_factory=dict,
        description="Detected operators from query",
    )


# Suggestion types
SuggestionCategory = Literal["recent", "popular", "client", "program", "partner", "document"]


class SearchSuggestion(BaseModel):
    """A single search suggestion."""

    text: str
    category: SuggestionCategory
    display_text: str | None = None  # Text with highlighting markers (**bold**)
    subtitle: str | None = None  # Optional context (e.g., "Client")
    count: int | None = None  # Usage count for popular suggestions


class SearchSuggestionsResponse(BaseModel):
    """Response containing search suggestions."""

    query: str
    suggestions: list[SearchSuggestion]
    total: int


# Entity type to display label mapping
TYPE_LABELS: dict[str, str] = {
    "program": "Programs",
    "client": "Clients",
    "partner": "Partners",
    "document": "Documents",
    "task": "Tasks",
}

# Order for displaying groups
TYPE_ORDER = ["client", "program", "partner", "task", "document"]


def parse_operators(q: str) -> dict[str, Any]:
    """Extract operators from query for response metadata."""
    import re

    operators: dict[str, list[str] | bool] = {
        "types": [],
        "excluded": [],
        "exact": False,
    }

    # Extract type filters
    type_matches = re.findall(r"type:(\S+)", q, re.IGNORECASE)
    for t in type_matches:
        if t.lower() in [e.value for e in SearchEntityType]:
            types_list = operators["types"]
            if isinstance(types_list, list):
                types_list.append(t.lower())

    # Extract excluded terms
    exclude_matches = re.findall(r"-(\S+)", q)
    operators["excluded"] = exclude_matches

    # Check for exact match
    operators["exact"] = bool(re.search(r'"[^"]+"', q))

    return operators


@router.post("/global", response_model=GlobalSearchResponse)
async def global_search(  # noqa: PLR0912
    db: DB,
    current_user: CurrentUser,
    q: str = Query("", min_length=0, max_length=200, description="Search query"),
    types: str | None = Query(
        None,
        description="Comma-separated entity types to search (program,client,partner,document,task)",
    ),
    limit: int = Query(10, ge=1, le=50, description="Max results per type"),
    date_from: datetime | None = Query(None, description="Filter by creation date (from)"),
    date_to: datetime | None = Query(None, description="Filter by creation date (to)"),
    # Advanced filters
    statuses: str | None = Query(None, description="Comma-separated statuses to filter by"),
    priorities: str | None = Query(
        None, description="Comma-separated priorities to filter by (tasks only)"
    ),
    assigned_to: UUID | None = Query(None, description="Filter by assigned user ID"),
    program_id: UUID | None = Query(None, description="Filter by program ID"),
    client_id: UUID | None = Query(None, description="Filter by client ID"),
) -> GlobalSearchResponse:
    """Search across programs, clients, partners, documents, and tasks.

    Supports search operators:
    - Exact match: Use quotes like "exact phrase"
    - Exclude: Use minus prefix like -excluded_term
    - Type filter: Use type:entity_type like type:client

    Query parameters for advanced filtering:
    - statuses: Filter by entity status (e.g., "active,pending")
    - priorities: Filter by task priority (e.g., "high,urgent")
    - assigned_to: Filter by assigned user UUID
    - program_id: Filter by program UUID
    - client_id: Filter by client UUID

    Examples:
    - "John Smith" - Search for exact phrase
    - project -test - Search for "project" excluding "test"
    - type:client Smith - Search clients only for "Smith"
    - type:program,type:task urgent - Search programs and tasks for "urgent"
    """
    if not q.strip():
        return GlobalSearchResponse(
            query=q,
            groups=[],
            total=0,
            total_by_type={},
            operators=parse_operators(q),
        )

    # Parse entity type filters from query parameter
    entity_types: list[SearchEntityType] | None = None
    if types:
        entity_types = []
        for t in types.split(","):
            t = t.strip().lower()
            with contextlib.suppress(ValueError):
                entity_types.append(SearchEntityType(t))
        if not entity_types:
            entity_types = None

    # Parse status filters
    status_list: list[str] | None = None
    if statuses:
        status_list = [s.strip().lower() for s in statuses.split(",") if s.strip()]
        if not status_list:
            status_list = None

    # Parse priority filters
    priority_list: list[str] | None = None
    if priorities:
        priority_list = [p.strip().lower() for p in priorities.split(",") if p.strip()]
        if not priority_list:
            priority_list = None

    # Perform search
    service = GlobalSearchService(db)
    results = await service.search(
        query=q,
        entity_types=entity_types,
        limit=limit,
        date_from=date_from,
        date_to=date_to,
        statuses=status_list,
        priorities=priority_list,
        assigned_to=assigned_to,
        program_id=program_id,
        client_id=client_id,
    )

    # Convert to response format
    groups: list[SearchResultGroup] = []

    # Order groups by TYPE_ORDER
    for entity_type in TYPE_ORDER:
        if entity_type in results.groups:
            items = results.groups[entity_type]
            groups.append(
                SearchResultGroup(
                    type=entity_type,
                    label=TYPE_LABELS.get(entity_type, entity_type.title()),
                    results=[
                        SearchResultItem(
                            id=item.id,
                            type=item.type.value,
                            title=item.title,
                            subtitle=item.subtitle,
                            url=item.url,
                            metadata=item.metadata,
                            relevance_score=item.relevance_score,
                        )
                        for item in items
                    ],
                    total=results.total_by_type.get(entity_type, 0),
                    has_more=results.has_more.get(entity_type, False),
                )
            )

    # Add any remaining types not in TYPE_ORDER
    for entity_type, items in results.groups.items():
        if entity_type not in TYPE_ORDER:
            groups.append(
                SearchResultGroup(
                    type=entity_type,
                    label=TYPE_LABELS.get(entity_type, entity_type.title()),
                    results=[
                        SearchResultItem(
                            id=item.id,
                            type=item.type.value,
                            title=item.title,
                            subtitle=item.subtitle,
                            url=item.url,
                            metadata=item.metadata,
                            relevance_score=item.relevance_score,
                        )
                        for item in items
                    ],
                    total=results.total_by_type.get(entity_type, 0),
                    has_more=results.has_more.get(entity_type, False),
                )
            )

    return GlobalSearchResponse(
        query=q,
        groups=groups,
        total=results.total,
        total_by_type=results.total_by_type,
        operators=parse_operators(q),
    )


@router.get("/suggestions", response_model=SearchSuggestionsResponse)
async def search_suggestions(  # noqa: PLR0912, PLR0915
    db: DB,
    current_user: CurrentUser,
    q: str = Query("", min_length=0, max_length=100),
    limit: int = Query(10, ge=1, le=20),
) -> SearchSuggestionsResponse:
    """Get search suggestions with auto-complete based on partial query.

    Returns suggestions from:
    - Popular/common searches (prefix match)
    - Entity names (clients, programs, partners, documents) with prefix match

    Suggestions are ordered by relevance: exact prefix match first, then contains.
    """
    suggestions: list[SearchSuggestion] = []
    query = q.strip().lower()
    seen_texts: set[str] = set()

    # Popular/common search terms
    popular_searches = [
        "active programs",
        "pending approvals",
        "documents",
        "partners",
        "clients",
        "escalations",
        "invoices",
        "reports",
    ]

    def highlight_match(text: str, search_query: str) -> str:
        """Add **bold** markers around matching portion of text."""
        if not search_query:
            return text
        lower_text = text.lower()
        lower_query = search_query.lower()
        idx = lower_text.find(lower_query)
        if idx == -1:
            return text
        end_idx = idx + len(search_query)
        return f"{text[:idx]}**{text[idx:end_idx]}**{text[end_idx:]}"

    def add_suggestion(
        text: str, category: SuggestionCategory, subtitle: str | None = None
    ) -> None:
        normalized = text.lower()
        if normalized not in seen_texts and len(suggestions) < limit:
            seen_texts.add(normalized)
            suggestions.append(
                SearchSuggestion(
                    text=text,
                    category=category,
                    display_text=highlight_match(text, query),
                    subtitle=subtitle,
                )
            )

    if not query:
        # Return popular searches when no query
        for term in popular_searches[:limit]:
            suggestions.append(
                SearchSuggestion(
                    text=term,
                    category="popular",
                    subtitle="Popular search",
                )
            )
        return SearchSuggestionsResponse(query=q, suggestions=suggestions, total=len(suggestions))

    # Search clients for name suggestions (prefix match first)
    client_stmt = (
        select(Client.name)
        .where(func.lower(Client.name).like(f"{query}%"))
        .distinct()
        .limit(5)
    )
    client_rows = await db.execute(client_stmt)
    for (name,) in client_rows.all():
        add_suggestion(name, "client", "Client")

    # Then check contains for clients
    if len(suggestions) < limit:
        client_contains_stmt = (
            select(Client.name)
            .where(func.lower(Client.name).like(f"%{query}%"))
            .where(func.lower(Client.name).notlike(f"{query}%"))
            .distinct()
            .limit(limit - len(suggestions))
        )
        client_contains_rows = await db.execute(client_contains_stmt)
        for (name,) in client_contains_rows.all():
            add_suggestion(name, "client", "Client")

    # Search programs for title suggestions
    program_stmt = (
        select(Program.title)
        .where(func.lower(Program.title).like(f"{query}%"))
        .distinct()
        .limit(5)
    )
    program_rows = await db.execute(program_stmt)
    for (title,) in program_rows.all():
        add_suggestion(title, "program", "Program")

    if len(suggestions) < limit:
        program_contains_stmt = (
            select(Program.title)
            .where(func.lower(Program.title).like(f"%{query}%"))
            .where(func.lower(Program.title).notlike(f"{query}%"))
            .distinct()
            .limit(limit - len(suggestions))
        )
        program_contains_rows = await db.execute(program_contains_stmt)
        for (title,) in program_contains_rows.all():
            add_suggestion(title, "program", "Program")

    # Search partners for firm name suggestions
    partner_stmt = (
        select(PartnerProfile.firm_name)
        .where(func.lower(PartnerProfile.firm_name).like(f"{query}%"))
        .distinct()
        .limit(5)
    )
    partner_rows = await db.execute(partner_stmt)
    for (firm_name,) in partner_rows.all():
        add_suggestion(str(firm_name), "partner", "Partner")

    if len(suggestions) < limit:
        partner_contains_stmt = (
            select(PartnerProfile.firm_name)
            .where(func.lower(PartnerProfile.firm_name).like(f"%{query}%"))
            .where(func.lower(PartnerProfile.firm_name).notlike(f"{query}%"))
            .distinct()
            .limit(limit - len(suggestions))
        )
        partner_contains_rows = await db.execute(partner_contains_stmt)
        for (firm_name,) in partner_contains_rows.all():
            add_suggestion(str(firm_name), "partner", "Partner")

    # Search documents for file name suggestions
    doc_stmt = (
        select(Document.file_name)
        .where(func.lower(Document.file_name).like(f"{query}%"))
        .distinct()
        .limit(5)
    )
    doc_rows = await db.execute(doc_stmt)
    for (file_name,) in doc_rows.all():
        add_suggestion(str(file_name), "document", "Document")

    if len(suggestions) < limit:
        doc_contains_stmt = (
            select(Document.file_name)
            .where(func.lower(Document.file_name).like(f"%{query}%"))
            .where(func.lower(Document.file_name).notlike(f"{query}%"))
            .distinct()
            .limit(limit - len(suggestions))
        )
        doc_contains_rows = await db.execute(doc_contains_stmt)
        for (file_name,) in doc_contains_rows.all():
            add_suggestion(str(file_name), "document", "Document")

    # Add popular searches that match the query
    if len(suggestions) < limit:
        for term in popular_searches:
            if query in term.lower() and term.lower() not in seen_texts:
                add_suggestion(term, "popular", "Popular search")
                if len(suggestions) >= limit:
                    break

    return SearchSuggestionsResponse(query=q, suggestions=suggestions, total=len(suggestions))
