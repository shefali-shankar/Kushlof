"""Table for CVs. A tailored CV is a copy of a base CV linked to the job it was tailored for."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models.timestamps import utc_now


class Resume(SQLModel, table=True):
    """A CV stored as structured content (see app.schemas.resume_content.ResumeContent)."""

    __tablename__ = "resumes"

    id: int | None = Field(default=None, primary_key=True)
    title: str = Field(max_length=200)
    content: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    template_name: str = Field(default="classic", max_length=50)
    original_filename: str | None = Field(default=None, max_length=255)
    tailored_for_job_id: int | None = Field(default=None, foreign_key="jobs.id", index=True)
    based_on_resume_id: int | None = Field(default=None, foreign_key="resumes.id")
    tailoring_notes: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
