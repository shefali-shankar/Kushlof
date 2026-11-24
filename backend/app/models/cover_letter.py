"""Table for cover letters written for a job."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.timestamps import utc_now


class CoverLetter(SQLModel, table=True):
    """A cover letter for one job, written from one of the user's CVs."""

    __tablename__ = "cover_letters"

    id: int | None = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="jobs.id", index=True)
    resume_id: int | None = Field(default=None, foreign_key="resumes.id")
    body: str = ""
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
