"""API routes for the application board (Kanban)."""

from fastapi import APIRouter, Response, status
from sqlmodel import Session, col, select

from app.api.dependencies import DatabaseSession, get_record_or_404
from app.models.application import Application, ApplicationStatus, ApplicationStatusChange
from app.models.job import Job
from app.models.timestamps import utc_now
from app.schemas.application import (
    ApplicationCardResponse,
    ApplicationDetailResponse,
    CreateApplicationRequest,
    StatusChangeResponse,
    UpdateApplicationRequest,
)
from app.services.applications.application_tracker import change_application_status, get_or_create_application

router = APIRouter(prefix="/applications", tags=["Applications"])


def convert_to_card_response(application: Application, database_session: Session) -> ApplicationCardResponse:
    """Build the board card view of an application, including job details."""
    job = database_session.get(Job, application.job_id)
    return ApplicationCardResponse(
        id=application.id,
        status=ApplicationStatus(application.status),
        job_id=application.job_id,
        job_title=job.title if job else "Deleted job",
        company=job.company if job else "",
        location=job.location if job else "",
        job_url=job.job_url if job else None,
        apply_url=job.apply_url if job else None,
        resume_id=application.resume_id,
        cover_letter_id=application.cover_letter_id,
        notes=application.notes,
        applied_at=application.applied_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def convert_to_detail_response(application: Application, database_session: Session) -> ApplicationDetailResponse:
    """Build the full view of an application with its status history."""
    status_changes = database_session.exec(
        select(ApplicationStatusChange)
        .where(ApplicationStatusChange.application_id == application.id)
        .order_by(col(ApplicationStatusChange.changed_at))
    ).all()
    return ApplicationDetailResponse(
        **convert_to_card_response(application, database_session).model_dump(),
        status_history=[
            StatusChangeResponse(from_status=change.from_status, to_status=change.to_status, changed_at=change.changed_at)
            for change in status_changes
        ],
    )


def list_application_cards(database_session: Session) -> list[ApplicationCardResponse]:
    """Return every application card, most recently updated first."""
    applications = database_session.exec(select(Application).order_by(col(Application.updated_at).desc())).all()
    return [convert_to_card_response(application, database_session) for application in applications]


@router.get("", response_model=list[ApplicationCardResponse])
def list_applications(database_session: DatabaseSession) -> list[ApplicationCardResponse]:
    """List all applications for the board."""
    return list_application_cards(database_session)


@router.post("", response_model=ApplicationDetailResponse, status_code=status.HTTP_201_CREATED)
def create_application(request_body: CreateApplicationRequest, database_session: DatabaseSession) -> ApplicationDetailResponse:
    """Add a job to the board (or return its existing card)."""
    get_record_or_404(database_session, Job, request_body.job_id, "Job")
    return convert_to_detail_response(get_or_create_application(request_body.job_id, database_session), database_session)


@router.get("/{application_id}", response_model=ApplicationDetailResponse)
def get_application(application_id: int, database_session: DatabaseSession) -> ApplicationDetailResponse:
    """Get one application with its history."""
    application = get_record_or_404(database_session, Application, application_id, "Application")
    return convert_to_detail_response(application, database_session)


@router.patch("/{application_id}", response_model=ApplicationDetailResponse)
def update_application(
    application_id: int, request_body: UpdateApplicationRequest, database_session: DatabaseSession
) -> ApplicationDetailResponse:
    """Move an application to another column or change its notes or linked documents."""
    application = get_record_or_404(database_session, Application, application_id, "Application")
    changed_fields = request_body.model_dump(exclude_unset=True)
    if "notes" in changed_fields:
        application.notes = request_body.notes or ""
    if "resume_id" in changed_fields:
        application.resume_id = request_body.resume_id
    if "cover_letter_id" in changed_fields:
        application.cover_letter_id = request_body.cover_letter_id
    application.updated_at = utc_now()
    database_session.add(application)
    database_session.commit()
    database_session.refresh(application)
    if request_body.status is not None:
        application = change_application_status(application, request_body.status, database_session)
    return convert_to_detail_response(application, database_session)


@router.post("/{application_id}/mark-applied", response_model=ApplicationDetailResponse)
def mark_application_as_applied(application_id: int, database_session: DatabaseSession) -> ApplicationDetailResponse:
    """Record that the user has submitted this application."""
    application = get_record_or_404(database_session, Application, application_id, "Application")
    application = change_application_status(application, ApplicationStatus.APPLIED, database_session)
    return convert_to_detail_response(application, database_session)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: int, database_session: DatabaseSession) -> Response:
    """Remove a job from the board (the job itself is kept)."""
    application = get_record_or_404(database_session, Application, application_id, "Application")
    for status_change in database_session.exec(
        select(ApplicationStatusChange).where(ApplicationStatusChange.application_id == application_id)
    ).all():
        database_session.delete(status_change)
    database_session.delete(application)
    database_session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
