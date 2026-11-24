"""Table recording each run of the application pipeline (only ever started by the user)."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models.timestamps import utc_now


class PipelineRunStatus(StrEnum):
    """Lifecycle of a pipeline run."""

    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PipelineRun(SQLModel, table=True):
    """Progress and results of one pipeline run."""

    __tablename__ = "pipeline_runs"

    id: int | None = Field(default=None, primary_key=True)
    status: str = Field(default=PipelineRunStatus.RUNNING.value, max_length=20)
    current_step: str = Field(default="Starting", max_length=300)
    jobs_fetched: int = 0
    jobs_matched: int = 0
    resumes_tailored: int = 0
    cover_letters_written: int = 0
    error_message: str | None = None
    activity_log: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    started_at: datetime = Field(default_factory=utc_now)
    finished_at: datetime | None = None
