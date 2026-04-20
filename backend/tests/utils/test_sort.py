"""Tests for ``app.utils.sort.safe_order_by``."""

from __future__ import annotations

from sqlalchemy import Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.utils.sort import safe_order_by


class _Base(DeclarativeBase):
    pass


class _Thing(_Base):
    __tablename__ = "sort_test_thing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[int] = mapped_column(Integer)


_WHITELIST = {
    "name": _Thing.name,
    "created_at": _Thing.created_at,
}


def _compiled(stmt: object) -> str:
    return str(stmt)


def test_unknown_sort_by_falls_back_to_default() -> None:
    stmt = safe_order_by(
        select(_Thing),
        sort_by="not_a_real_column",
        sort_dir="asc",
        whitelist=_WHITELIST,
        default=_Thing.id,
    )
    sql = _compiled(stmt)
    assert "ORDER BY sort_test_thing.id ASC" in sql
    assert "not_a_real_column" not in sql


def test_none_sort_by_uses_default() -> None:
    stmt = safe_order_by(
        select(_Thing),
        sort_by=None,
        sort_dir=None,
        whitelist=_WHITELIST,
        default=_Thing.id,
    )
    assert "ORDER BY sort_test_thing.id ASC" in _compiled(stmt)


def test_desc_direction_case_insensitive() -> None:
    stmt = safe_order_by(
        select(_Thing),
        sort_by="name",
        sort_dir="DESC",
        whitelist=_WHITELIST,
        default=_Thing.id,
    )
    assert "ORDER BY sort_test_thing.name DESC" in _compiled(stmt)


def test_asc_direction_explicit() -> None:
    stmt = safe_order_by(
        select(_Thing),
        sort_by="created_at",
        sort_dir="asc",
        whitelist=_WHITELIST,
        default=_Thing.id,
    )
    assert "ORDER BY sort_test_thing.created_at ASC" in _compiled(stmt)


def test_missing_sort_dir_defaults_to_asc() -> None:
    stmt = safe_order_by(
        select(_Thing),
        sort_by="created_at",
        sort_dir=None,
        whitelist=_WHITELIST,
        default=_Thing.id,
    )
    assert "ORDER BY sort_test_thing.created_at ASC" in _compiled(stmt)


def test_garbage_sort_dir_defaults_to_asc() -> None:
    stmt = safe_order_by(
        select(_Thing),
        sort_by="name",
        sort_dir="sideways",
        whitelist=_WHITELIST,
        default=_Thing.id,
    )
    assert "ORDER BY sort_test_thing.name ASC" in _compiled(stmt)


def test_empty_whitelist_uses_default() -> None:
    stmt = safe_order_by(
        select(_Thing),
        sort_by="name",
        sort_dir="asc",
        whitelist={},
        default=_Thing.created_at,
    )
    sql = _compiled(stmt)
    assert "ORDER BY sort_test_thing.created_at ASC" in sql
    assert "name" not in sql.split("ORDER BY")[1]


def test_sql_injection_attempt_falls_back_to_default() -> None:
    payload = "id; DROP TABLE users"
    stmt = safe_order_by(
        select(_Thing),
        sort_by=payload,
        sort_dir="asc",
        whitelist=_WHITELIST,
        default=_Thing.id,
    )
    sql = _compiled(stmt)
    assert "DROP TABLE" not in sql
    assert payload not in sql
    assert "ORDER BY sort_test_thing.id ASC" in sql


def test_sort_dir_injection_attempt_defaults_to_asc() -> None:
    stmt = safe_order_by(
        select(_Thing),
        sort_by="name",
        sort_dir="desc; DROP TABLE users",
        whitelist=_WHITELIST,
        default=_Thing.id,
    )
    sql = _compiled(stmt)
    assert "DROP TABLE" not in sql
    assert "ORDER BY sort_test_thing.name ASC" in sql
