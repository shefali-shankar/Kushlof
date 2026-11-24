"""API routes for signing in with a username, signing out, and checking the session."""

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlmodel import select

from app.api.dependencies import DatabaseSession
from app.core.sessions import end_user_session, find_signed_in_user, start_user_session
from app.models.user import UserProfile
from app.schemas.auth import SessionStatusResponse, SignInRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/session", response_model=SessionStatusResponse)
def get_session_status(http_request: Request, database_session: DatabaseSession) -> SessionStatusResponse:
    """Report whether a profile exists and whether this browser is signed in."""
    signed_in_user = find_signed_in_user(http_request, database_session)
    profile_exists = database_session.exec(select(UserProfile)).first() is not None
    return SessionStatusResponse(
        is_signed_in=signed_in_user is not None,
        profile_exists=profile_exists,
        username=signed_in_user.username if signed_in_user else None,
    )


@router.post("/sign-in", response_model=SessionStatusResponse)
def sign_in(
    sign_in_details: SignInRequest, http_response: Response, database_session: DatabaseSession
) -> SessionStatusResponse:
    """Sign in with a username. The first username used becomes this installation's owner profile."""
    entered_username = sign_in_details.username.strip()
    existing_profile = database_session.exec(select(UserProfile)).first()
    if existing_profile is None:
        existing_profile = UserProfile(username=entered_username)
        database_session.add(existing_profile)
        database_session.commit()
        database_session.refresh(existing_profile)
    elif existing_profile.username.lower() != entered_username.lower():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This Kushlof is set up for a different username.",
        )
    start_user_session(existing_profile, http_response, database_session)
    return SessionStatusResponse(is_signed_in=True, profile_exists=True, username=existing_profile.username)


@router.post("/sign-out")
def sign_out(http_request: Request, http_response: Response, database_session: DatabaseSession) -> dict[str, str]:
    """End this browser's session."""
    end_user_session(http_request, http_response, database_session)
    return {"message": "Signed out."}
