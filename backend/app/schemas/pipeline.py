"""Request and response shapes for the application pipeline API."""

from datetime import datetime

from pydantic import BaseModel, Field


class StartPipelineRequest(BaseModel):
    """Options chosen by the user before starting a pipeline run."""

    saved_search_ids: list[int] = Field(min_length=1)
    base_resume_id: int
    minimum_match_score: int = Field(default=60, ge=0, le=100)
    maximum_resumes_to_tailor: int = Field(default=3, ge=0, le=20)
    write_cover_letters: bool = False


class PipelineRunResponse(BaseModel):
    """Progress and results of a pipeline run."""

    id: int
    status: str
    current_step: str
    jobs_fetched: int
    jobs_matched: int
    resumes_tailored: int
    cover_letters_written: int
    error_message: str | None
    activity_log: list[str]
    started_at: datetime
    finished_at: datetime | None
