"""Tables for the app owner's profile and their sign-in sessions."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.timestamps import utc_now


class UserProfile(SQLModel, table=True):
    """The single person who uses this Kushlof installation."""

    __tablename__ = "user_profiles"

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True, max_length=64)
    created_at: datetime = Field(default_factory=utc_now)


class UserSession(SQLModel, table=True):
    """A signed-in browser. Only a hash of the session token is stored, never the token itself."""

    __tablename__ = "user_sessions"

    id: int | None = Field(default=None, primary_key=True)
    user_profile_id: int = Field(foreign_key="user_profiles.id", index=True)
    token_hash: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
