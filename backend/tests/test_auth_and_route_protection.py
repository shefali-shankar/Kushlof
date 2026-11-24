"""Tests for signing in, sessions, route protection, CSRF protection and security headers."""

import re

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import CSRF_HEADERS, TEST_USERNAME

PUBLIC_API_PATHS = {"/api/auth/session", "/api/auth/sign-in", "/api/auth/sign-out", "/api/docs", "/api/openapi.json"}


def test_session_reports_no_profile_on_first_run(api_client: TestClient) -> None:
    session_response = api_client.get("/api/auth/session")
    assert session_response.json() == {"is_signed_in": False, "profile_exists": False, "username": None}


def test_first_sign_in_creates_the_profile(signed_in_api_client: TestClient) -> None:
    session_response = signed_in_api_client.get("/api/auth/session").json()
    assert session_response["is_signed_in"] is True
    assert session_response["username"] == TEST_USERNAME
    assert signed_in_api_client.get("/api/dashboard/summary").status_code == 200


def test_sign_in_is_case_insensitive(signed_in_api_client: TestClient) -> None:
    signed_in_api_client.post("/api/auth/sign-out", headers=CSRF_HEADERS)
    response = signed_in_api_client.post("/api/auth/sign-in", json={"username": TEST_USERNAME.upper()}, headers=CSRF_HEADERS)
    assert response.status_code == 200


def test_a_different_username_is_rejected(signed_in_api_client: TestClient) -> None:
    signed_in_api_client.post("/api/auth/sign-out", headers=CSRF_HEADERS)
    response = signed_in_api_client.post("/api/auth/sign-in", json={"username": "someone_else"}, headers=CSRF_HEADERS)
    assert response.status_code == 401


def test_invalid_usernames_are_rejected(api_client: TestClient) -> None:
    response = api_client.post("/api/auth/sign-in", json={"username": "<script>"}, headers=CSRF_HEADERS)
    assert response.status_code == 422


def test_session_cookie_is_http_only_and_strict(api_client: TestClient) -> None:
    response = api_client.post("/api/auth/sign-in", json={"username": TEST_USERNAME}, headers=CSRF_HEADERS)
    set_cookie_header = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie_header
    assert "samesite=strict" in set_cookie_header


def test_sign_out_ends_the_session(signed_in_api_client: TestClient) -> None:
    signed_in_api_client.post("/api/auth/sign-out", headers=CSRF_HEADERS)
    assert signed_in_api_client.get("/api/dashboard/summary").status_code == 401


def test_writes_without_csrf_header_are_rejected(api_client: TestClient) -> None:
    response = api_client.post("/api/auth/sign-in", json={"username": TEST_USERNAME})
    assert response.status_code == 403


def test_api_responses_include_security_headers(api_client: TestClient) -> None:
    response = api_client.get("/api/auth/session")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def replace_path_parameters_with_sample_values(route_path: str) -> str:
    """Turn '/api/resumes/{resume_id}' into '/api/resumes/1' so the route can be called."""
    return re.sub(r"\{[^}]+\}", "1", route_path)


def test_every_non_public_api_route_requires_sign_in(api_client: TestClient) -> None:
    """Any route added without sign-in protection makes this test fail."""
    protected_paths = {
        route_path: http_methods
        for route_path, http_methods in app.openapi()["paths"].items()
        if route_path not in PUBLIC_API_PATHS
    }
    assert len(protected_paths) > 20, "Expected the full set of protected routes."
    for route_path, http_methods in protected_paths.items():
        for http_method in http_methods:
            response = api_client.request(
                http_method.upper(), replace_path_parameters_with_sample_values(route_path), headers=CSRF_HEADERS
            )
            assert response.status_code == 401, f"{http_method.upper()} {route_path} is not protected"


def test_pipeline_never_runs_without_being_started(signed_in_api_client: TestClient) -> None:
    assert signed_in_api_client.get("/api/pipeline/runs").json() == []
