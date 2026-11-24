"""Response shape for the dashboard overview."""

from pydantic import BaseModel

from app.schemas.application import ApplicationCardResponse
from app.schemas.pipeline import PipelineRunResponse


class DashboardSummaryResponse(BaseModel):
    """Counts and recent activity shown on the dashboard."""

    resume_count: int
    job_count: int
    application_counts_by_status: dict[str, int]
    recent_applications: list[ApplicationCardResponse]
    latest_pipeline_run: PipelineRunResponse | None
