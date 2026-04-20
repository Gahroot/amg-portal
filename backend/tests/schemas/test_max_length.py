"""Ensure every string field across `app.schemas` declares a max_length.

Rationale (Phase 1 §1.10): unbounded `str` fields are a DoS / abuse vector —
large payloads, log-flooding, and index bloat. A single regression guard that
walks every Pydantic model and fails when a field's JSON-schema entry is of
type ``string`` but lacks ``maxLength`` catches new schema drift automatically.

Only string-typed JSON-schema properties are checked. UUIDs, datetimes,
enums, literals, and discriminated unions are out of scope (they have their
own validation and are either bounded by format or by enum membership).
"""

from __future__ import annotations

import importlib
import pkgutil
from typing import Any

import pydantic
import pytest

import app.schemas as schemas_pkg

# Schema modules that are intentionally skipped:
# - `audit_log` — owned by a parallel agent working on audit-chain columns.
SKIP_MODULES = {"audit_log"}

# Field names that legitimately have no max_length even when string-typed.
# Keep this list empty unless there is a documented reason for an exception.
ALLOWED_UNBOUNDED_FIELDS: set[tuple[str, str]] = set()


def _iter_schema_modules() -> list[Any]:
    modules = []
    for _finder, name, _ispkg in pkgutil.iter_modules(schemas_pkg.__path__):
        if name.startswith("_") or name in SKIP_MODULES:
            continue
        modules.append(importlib.import_module(f"app.schemas.{name}"))
    return modules


def _iter_model_classes(module: Any) -> list[type[pydantic.BaseModel]]:
    classes: list[type[pydantic.BaseModel]] = []
    for attr in vars(module).values():
        if (
            isinstance(attr, type)
            and issubclass(attr, pydantic.BaseModel)
            and attr is not pydantic.BaseModel
            and attr.__module__ == module.__name__
        ):
            classes.append(attr)
    return classes


def _is_string_schema(schema_fragment: dict[str, Any]) -> bool:
    """True if the fragment represents a plain string (not enum, not format=uuid/date)."""
    if schema_fragment.get("type") != "string":
        return False
    # Formatted strings (uuid, date-time, email, etc.) are bounded by their format.
    if "format" in schema_fragment:
        return False
    # Enum-constrained strings are bounded by the enum.
    if "enum" in schema_fragment or "const" in schema_fragment:
        return False
    # Pattern-constrained strings (e.g. Decimal's string coercion) are bounded
    # by the regex. Decimal serialization is `type=string + pattern=...`.
    return "pattern" not in schema_fragment


def _string_variants(property_schema: dict[str, Any]) -> list[dict[str, Any]]:
    """Return every string sub-schema inside a direct property (handles `anyOf`/`oneOf`).

    Array element types are intentionally NOT walked — Phase 1 §1.10 scopes the
    sweep to direct `str` fields. List-of-string items (tags, enum lists) are
    their own concern and out of scope here.
    """
    variants: list[dict[str, Any]] = []

    def _walk(node: Any) -> None:
        if not isinstance(node, dict):
            return
        if _is_string_schema(node):
            variants.append(node)
        for key in ("anyOf", "oneOf", "allOf"):
            for sub in node.get(key, []) or []:
                _walk(sub)

    _walk(property_schema)
    return variants


def _collect_unbounded(model: type[pydantic.BaseModel]) -> list[str]:
    """Return field names on `model` whose string schemas lack `maxLength`."""
    unbounded: list[str] = []
    try:
        schema = model.model_json_schema(mode="serialization")
    except pydantic.errors.PydanticInvalidForJsonSchema:
        # Some response models embed non-serializable types (e.g. dict[str, object]
        # from ORM relationships). Fall back to validation-mode schema.
        schema = model.model_json_schema()
    properties = schema.get("properties", {})
    for field_name, field_schema in properties.items():
        if (model.__name__, field_name) in ALLOWED_UNBOUNDED_FIELDS:
            continue
        variants = _string_variants(field_schema)
        if not variants:
            continue
        for variant in variants:
            if "maxLength" not in variant:
                unbounded.append(field_name)
                break
    return unbounded


@pytest.mark.parametrize(
    "module",
    _iter_schema_modules(),
    ids=lambda m: m.__name__.rsplit(".", 1)[-1],
)
def test_schema_string_fields_have_max_length(module: Any) -> None:
    """Every string field in every schema in `module` must declare a max_length."""
    offenders: dict[str, list[str]] = {}
    for cls in _iter_model_classes(module):
        unbounded = _collect_unbounded(cls)
        if unbounded:
            offenders[cls.__name__] = unbounded

    assert not offenders, (
        f"Unbounded string fields found in {module.__name__}: {offenders}. "
        "Add a max_length to each (use the aliases in app.schemas.base)."
    )


def test_base_aliases_expose_max_length() -> None:
    """Sanity check: the shared aliases carry StringConstraints with max_length."""
    from app.schemas.base import (
        Str10,
        Str50,
        Str100,
        Str255,
        Str500,
        Str2000,
        TextStr,
    )

    class _Probe(pydantic.BaseModel):
        a: Str10
        b: Str50
        c: Str100
        d: Str255
        e: Str500
        f: Str2000
        g: TextStr

    props = _Probe.model_json_schema()["properties"]
    assert props["a"]["maxLength"] == 10
    assert props["b"]["maxLength"] == 50
    assert props["c"]["maxLength"] == 100
    assert props["d"]["maxLength"] == 255
    assert props["e"]["maxLength"] == 500
    assert props["f"]["maxLength"] == 2000
    assert props["g"]["maxLength"] == 10_000


def test_oversized_value_rejected_by_alias() -> None:
    """A value longer than the cap must fail validation."""
    from app.schemas.base import Str50

    class _Probe(pydantic.BaseModel):
        x: Str50

    with pytest.raises(pydantic.ValidationError):
        _Probe(x="a" * 51)
