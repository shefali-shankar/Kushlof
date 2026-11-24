"""Request and response shapes for the CV API."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.ats import ATSScoreReport
from app.schemas.resume_content import ResumeContent, ResumeSectionName

ResumeTemplateName = Literal["classic", "modern"]


class ResumeSummaryResponse(BaseModel):
    """A CV as shown in lists."""

    id: int
    title: str
    template_name: str
    tailored_for_job_id: int | None
    tailored_for_job_title: str | None = None
    candidate_name: str = ""
    created_at: datetime
    updated_at: datetime


class ResumeDetailResponse(ResumeSummaryResponse):
    """A CV with its full content."""

    content: ResumeContent
    based_on_resume_id: int | None
    tailoring_notes: list[str]
    original_filename: str | None


class CreateBlankResumeRequest(BaseModel):
    """Start a new CV from scratch."""

    title: str = Field(min_length=1, max_length=200)


class UpdateResumeRequest(BaseModel):
    """Fields that can be changed on a CV. Anything left out stays the same."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: ResumeContent | None = None
    template_name: ResumeTemplateName | None = None


class RenderPreviewRequest(BaseModel):
    """CV content to turn into a preview, before it is saved."""

    content: ResumeContent
    template_name: ResumeTemplateName = "classic"


class RenderPreviewResponse(BaseModel):
    """The CV rendered as a standalone HTML document."""

    html: str


class RewriteSectionRequest(BaseModel):
    """Ask the AI to rewrite one section of a CV."""

    section: ResumeSectionName
    instruction: str = Field(min_length=1, max_length=1000)
    job_id: int | None = None


class RewriteSectionResponse(BaseModel):
    """The AI's proposed new version of a section, for the user to accept or reject."""

    section: ResumeSectionName
    original_value: Any
    proposed_value: Any


class AIReviewRequest(BaseModel):
    """Ask the AI to review a CV, optionally against a job."""

    job_id: int | None = None


class TailorResumeRequest(BaseModel):
    """Which base CV to tailor to the job."""

    resume_id: int


class TailorResumeResponse(BaseModel):
    """Result of tailoring: the new CV and how its ATS score changed."""

    tailored_resume_id: int
    score_before: ATSScoreReport
    score_after: ATSScoreReport
    change_notes: list[str]
