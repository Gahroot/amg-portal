"""Tests for the HIBP k-anonymity password check."""

from __future__ import annotations

import hashlib
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest

from app.core.exceptions import BadRequestException
from app.services import hibp


def _make_response(text: str, status_code: int = 200) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.text = text
    resp.status_code = status_code
    resp.raise_for_status = MagicMock()
    return resp


class _FakeAsyncClient:
    """Context-manager stand-in for ``httpx.AsyncClient`` used in tests."""

    def __init__(self, *, get_return: Any = None, get_raises: Exception | None = None) -> None:
        self._get_return = get_return
        self._get_raises = get_raises
        self.requested_urls: list[str] = []
        self.request_headers: list[dict[str, str]] = []

    async def __aenter__(self) -> _FakeAsyncClient:
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        return None

    async def get(self, url: str, headers: dict[str, str] | None = None) -> Any:
        self.requested_urls.append(url)
        self.request_headers.append(headers or {})
        if self._get_raises is not None:
            raise self._get_raises
        return self._get_return


def _install_fake_client(
    monkeypatch: pytest.MonkeyPatch,
    fake: _FakeAsyncClient,
) -> None:
    monkeypatch.setattr(
        hibp.httpx,
        "AsyncClient",
        lambda *args, **kwargs: fake,  # noqa: ARG005
    )


async def test_prefix_is_uppercase_first_five_of_sha1(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    password = "correct horse battery staple"
    expected_sha1 = (
        hashlib.sha1(password.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
    )
    expected_prefix = expected_sha1[:5]

    fake = _FakeAsyncClient(get_return=_make_response("ABCDE:1"))
    _install_fake_client(monkeypatch, fake)

    await hibp.check_password_pwned(password)

    assert len(fake.requested_urls) == 1
    url = fake.requested_urls[0]
    assert url.endswith(f"/range/{expected_prefix}")
    assert expected_prefix.isupper() or expected_prefix.isdigit() or all(
        c.isupper() or c.isdigit() for c in expected_prefix
    )
    assert fake.request_headers[0].get("User-Agent") == "AMG-Portal"


async def test_suffix_match_returns_breach_count(monkeypatch: pytest.MonkeyPatch) -> None:
    password = "password123"
    sha1 = hashlib.sha1(password.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
    suffix = sha1[5:]
    body = (
        "00000000000000000000000000000000000:1\r\n"
        f"{suffix}:42\r\n"
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:7"
    )

    fake = _FakeAsyncClient(get_return=_make_response(body))
    _install_fake_client(monkeypatch, fake)

    count = await hibp.check_password_pwned(password)
    assert count == 42


async def test_enforce_not_pwned_raises_when_found(monkeypatch: pytest.MonkeyPatch) -> None:
    password = "hunter2"
    sha1 = hashlib.sha1(password.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
    suffix = sha1[5:]
    body = f"{suffix}:9001"

    fake = _FakeAsyncClient(get_return=_make_response(body))
    _install_fake_client(monkeypatch, fake)

    with pytest.raises(BadRequestException) as excinfo:
        await hibp.enforce_not_pwned(password)
    assert "data breach" in str(excinfo.value.message).lower()


async def test_unknown_password_returns_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    # Response body contains only unrelated suffixes — our suffix is absent.
    body = "00000000000000000000000000000000000:1\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:5"
    fake = _FakeAsyncClient(get_return=_make_response(body))
    _install_fake_client(monkeypatch, fake)

    count = await hibp.check_password_pwned("a-hopefully-unique-pw-xyz")
    assert count == 0


async def test_unknown_password_does_not_raise_via_enforce(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeAsyncClient(get_return=_make_response(""))
    _install_fake_client(monkeypatch, fake)
    # Should not raise.
    await hibp.enforce_not_pwned("another-unique-pw-xyz")


async def test_timeout_is_fail_open(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeAsyncClient(get_raises=httpx.TimeoutException("timeout"))
    _install_fake_client(monkeypatch, fake)

    count = await hibp.check_password_pwned("whatever")
    assert count == 0
    # And the enforce wrapper must not raise.
    await hibp.enforce_not_pwned("whatever")


async def test_http_error_is_fail_open(monkeypatch: pytest.MonkeyPatch) -> None:
    response = _make_response("", status_code=500)
    response.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("boom", request=MagicMock(), response=response)
    )
    fake = _FakeAsyncClient(get_return=response)
    _install_fake_client(monkeypatch, fake)

    count = await hibp.check_password_pwned("whatever")
    assert count == 0


async def test_connection_error_is_fail_open(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeAsyncClient(get_raises=httpx.ConnectError("nope"))
    _install_fake_client(monkeypatch, fake)

    count = await hibp.check_password_pwned("whatever")
    assert count == 0


async def test_suffix_match_is_case_sensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    # HIBP returns uppercase hex; a lowercase suffix line must NOT match.
    password = "case-test"
    sha1 = hashlib.sha1(password.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
    lowered = sha1[5:].lower()
    body = f"{lowered}:5"

    fake = _FakeAsyncClient(get_return=_make_response(body))
    _install_fake_client(monkeypatch, fake)

    count = await hibp.check_password_pwned(password)
    assert count == 0


