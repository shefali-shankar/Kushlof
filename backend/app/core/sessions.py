"""Creates, looks up and ends sign-in sessions stored as secure browser cookies."""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Request, Response
from sqlmodel import Session, select

from app.core.config import settings
from app.models.user import UserProfile, UserSession

SESSION_COOKIE_NAME = "kushlof_session"


def hash_session_token(session_token: str) -> str:
    """Hash a session token so a copied database cannot be used to hijack sessions."""
    return hmac.new(
        settings.internal_secret_salt.encode(), session_token.encode(), hashlib.sha256
    ).hexdigest()


def start_user_session(
    user_profile: UserProfile, http_response: Response, database_session: Session
) -> None:
    """Create a new session for the user and send its token to the browser as an HttpOnly cookie."""
    session_token = secrets.token_urlsafe(32)
    database_session.add(
        UserSession(
            user_profile_id=user_profile.id,
            token_hash=hash_session_token(session_token),
            expires_at=datetime.now(UTC) + timedelta(hours=settings.session_lifetime_hours),
        )
    )
    database_session.commit()
    http_response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=settings.session_lifetime_hours * 3600,
        httponly=True,
        samesite="strict",
        secure=settings.use_secure_cookies,
        path="/",
    )


def find_session_for_request(http_request: Request, database_session: Session) -> UserSession | None:
    """Return the stored session matching the request's cookie, if any."""
    session_token = http_request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return None
    return database_session.exec(
        select(UserSession).where(UserSession.token_hash == hash_session_token(session_token))
    ).first()


def end_user_session(
    http_request: Request, http_response: Response, database_session: Session
) -> None:
    """Delete the current session and remove the cookie from the browser."""
    stored_session = find_session_for_request(http_request, database_session)
    if stored_session:
        database_session.delete(stored_session)
        database_session.commit()
    http_response.delete_cookie(SESSION_COOKIE_NAME, path="/")


def find_signed_in_user(http_request: Request, database_session: Session) -> UserProfile | None:
    """Return the user who owns the request's session cookie, or None if there is no valid session."""
    stored_session = find_session_for_request(http_request, database_session)
    if stored_session is None:
        return None
    if stored_session.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC):
        database_session.delete(stored_session)
        database_session.commit()
        return None
    return database_session.get(UserProfile, stored_session.user_profile_id)
