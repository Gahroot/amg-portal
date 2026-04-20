"""Local conftest for service unit tests.

These tests stub out network / DB access, so we shadow the repo-wide
Postgres fixture with a no-op to keep them fast and hermetic.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest


@pytest.fixture(scope="session", autouse=True)
def create_test_database() -> Generator[None, None, None]:
    yield
