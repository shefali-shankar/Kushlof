"""API routes for CVs: upload, edit, preview, score, improve with AI, and export."""

from typing import Literal

from fastapi import APIRouter, File, Query, Response, UploadFile, status
from sqlmodel import Session, col, select

from app.api.dependencies import DatabaseSession, get_record_or_404
from app.core.config import settings
from app.core.file_validation import detect_resume_file_type
from app.models.application import Application
from app.models.job import Job
from app.models.resume import Resume
from app.models.timestamps import utc_now
from app.schemas.ats import ATSScoreReport, ResumeSuggestion
from app.schemas.resume import (
    AIReviewRequest,
    CreateBlankResumeRequest,
    RenderPreviewRequest,
    RenderPreviewResponse,
    ResumeDetailResponse,
    ResumeSummaryResponse,
    RewriteSectionRequest,
    RewriteSectionResponse,
    UpdateResumeRequest,
)
from app.schemas.resume_content import ResumeContent
from app.services.resumes.ats_scorer import calculate_ats_score
from app.services.resumes.document_exporter import convert_html_to_pdf, convert_resume_to_docx, make_safe_file_name
from app.services.resumes.keyword_matcher import get_job_keywords
from app.services.resumes.resume_improver import get_section_value, review_resume_with_ai, rewrite_resume_section
from app.services.resumes.resume_parser import convert_resume_text_to_structured_content
from app.services.resumes.resume_renderer import render_resume_html
from app.services.resumes.text_extractor import extract_resume_text

router = APIRouter(prefix="/resumes", tags=["CVs"])


