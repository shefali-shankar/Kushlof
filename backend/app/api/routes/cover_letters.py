"""API routes for cover letters: generate with AI, edit, and export."""

from typing import Literal

from fastapi import APIRouter, Query, Response, status
from sqlmodel import Session, col, select

from app.api.dependencies import DatabaseSession, get_record_or_404
from app.models.application import Application
from app.models.cover_letter import CoverLetter
from app.models.job import Job
from app.models.resume import Resume
from app.models.timestamps import utc_now
from app.schemas.cover_letter import CoverLetterResponse, GenerateCoverLetterRequest, UpdateCoverLetterRequest
from app.schemas.resume_content import ResumeBasics, ResumeContent
from app.services.applications.application_tracker import get_or_create_application
from app.services.cover_letters.cover_letter_writer import write_cover_letter
from app.services.resumes.document_exporter import convert_cover_letter_to_docx, convert_html_to_pdf, make_safe_file_name
from app.services.resumes.resume_renderer import render_cover_letter_html

router = APIRouter(prefix="/cover-letters", tags=["Cover letters"])


def convert_to_response(cover_letter: CoverLetter, database_session: Session) -> CoverLetterResponse:
    """Build the API view of a cover letter, including its job title and company."""
    job = database_session.get(Job, cover_letter.job_id)
    return CoverLetterResponse(
        id=cover_letter.id,
        job_id=cover_letter.job_id,
        job_title=job.title if job else "",
        company=job.company if job else "",
        resume_id=cover_letter.resume_id,
        body=cover_letter.body,
        created_at=cover_letter.created_at,
        updated_at=cover_letter.updated_at,
    )


def load_candidate_basics(cover_letter: CoverLetter, database_session: Session) -> ResumeBasics:
    """Return the name and contact details from the CV the letter was written from."""
    resume = database_session.get(Resume, cover_letter.resume_id) if cover_letter.resume_id else None
    return ResumeContent.model_validate(resume.content).basics if resume else ResumeBasics()


@router.get("", response_model=list[CoverLetterResponse])
def list_cover_letters(database_session: DatabaseSession, job_id: int | None = Query(default=None)) -> list[CoverLetterResponse]:
    """List cover letters, optionally for one job."""
    letters_query = select(CoverLetter).order_by(col(CoverLetter.updated_at).desc())
    if job_id is not None:
        letters_query = letters_query.where(CoverLetter.job_id == job_id)
    return [convert_to_response(cover_letter, database_session) for cover_letter in database_session.exec(letters_query).all()]


@router.post("", response_model=CoverLetterResponse, status_code=status.HTTP_201_CREATED)
def generate_cover_letter(request_body: GenerateCoverLetterRequest, database_session: DatabaseSession) -> CoverLetterResponse:
    """Write a new cover letter with AI and link it to the job's board card."""
    job = get_record_or_404(database_session, Job, request_body.job_id, "Job")
    resume = get_record_or_404(database_session, Resume, request_body.resume_id, "CV")
    letter_body = write_cover_letter(
        ResumeContent.model_validate(resume.content), job, request_body.extra_instructions, database_session
    )
    cover_letter = CoverLetter(job_id=job.id, resume_id=resume.id, body=letter_body)
    database_session.add(cover_letter)
    database_session.commit()
    database_session.refresh(cover_letter)

    application: Application = get_or_create_application(job.id, database_session)
    application.cover_letter_id = cover_letter.id
    database_session.add(application)
    database_session.commit()
    return convert_to_response(cover_letter, database_session)


@router.get("/{cover_letter_id}", response_model=CoverLetterResponse)
def get_cover_letter(cover_letter_id: int, database_session: DatabaseSession) -> CoverLetterResponse:
    """Get one cover letter."""
    return convert_to_response(get_record_or_404(database_session, CoverLetter, cover_letter_id, "Cover letter"), database_session)


@router.patch("/{cover_letter_id}", response_model=CoverLetterResponse)
def update_cover_letter(
    cover_letter_id: int, request_body: UpdateCoverLetterRequest, database_session: DatabaseSession
) -> CoverLetterResponse:
    """Save edits to a cover letter."""
    cover_letter = get_record_or_404(database_session, CoverLetter, cover_letter_id, "Cover letter")
    cover_letter.body = request_body.body
    cover_letter.updated_at = utc_now()
    database_session.add(cover_letter)
    database_session.commit()
    database_session.refresh(cover_letter)
    return convert_to_response(cover_letter, database_session)


@router.delete("/{cover_letter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cover_letter(cover_letter_id: int, database_session: DatabaseSession) -> Response:
    """Delete a cover letter and unlink it from its application."""
    cover_letter = get_record_or_404(database_session, CoverLetter, cover_letter_id, "Cover letter")
    for linked_application in database_session.exec(
        select(Application).where(Application.cover_letter_id == cover_letter_id)
    ).all():
        linked_application.cover_letter_id = None
        database_session.add(linked_application)
    database_session.delete(cover_letter)
    database_session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{cover_letter_id}/export")
def export_cover_letter(
    cover_letter_id: int, database_session: DatabaseSession, file_format: Literal["pdf", "docx"] = Query(alias="format")
) -> Response:
    """Download a cover letter as a PDF or Word file."""
    cover_letter = get_record_or_404(database_session, CoverLetter, cover_letter_id, "Cover letter")
    job = database_session.get(Job, cover_letter.job_id)
    candidate_basics = load_candidate_basics(cover_letter, database_session)
    file_name = make_safe_file_name(f"Cover_Letter_{job.company if job else ''}", "Cover_Letter")
    if file_format == "pdf":
        letter_html = render_cover_letter_html(
            cover_letter.body, candidate_basics, job.title if job else "", job.company if job else ""
        )
        file_bytes = convert_html_to_pdf(letter_html)
        media_type = "application/pdf"
    else:
        file_bytes = convert_cover_letter_to_docx(cover_letter.body, candidate_basics)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}.{file_format}"'},
    )
