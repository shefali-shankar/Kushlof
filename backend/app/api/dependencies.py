"""Reusable FastAPI dependencies: the database session and the signed-in user."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from app.core.database import get_database_session
from app.core.sessions import find_signed_in_user
from app.models.user import UserProfile

DatabaseSession = Annotated[Session, Depends(get_database_session)]


def require_signed_in_user(http_request: Request, database_session: DatabaseSession) -> UserProfile:
    """Reject the request with 401 unless the browser has a valid sign-in session."""
    signed_in_user = find_signed_in_user(http_request, database_session)
    if signed_in_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in.")
    return signed_in_user


def get_record_or_404[RecordType](
    database_session: Session, record_class: type[RecordType], record_id: int, record_label: str
) -> RecordType:
    """Load a database record by ID, or respond with 404 if it does not exist."""
    found_record = database_session.get(record_class, record_id)
    if found_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{record_label} not found.")
    return found_record