def convert_to_summary_response(resume: Resume, database_session: Session) -> ResumeSummaryResponse:
    """Build the list view of a CV, including the job title if it was tailored."""
    tailored_job = database_session.get(Job, resume.tailored_for_job_id) if resume.tailored_for_job_id else None
    return ResumeSummaryResponse(
        id=resume.id,
        title=resume.title,
        template_name=resume.template_name,
        tailored_for_job_id=resume.tailored_for_job_id,
        tailored_for_job_title=f"{tailored_job.title} at {tailored_job.company}" if tailored_job else None,
        candidate_name=resume.content.get("basics", {}).get("name", ""),
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


def convert_to_detail_response(resume: Resume, database_session: Session) -> ResumeDetailResponse:
    """Build the full view of a CV."""
    return ResumeDetailResponse(
        **convert_to_summary_response(resume, database_session).model_dump(),
        content=ResumeContent.model_validate(resume.content),
        based_on_resume_id=resume.based_on_resume_id,
        tailoring_notes=resume.tailoring_notes,
        original_filename=resume.original_filename,
    )


def load_job_keywords(job_id: int | None, database_session: Session) -> tuple[Job | None, list[str] | None]:
    """Return the job (if given) and the keywords a CV should contain for it."""
    if job_id is None:
        return None, None
    job = get_record_or_404(database_session, Job, job_id, "Job")
    return job, get_job_keywords(job.requirements, job.description)


@router.get("", response_model=list[ResumeSummaryResponse])
def list_resumes(database_session: DatabaseSession) -> list[ResumeSummaryResponse]:
    """List all CVs, newest first."""
    resumes = database_session.exec(select(Resume).order_by(col(Resume.updated_at).desc())).all()
    return [convert_to_summary_response(resume, database_session) for resume in resumes]


@router.post("/upload", response_model=ResumeDetailResponse, status_code=status.HTTP_201_CREATED)
def upload_resume(database_session: DatabaseSession, uploaded_file: UploadFile = File(...)) -> ResumeDetailResponse:
    """Upload a PDF or Word CV; the AI splits it into editable sections. The file itself is not kept."""
    file_bytes = uploaded_file.file.read(settings.maximum_upload_size_bytes + 1)
    file_type = detect_resume_file_type(file_bytes)
    resume_text = extract_resume_text(file_bytes, file_type)
    resume_content = convert_resume_text_to_structured_content(resume_text, database_session)
    original_filename = (uploaded_file.filename or "CV")[:255]
    new_resume = Resume(
        title=resume_content.basics.name or original_filename.rsplit(".", 1)[0],
        content=resume_content.model_dump(),
        original_filename=original_filename,
    )
    database_session.add(new_resume)
    database_session.commit()
    database_session.refresh(new_resume)
    return convert_to_detail_response(new_resume, database_session)


@router.post("", response_model=ResumeDetailResponse, status_code=status.HTTP_201_CREATED)
def create_blank_resume(request_body: CreateBlankResumeRequest, database_session: DatabaseSession) -> ResumeDetailResponse:
    """Start a new empty CV."""
    new_resume = Resume(title=request_body.title, content=ResumeContent().model_dump())
    database_session.add(new_resume)
    database_session.commit()
    database_session.refresh(new_resume)
    return convert_to_detail_response(new_resume, database_session)


@router.post("/preview", response_model=RenderPreviewResponse)
def render_resume_preview(request_body: RenderPreviewRequest) -> RenderPreviewResponse:
    """Render unsaved CV content as HTML for the live preview."""
    return RenderPreviewResponse(html=render_resume_html(request_body.content, request_body.template_name))


@router.get("/{resume_id}", response_model=ResumeDetailResponse)
def get_resume(resume_id: int, database_session: DatabaseSession) -> ResumeDetailResponse:
    """Get one CV with its full content."""
    return convert_to_detail_response(get_record_or_404(database_session, Resume, resume_id, "CV"), database_session)


@router.patch("/{resume_id}", response_model=ResumeDetailResponse)
def update_resume(resume_id: int, request_body: UpdateResumeRequest, database_session: DatabaseSession) -> ResumeDetailResponse:
    """Save changes to a CV's title, content or design."""
    resume = get_record_or_404(database_session, Resume, resume_id, "CV")
    if request_body.title is not None:
        resume.title = request_body.title
    if request_body.content is not None:
        resume.content = request_body.content.model_dump()
    if request_body.template_name is not None:
        resume.template_name = request_body.template_name
    resume.updated_at = utc_now()
    database_session.add(resume)
    database_session.commit()
    database_session.refresh(resume)
    return convert_to_detail_response(resume, database_session)


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(resume_id: int, database_session: DatabaseSession) -> Response:
    """Delete a CV and unlink it from any applications and tailored copies."""
    resume = get_record_or_404(database_session, Resume, resume_id, "CV")
    for linked_application in database_session.exec(select(Application).where(Application.resume_id == resume_id)).all():
        linked_application.resume_id = None
        database_session.add(linked_application)
    for tailored_copy in database_session.exec(select(Resume).where(Resume.based_on_resume_id == resume_id)).all():
        tailored_copy.based_on_resume_id = None
        database_session.add(tailored_copy)
    database_session.delete(resume)
    database_session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{resume_id}/duplicate", response_model=ResumeDetailResponse, status_code=status.HTTP_201_CREATED)
def duplicate_resume(resume_id: int, database_session: DatabaseSession) -> ResumeDetailResponse:
    """Make an editable copy of a CV."""
    original_resume = get_record_or_404(database_session, Resume, resume_id, "CV")
    copied_resume = Resume(
        title=f"{original_resume.title} (copy)"[:200],
        content=dict(original_resume.content),
        template_name=original_resume.template_name,
    )
    database_session.add(copied_resume)
    database_session.commit()
    database_session.refresh(copied_resume)
    return convert_to_detail_response(copied_resume, database_session)


@router.get("/{resume_id}/ats-score", response_model=ATSScoreReport)
def get_resume_ats_score(
    resume_id: int, database_session: DatabaseSession, job_id: int | None = Query(default=None)
) -> ATSScoreReport:
    """Score a CV, optionally against a specific job."""
    resume = get_record_or_404(database_session, Resume, resume_id, "CV")
    _, job_keywords = load_job_keywords(job_id, database_session)
    return calculate_ats_score(ResumeContent.model_validate(resume.content), job_keywords)


@router.post("/{resume_id}/ai-review", response_model=list[ResumeSuggestion])
def get_ai_review(resume_id: int, request_body: AIReviewRequest, database_session: DatabaseSession) -> list[ResumeSuggestion]:
    """Ask the AI for expert suggestions on a CV."""
    resume = get_record_or_404(database_session, Resume, resume_id, "CV")
    job, _ = load_job_keywords(request_body.job_id, database_session)
    return review_resume_with_ai(ResumeContent.model_validate(resume.content), job, database_session)


@router.post("/{resume_id}/rewrite-section", response_model=RewriteSectionResponse)
def rewrite_section(resume_id: int, request_body: RewriteSectionRequest, database_session: DatabaseSession) -> RewriteSectionResponse:
    """Ask the AI to rewrite one section. Returns a proposal; nothing is saved until the user accepts it."""
    resume = get_record_or_404(database_session, Resume, resume_id, "CV")
    job, _ = load_job_keywords(request_body.job_id, database_session)
    resume_content = ResumeContent.model_validate(resume.content)
    proposed_value = rewrite_resume_section(
        resume_content, request_body.section, request_body.instruction, job, database_session
    )
    return RewriteSectionResponse(
        section=request_body.section,
        original_value=get_section_value(resume_content, request_body.section),
        proposed_value=proposed_value,
    )


@router.get("/{resume_id}/export")
def export_resume(
    resume_id: int, database_session: DatabaseSession, file_format: Literal["pdf", "docx"] = Query(alias="format")
) -> Response:
    """Download a CV as a PDF or Word file."""
    resume = get_record_or_404(database_session, Resume, resume_id, "CV")
    resume_content = ResumeContent.model_validate(resume.content)
    file_name = make_safe_file_name(resume_content.basics.name or resume.title, "CV") + "_CV"
    if file_format == "pdf":
        file_bytes = convert_html_to_pdf(render_resume_html(resume_content, resume.template_name))
        media_type = "application/pdf"
    else:
        file_bytes = convert_resume_to_docx(resume_content)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}.{file_format}"'},
    )
