"""Tables for job listings and the saved searches used to fetch them."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models.timestamps import utc_now


class Job(SQLModel, table=True):
    """A job listing, either fetched from a job site or imported from a link or pasted text."""

    __tablename__ = "jobs"

    id: int | None = Field(default=None, primary_key=True)
    title: str = Field(default="", max_length=300)
    company: str = Field(default="", max_length=300)
    location: str = Field(default="", max_length=300)
    description: str = ""
    job_url: str | None = Field(default=None, index=True, unique=True, max_length=2000)
    apply_url: str | None = Field(default=None, max_length=2000)
    source: str = Field(default="imported", max_length=50)
    is_remote: bool = False
    salary: str | None = Field(default=None, max_length=200)
    job_type: str | None = Field(default=None, max_length=100)
    date_posted: str | None = Field(default=None, max_length=50)
    # Skills and keywords extracted by AI (see app.services.jobs.requirement_extractor).
    requirements: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_at: datetime = Field(default_factory=utc_now)


class SavedJobSearch(SQLModel, table=True):
    """A job search the user saved so the pipeline can run it again on request."""

    __tablename__ = "saved_job_searches"

    id: int | None = Field(default=None, primary_key=True)
    search_term: str = Field(max_length=200)
    location: str = Field(default="", max_length=200)
    country: str = Field(default="Australia", max_length=100)
    sites: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    results_wanted: int = 20
    hours_old: int = 72
    is_remote: bool = False
    created_at: datetime = Field(default_factory=utc_now)
