"""Shared test setup: every test gets a fresh, empty temporary database."""

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

# Point the app at a throwaway database before any app module is imported.
temporary_test_folder = Path(tempfile.mkdtemp(prefix="kushlof_tests_"))
os.environ["DATABASE_FILE_PATH"] = str(temporary_test_folder / "test.db")

from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from app.core.database import database_engine  # noqa: E402
from app.main import app  # noqa: E402

CSRF_HEADERS = {"X-Requested-With": "Kushlof"}
TEST_USERNAME = "test_user"


@pytest.fixture
def api_client() -> Iterator[TestClient]:
    """A test client with an empty database."""
    SQLModel.metadata.drop_all(database_engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def signed_in_api_client(api_client: TestClient) -> TestClient:
    """A test client that has signed in (creating the profile)."""
    sign_in_response = api_client.post("/api/auth/sign-in", json={"username": TEST_USERNAME}, headers=CSRF_HEADERS)
    assert sign_in_response.status_code == 200
    return api_client
