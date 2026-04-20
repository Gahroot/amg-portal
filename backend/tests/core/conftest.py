"""Local conftest for core-crypto tests.

The repo-wide conftest pre-builds a Postgres test database for the API test
suite. These crypto unit tests don't need it (pure in-memory sqlite + HKDF
math), so we shadow the session-scoped fixture with a no-op.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest


@pytest.fixture(scope="session", autouse=True)
def create_test_database() -> Generator[None, None, None]:
    yield
