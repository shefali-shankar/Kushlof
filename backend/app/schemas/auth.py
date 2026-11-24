"""Request and response shapes for signing in."""

from pydantic import BaseModel, Field


class SignInRequest(BaseModel):
    """The username entered on the sign-in page."""

    username: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.\- ]+$")


class SessionStatusResponse(BaseModel):
    """Tells the frontend whether to show the sign-in page or the app."""

    is_signed_in: bool
    profile_exists: bool
    username: str | None = None
