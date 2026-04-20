"""Local conftest for utility unit tests.

These tests don't need the Postgres test database the repo-wide conftest
builds, so we shadow the session-scoped fixture with a no-op.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest


@pytest.fixture(scope="session", autouse=True)
def create_test_database() -> Generator[None, None, None]:
    yield
