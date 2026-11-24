"""Tables for tracked job applications (the Kanban board) and their status history."""

from datetime import datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel

from app.models.timestamps import utc_now


class ApplicationStatus(StrEnum):
    """The columns of the application board, in order."""

    SAVED = "saved"
    TAILORING = "tailoring"
    READY_TO_APPLY = "ready_to_apply"
    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"


class Application(SQLModel, table=True):
    """One job the user is tracking, with the CV and cover letter used for it."""

    __tablename__ = "applications"

    id: int | None = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="jobs.id", unique=True, index=True)
    status: str = Field(default=ApplicationStatus.SAVED.value, max_length=30, index=True)
    resume_id: int | None = Field(default=None, foreign_key="resumes.id")
    cover_letter_id: int | None = Field(default=None, foreign_key="cover_letters.id")
    notes: str = ""
    applied_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ApplicationStatusChange(SQLModel, table=True):
    """A record of an application moving from one board column to another."""

    __tablename__ = "application_status_changes"

    id: int | None = Field(default=None, primary_key=True)
    application_id: int = Field(foreign_key="applications.id", index=True)
    from_status: str | None = Field(default=None, max_length=30)
    to_status: str = Field(max_length=30)
    changed_at: datetime = Field(default_factory=utc_now)
