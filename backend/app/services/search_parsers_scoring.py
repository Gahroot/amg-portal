"""Search query parsing and relevance scoring for global search."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


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

    terms: list[str]
    operators: list[SearchOperator]
    original: str
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

        exact_matches = cls.EXACT_PATTERN.findall(query)
        if exact_matches:
            exact_match = True
            for match in exact_matches:
                operators.append(SearchOperator("exact", match, f'"{match}"'))
            query = cls.EXACT_PATTERN.sub("", query)

        type_matches = cls.TYPE_PATTERN.findall(query)
        for type_match in type_matches:
            try:
                entity_type = SearchEntityType(type_match.lower())
                entity_types.append(entity_type)
                operators.append(SearchOperator("type", type_match, f"type:{type_match}"))
            except ValueError:
                pass  # Invalid type, ignore
        query = cls.TYPE_PATTERN.sub("", query)

        exclude_matches = cls.EXCLUDE_PATTERN.findall(query)
        for excluded in exclude_matches:
            excluded_terms.append(excluded)
            operators.append(SearchOperator("exclude", excluded, f"-{excluded}"))
        query = cls.EXCLUDE_PATTERN.sub("", query)

        terms = [t.lower() for t in query.split()]

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
            if exact_match and term == title_lower:
                score += 100.0
            elif term in title_lower:
                # Word boundary match scores higher than substring match
                if re.search(rf"\b{re.escape(term)}\b", title_lower):
                    score += 50.0
                else:
                    score += 30.0

            if term in subtitle_lower:
                if re.search(rf"\b{re.escape(term)}\b", subtitle_lower):
                    score += 20.0
                else:
                    score += 10.0

        if result.updated_at:
            days_since_update = (datetime.now(result.updated_at.tzinfo) - result.updated_at).days
            if days_since_update < 7:
                score += 10.0 * (7 - days_since_update) / 7

        status = result.metadata.get("status", "")
        if status in ("active", "in_progress", "accepted"):
            score += 5.0

        return score
