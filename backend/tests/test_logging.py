"""Tests for the structured-logging stack (Phase 3.2).

Verifies:
* JsonFormatter emits one JSON object per record with the required fields.
* PIIRedactingFilter scrubs values for sensitive keys.
* JWT-shaped strings are scrubbed.
* request_id from the ContextVar shows up on records.
"""

from __future__ import annotations

import io
import json
import logging
import uuid

import pytest

from app.core.logging import (
    ContextFilter,
    JsonFormatter,
    PIIRedactingFilter,
    bind_log_context,
    log_context_var,
)


@pytest.fixture
def isolated_logger() -> tuple[logging.Logger, io.StringIO]:
    """Build a logger with a single in-memory handler and our filters."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(PIIRedactingFilter())
    handler.addFilter(ContextFilter())

    name = f"test.logger.{uuid.uuid4().hex}"
    logger = logging.getLogger(name)
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    return logger, stream


def _read_record(stream: io.StringIO) -> dict[str, object]:
    raw = stream.getvalue().strip().splitlines()
    assert raw, "no record emitted"
    return json.loads(raw[-1])


def test_json_formatter_emits_required_fields(
    isolated_logger: tuple[logging.Logger, io.StringIO],
) -> None:
    logger, stream = isolated_logger
    logger.info("hello world", extra={"event": "test.event"})
    rec = _read_record(stream)
    for key in ("ts", "level", "logger", "msg", "service", "env"):
        assert key in rec
    assert rec["msg"] == "hello world"
    assert rec["level"] == "INFO"
    assert rec["service"] == "amg-portal-backend"
    assert rec["event"] == "test.event"
    assert rec["ts"].endswith("Z")


def test_json_output_is_one_line_per_record(
    isolated_logger: tuple[logging.Logger, io.StringIO],
) -> None:
    logger, stream = isolated_logger
    logger.info("one")
    logger.warning("two")
    lines = [line for line in stream.getvalue().splitlines() if line.strip()]
    assert len(lines) == 2
    for line in lines:
        json.loads(line)  # raises if any line isn't valid JSON


def test_redacts_sensitive_keys_in_extras(
    isolated_logger: tuple[logging.Logger, io.StringIO],
) -> None:
    logger, stream = isolated_logger
    logger.info(
        "credentials issued",
        extra={
            "password": "supersecret123",
            "api_key": "amg_abcdef123456",
            "tax_id": "123-45-6789",
            "harmless": "ok",
        },
    )
    rec = _read_record(stream)
    assert rec["password"] == "***"
    assert rec["api_key"] == "***"
    assert rec["tax_id"] == "***"
    assert rec["harmless"] == "ok"


def test_redacts_jwt_in_message(
    isolated_logger: tuple[logging.Logger, io.StringIO],
) -> None:
    logger, stream = isolated_logger
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0._3KQabcDEFghijKLmnoPQRstuvWXyz1234567890ab"
    logger.info("issued token=%s", jwt)
    rec = _read_record(stream)
    assert "eyJ" not in rec["msg"], rec["msg"]
    assert "***" in rec["msg"]


def test_redacts_bearer_token(
    isolated_logger: tuple[logging.Logger, io.StringIO],
) -> None:
    logger, stream = isolated_logger
    logger.info("Authorization: Bearer abc123def456ghi789jkl0")
    rec = _read_record(stream)
    assert "abc123def456" not in rec["msg"]
    assert "***" in rec["msg"]


def test_redacts_nested_dict_in_extras(
    isolated_logger: tuple[logging.Logger, io.StringIO],
) -> None:
    logger, stream = isolated_logger
    logger.info(
        "payload",
        extra={
            "payload": {
                "email": "alice@example.com",
                "nested": {"refresh_token": "longrefreshvaluexyz"},
            },
        },
    )
    rec = _read_record(stream)
    payload = rec["payload"]
    assert isinstance(payload, dict)
    assert payload["email"] == "***"
    assert payload["nested"]["refresh_token"] == "***"


def test_request_id_from_contextvar_is_attached(
    isolated_logger: tuple[logging.Logger, io.StringIO],
) -> None:
    logger, stream = isolated_logger
    rid = uuid.uuid4().hex
    token = log_context_var.set(
        {"request_id": rid, "method": "GET", "path": "/health"},
    )
    try:
        bind_log_context(actor_id="user-123")
        logger.info("inside request")
    finally:
        log_context_var.reset(token)
    rec = _read_record(stream)
    assert rec["request_id"] == rid
    assert rec["method"] == "GET"
    assert rec["path"] == "/health"
    assert rec["actor_id"] == "user-123"


def test_request_id_absent_when_no_context(
    isolated_logger: tuple[logging.Logger, io.StringIO],
) -> None:
    logger, stream = isolated_logger
    logger.info("no request bound")
    rec = _read_record(stream)
    assert "request_id" not in rec
