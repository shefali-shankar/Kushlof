"""Request and response shapes for the jobs API."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl

JobSiteName = Literal["linkedin", "indeed", "glassdoor", "google", "zip_recruiter"]


class JobSummaryResponse(BaseModel):
    """A job as shown in lists."""

    id: int
    title: str
    company: str
    location: str
    source: str
    is_remote: bool
    salary: str | None
    job_type: str | None
    date_posted: str | None
    job_url: str | None
    created_at: datetime
    application_status: str | None = None


class JobDetailResponse(JobSummaryResponse):
    """A job with its full description and AI-extracted requirements."""

    description: str
    apply_url: str | None
    requirements: dict[str, Any] | None
    application_id: int | None = None


class FetchJobsRequest(BaseModel):
    """Search settings for fetching jobs from job sites."""

    search_term: str = Field(min_length=2, max_length=200)
    location: str = Field(default="", max_length=200)
    country: str = Field(default="Australia", max_length=100)
    sites: list[JobSiteName] = Field(default_factory=lambda: ["linkedin", "indeed"], min_length=1)
    results_wanted: int = Field(default=20, ge=1, le=50)
    hours_old: int = Field(default=72, ge=1, le=720)
    is_remote: bool = False


class FetchJobsResponse(BaseModel):
    """How many jobs were found and how many were new."""

    jobs_found: int
    new_jobs: int


class ImportJobRequest(BaseModel):
    """Import one job from a link, or from pasted job description text."""

    url: HttpUrl | None = None
    pasted_description: str | None = Field(default=None, max_length=50_000)
    title: str | None = Field(default=None, max_length=300)
    company: str | None = Field(default=None, max_length=300)


class UpdateJobDescriptionRequest(BaseModel):
    """Description text the user pasted for a job that was saved without one."""

    description: str = Field(min_length=50, max_length=50_000)


class JobMatchResponse(BaseModel):
    """A job ranked by how well it fits a CV."""

    job: JobSummaryResponse
    match_score: int
    matched_keywords: list[str]


class FindJobsForResumeRequest(BaseModel):
    """Fetch new jobs using search terms taken from a CV."""

    resume_id: int
    location: str = Field(default="", max_length=200)
    country: str = Field(default="Australia", max_length=100)
    sites: list[JobSiteName] = Field(default_factory=lambda: ["linkedin", "indeed"], min_length=1)
    results_wanted: int = Field(default=20, ge=1, le=50)


class SavedJobSearchRequest(BaseModel):
    """A search to save for the pipeline."""

    search_term: str = Field(min_length=2, max_length=200)
    location: str = Field(default="", max_length=200)
    country: str = Field(default="Australia", max_length=100)
    sites: list[JobSiteName] = Field(default_factory=lambda: ["linkedin", "indeed"], min_length=1)
    results_wanted: int = Field(default=20, ge=1, le=50)
    hours_old: int = Field(default=72, ge=1, le=720)
    is_remote: bool = False


class SavedJobSearchResponse(SavedJobSearchRequest):
    """A saved search."""

    id: int
    created_at: datetime
