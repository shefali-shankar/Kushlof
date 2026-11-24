"""API route for the dashboard overview."""

from fastapi import APIRouter
from sqlmodel import col, func, select

from app.api.dependencies import DatabaseSession
from app.api.routes.applications import list_application_cards
from app.models.application import Application, ApplicationStatus
from app.models.job import Job
from app.models.pipeline import PipelineRun
from app.models.resume import Resume
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.pipeline import PipelineRunResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(database_session: DatabaseSession) -> DashboardSummaryResponse:
    """Return counts and recent activity for the dashboard."""
    status_count_rows = database_session.exec(
        select(Application.status, func.count()).group_by(Application.status)
    ).all()
    counts_by_status = {application_status.value: 0 for application_status in ApplicationStatus}
    counts_by_status.update({status_name: status_count for status_name, status_count in status_count_rows})

    latest_run = database_session.exec(select(PipelineRun).order_by(col(PipelineRun.started_at).desc())).first()
    return DashboardSummaryResponse(
        resume_count=database_session.exec(select(func.count()).select_from(Resume)).one(),
        job_count=database_session.exec(select(func.count()).select_from(Job)).one(),
        application_counts_by_status=counts_by_status,
        recent_applications=list_application_cards(database_session)[:6],
        latest_pipeline_run=PipelineRunResponse.model_validate(latest_run, from_attributes=True) if latest_run else None,
    )
