"""Request and response shapes for the cover letter API."""

from datetime import datetime

from pydantic import BaseModel, Field


class GenerateCoverLetterRequest(BaseModel):
    """Write a cover letter for a job using one of the user's CVs."""

    job_id: int
    resume_id: int
    extra_instructions: str = Field(default="", max_length=1000)


class CoverLetterResponse(BaseModel):
    """A cover letter."""

    id: int
    job_id: int
    job_title: str = ""
    company: str = ""
    resume_id: int | None
    body: str
    created_at: datetime
    updated_at: datetime


class UpdateCoverLetterRequest(BaseModel):
    """The edited text of a cover letter."""

    body: str = Field(max_length=20_000)
