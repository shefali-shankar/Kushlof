"""API routes for the application pipeline. A run only ever starts when the user calls POST /pipeline/runs."""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import col, select

from app.api.dependencies import DatabaseSession, get_record_or_404
from app.models.pipeline import PipelineRun
from app.schemas.pipeline import PipelineRunResponse, StartPipelineRequest
from app.services.pipeline.application_pipeline import request_pipeline_cancellation, start_pipeline_run

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])


def convert_to_response(pipeline_run: PipelineRun) -> PipelineRunResponse:
    """Build the API view of a pipeline run."""
    return PipelineRunResponse.model_validate(pipeline_run, from_attributes=True)


@router.post("/runs", response_model=PipelineRunResponse, status_code=status.HTTP_202_ACCEPTED)
def start_run(request_body: StartPipelineRequest, database_session: DatabaseSession) -> PipelineRunResponse:
    """Start a pipeline run now. Progress can be followed with GET /pipeline/runs/{id}."""
    return convert_to_response(start_pipeline_run(request_body, database_session))


@router.get("/runs", response_model=list[PipelineRunResponse])
def list_runs(database_session: DatabaseSession) -> list[PipelineRunResponse]:
    """List the 10 most recent runs."""
    recent_runs = database_session.exec(select(PipelineRun).order_by(col(PipelineRun.started_at).desc()).limit(10)).all()
    return [convert_to_response(pipeline_run) for pipeline_run in recent_runs]


@router.get("/runs/{run_id}", response_model=PipelineRunResponse)
def get_run(run_id: int, database_session: DatabaseSession) -> PipelineRunResponse:
    """Get the progress of one run."""
    return convert_to_response(get_record_or_404(database_session, PipelineRun, run_id, "Pipeline run"))


@router.post("/runs/{run_id}/cancel", response_model=PipelineRunResponse)
def cancel_run(run_id: int, database_session: DatabaseSession) -> PipelineRunResponse:
    """Ask a running pipeline to stop after its current step."""
    pipeline_run = get_record_or_404(database_session, PipelineRun, run_id, "Pipeline run")
    if not request_pipeline_cancellation(run_id):
        raise HTTPException(status_code=409, detail="This run is not in progress.")
    return convert_to_response(pipeline_run)
