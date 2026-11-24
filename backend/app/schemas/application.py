"""Request and response shapes for the application board API."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.application import ApplicationStatus


class ApplicationCardResponse(BaseModel):
    """An application as shown on the board."""

    id: int
    status: ApplicationStatus
    job_id: int
    job_title: str
    company: str
    location: str
    job_url: str | None
    apply_url: str | None
    resume_id: int | None
    cover_letter_id: int | None
    notes: str
    applied_at: datetime | None
    created_at: datetime
    updated_at: datetime


class StatusChangeResponse(BaseModel):
    """One move between board columns."""

    from_status: str | None
    to_status: str
    changed_at: datetime


class ApplicationDetailResponse(ApplicationCardResponse):
    """An application with its status history."""

    status_history: list[StatusChangeResponse]


class CreateApplicationRequest(BaseModel):
    """Start tracking a job on the board."""

    job_id: int


class UpdateApplicationRequest(BaseModel):
    """Fields that can be changed on an application. Anything left out stays the same."""

    status: ApplicationStatus | None = None
    notes: str | None = Field(default=None, max_length=10_000)
    resume_id: int | None = None
    cover_letter_id: int | None = None
