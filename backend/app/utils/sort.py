"""Whitelist-backed dynamic ORDER BY helper.

Accepts user-supplied ``sort_by`` / ``sort_dir`` query parameters and maps
them to SQLAlchemy column expressions through an explicit whitelist. Any
unrecognised key silently falls through to the caller-supplied default,
which makes SQL injection through the sort parameters structurally
impossible — the whitelist values must be real ``InstrumentedAttribute``
objects, never strings.

Reference idiom: ``ParisNeo/lollms_hub/app/crud/log_crud.py``
(``allowed_sort_columns.get(key, default)``).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import asc, desc
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql import Select


def safe_order_by(
    stmt: Select[Any],
    sort_by: str | None,
    sort_dir: str | None,
    *,
    whitelist: dict[str, InstrumentedAttribute[Any]],
    default: InstrumentedAttribute[Any],
) -> Select[Any]:
    """Apply a safe ORDER BY to ``stmt``.

    ``sort_by`` is looked up in ``whitelist``; any miss falls back to
    ``default``. ``sort_dir`` is case-insensitive — only the literal
    ``"desc"`` switches to descending; everything else (including ``None``,
    ``"asc"``, and garbage) sorts ascending so callers are default-safe.
    """
    column = whitelist.get(sort_by or "", default)
    direction = desc if (sort_dir or "asc").lower() == "desc" else asc
    return stmt.order_by(direction(column))
