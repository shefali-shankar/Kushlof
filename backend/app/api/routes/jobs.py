"""API routes for jobs: list, fetch from job sites, import from a link, analyse, match to a CV, and tailor."""

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlmodel import Session, col, or_, select

from app.api.dependencies import DatabaseSession, get_record_or_404
from app.models.application import Application, ApplicationStatusChange
from app.models.cover_letter import CoverLetter
from app.models.job import Job, SavedJobSearch
from app.models.resume import Resume
from app.schemas.job import (
    FetchJobsRequest,
    FetchJobsResponse,
    FindJobsForResumeRequest,
    ImportJobRequest,
    JobDetailResponse,
    JobMatchResponse,
    JobSummaryResponse,
    SavedJobSearchRequest,
    SavedJobSearchResponse,
    UpdateJobDescriptionRequest,
)
from app.schemas.resume import TailorResumeRequest, TailorResumeResponse
from app.schemas.resume_content import ResumeContent
from app.services.jobs.job_description_loader import ensure_job_has_description
from app.services.jobs.job_link_importer import import_job_from_url
from app.services.jobs.job_matcher import rank_jobs_for_resume, suggest_search_term_from_resume
from app.services.jobs.jobspy_fetcher import fetch_and_save_jobs
from app.services.jobs.requirement_extractor import extract_job_requirements
from app.services.resumes.tailored_resume_creator import create_tailored_resume_for_job

router = APIRouter(prefix="/jobs", tags=["Jobs"])

MAXIMUM_JOBS_TO_RANK = 500


def find_application_for_job(job_id: int, database_session: Session) -> Application | None:
    """Return the board card for a job, if the user is tracking it."""
    return database_session.exec(select(Application).where(Application.job_id == job_id)).first()


def convert_to_summary_response(job: Job, database_session: Session) -> JobSummaryResponse:
    """Build the list view of a job, including its board status."""
    application = find_application_for_job(job.id, database_session)
    return JobSummaryResponse(
        **job.model_dump(include=set(JobSummaryResponse.model_fields) - {"application_status"}),
        application_status=application.status if application else None,
    )


def convert_to_detail_response(job: Job, database_session: Session) -> JobDetailResponse:
    """Build the full view of a job."""
    application = find_application_for_job(job.id, database_session)
    return JobDetailResponse(
        **convert_to_summary_response(job, database_session).model_dump(),
        description=job.description,
        apply_url=job.apply_url,
        requirements=job.requirements,
        application_id=application.id if application else None,
    )


@router.get("", response_model=list[JobSummaryResponse])
def list_jobs(
    database_session: DatabaseSession,
    search: str = Query(default="", max_length=200),
    source: str = Query(default="", max_length=50),
    remote_only: bool = False,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[JobSummaryResponse]:
    """List saved jobs, newest first, with optional search and filters."""
    jobs_query = select(Job)
    if search.strip():
        search_pattern = f"%{search.strip()}%"
        jobs_query = jobs_query.where(
            or_(col(Job.title).ilike(search_pattern), col(Job.company).ilike(search_pattern), col(Job.location).ilike(search_pattern))
        )
    if source:
        jobs_query = jobs_query.where(Job.source == source)
    if remote_only:
        jobs_query = jobs_query.where(Job.is_remote == True)  # noqa: E712 - SQL comparison
    jobs = database_session.exec(jobs_query.order_by(col(Job.created_at).desc()).offset(offset).limit(limit)).all()
    return [convert_to_summary_response(job, database_session) for job in jobs]


@router.post("/fetch", response_model=FetchJobsResponse)
def fetch_jobs_from_job_sites(request_body: FetchJobsRequest, database_session: DatabaseSession) -> FetchJobsResponse:
    """Search LinkedIn, Indeed and other sites now, and save the results."""
    jobs_found, new_job_count = fetch_and_save_jobs(database_session, **request_body.model_dump())
    return FetchJobsResponse(jobs_found=len(jobs_found), new_jobs=new_job_count)


@router.post("/import", response_model=JobDetailResponse, status_code=status.HTTP_201_CREATED)
def import_job(request_body: ImportJobRequest, database_session: DatabaseSession) -> JobDetailResponse:
    """Import a job from a link, or from pasted description text."""
    if request_body.url is None and not (request_body.pasted_description or "").strip():
        raise HTTPException(status_code=400, detail="Paste a job link or the job description text.")

    if request_body.url is not None:
        job_url = str(request_body.url)
        existing_job = database_session.exec(select(Job).where(Job.job_url == job_url)).first()
        if existing_job:
            return convert_to_detail_response(existing_job, database_session)
        imported_details = import_job_from_url(job_url)
        new_job = Job(
            title=(request_body.title or imported_details.title)[:300],
            company=(request_body.company or imported_details.company)[:300],
            location=imported_details.location[:300],
            description=imported_details.description,
            job_url=job_url,
            apply_url=job_url,
            source=imported_details.source,
            is_remote=imported_details.is_remote,
        )
    else:
        new_job = Job(
            title=(request_body.title or "")[:300],
            company=(request_body.company or "")[:300],
            description=(request_body.pasted_description or "").strip(),
            source="pasted",
        )
    database_session.add(new_job)
    database_session.commit()
    database_session.refresh(new_job)

    # Pasted text often has no title/company; the AI analysis fills them in.
    if not new_job.title or not new_job.company:
        try:
            extract_job_requirements(new_job, database_session)
        except Exception:  # Analysis is a bonus here; the import itself succeeded.
            if not new_job.title:
                new_job.title = "Untitled job"
                database_session.add(new_job)
                database_session.commit()
                database_session.refresh(new_job)
    return convert_to_detail_response(new_job, database_session)


@router.get("/matches", response_model=list[JobMatchResponse])
def get_job_matches_for_resume(
    database_session: DatabaseSession,
    resume_id: int = Query(),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[JobMatchResponse]:
    """Rank saved jobs by how well they fit a CV."""
    resume = get_record_or_404(database_session, Resume, resume_id, "CV")
    recent_jobs = database_session.exec(select(Job).order_by(col(Job.created_at).desc()).limit(MAXIMUM_JOBS_TO_RANK)).all()
    job_matches = rank_jobs_for_resume(ResumeContent.model_validate(resume.content), list(recent_jobs))[:limit]
    return [
        JobMatchResponse(
            job=convert_to_summary_response(job_match.job, database_session),
            match_score=job_match.match_score,
            matched_keywords=job_match.matched_keywords,
        )
        for job_match in job_matches
    ]


@router.post("/find-for-resume", response_model=FetchJobsResponse)
def find_jobs_for_resume(request_body: FindJobsForResumeRequest, database_session: DatabaseSession) -> FetchJobsResponse:
    """Search job sites using the job title from a CV."""
    resume = get_record_or_404(database_session, Resume, request_body.resume_id, "CV")
    search_term = suggest_search_term_from_resume(ResumeContent.model_validate(resume.content))
    jobs_found, new_job_count = fetch_and_save_jobs(
        database_session,
        search_term=search_term,
        location=request_body.location,
        country=request_body.country,
        sites=list(request_body.sites),
        results_wanted=request_body.results_wanted,
        hours_old=168,
        is_remote=False,
    )
    return FetchJobsResponse(jobs_found=len(jobs_found), new_jobs=new_job_count)


@router.get("/saved-searches", response_model=list[SavedJobSearchResponse])
def list_saved_searches(database_session: DatabaseSession) -> list[SavedJobSearchResponse]:
    """List searches saved for the pipeline."""
    saved_searches = database_session.exec(select(SavedJobSearch).order_by(col(SavedJobSearch.created_at).desc())).all()
    return [SavedJobSearchResponse.model_validate(saved_search, from_attributes=True) for saved_search in saved_searches]


@router.post("/saved-searches", response_model=SavedJobSearchResponse, status_code=status.HTTP_201_CREATED)
def create_saved_search(request_body: SavedJobSearchRequest, database_session: DatabaseSession) -> SavedJobSearchResponse:
    """Save a search so the pipeline can run it."""
    saved_search = SavedJobSearch(**request_body.model_dump())
    database_session.add(saved_search)
    database_session.commit()
    database_session.refresh(saved_search)
    return SavedJobSearchResponse.model_validate(saved_search, from_attributes=True)


@router.delete("/saved-searches/{saved_search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(saved_search_id: int, database_session: DatabaseSession) -> Response:
    """Delete a saved search."""
    database_session.delete(get_record_or_404(database_session, SavedJobSearch, saved_search_id, "Saved search"))
    database_session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{job_id}", response_model=JobDetailResponse)
def get_job(job_id: int, database_session: DatabaseSession) -> JobDetailResponse:
    """Get one job with its description and analysis."""
    return convert_to_detail_response(get_record_or_404(database_session, Job, job_id, "Job"), database_session)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, database_session: DatabaseSession) -> Response:
    """Delete a job, its board card and cover letters. Tailored CVs are kept but unlinked."""
    job = get_record_or_404(database_session, Job, job_id, "Job")
    application = find_application_for_job(job_id, database_session)
    if application:
        for status_change in database_session.exec(
            select(ApplicationStatusChange).where(ApplicationStatusChange.application_id == application.id)
        ).all():
            database_session.delete(status_change)
        database_session.delete(application)
    for cover_letter in database_session.exec(select(CoverLetter).where(CoverLetter.job_id == job_id)).all():
        database_session.delete(cover_letter)
    for tailored_resume in database_session.exec(select(Resume).where(Resume.tailored_for_job_id == job_id)).all():
        tailored_resume.tailored_for_job_id = None
        database_session.add(tailored_resume)
    database_session.delete(job)
    database_session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{job_id}/load-description", response_model=JobDetailResponse)
def load_job_description(job_id: int, database_session: DatabaseSession) -> JobDetailResponse:
    """Download the description of a job that was saved without one (LinkedIn search results)."""
    job = get_record_or_404(database_session, Job, job_id, "Job")
    ensure_job_has_description(job, database_session)
    return convert_to_detail_response(job, database_session)


@router.put("/{job_id}/description", response_model=JobDetailResponse)
def update_job_description(
    job_id: int, request_body: UpdateJobDescriptionRequest, database_session: DatabaseSession
) -> JobDetailResponse:
    """Save description text the user pasted. Any earlier AI analysis is cleared because it was based on the old text."""
    job = get_record_or_404(database_session, Job, job_id, "Job")
    job.description = request_body.description.strip()
    job.requirements = None
    database_session.add(job)
    database_session.commit()
    database_session.refresh(job)
    return convert_to_detail_response(job, database_session)


@router.post("/{job_id}/analyze", response_model=JobDetailResponse)
def analyze_job(job_id: int, database_session: DatabaseSession) -> JobDetailResponse:
    """Use AI to extract the job's skills and keywords."""
    job = get_record_or_404(database_session, Job, job_id, "Job")
    extract_job_requirements(job, database_session)
    return convert_to_detail_response(job, database_session)


@router.post("/{job_id}/tailor", response_model=TailorResumeResponse)
def tailor_resume_for_job(job_id: int, request_body: TailorResumeRequest, database_session: DatabaseSession) -> TailorResumeResponse:
    """Create a copy of a CV tailored to this job and report how its ATS score changed."""
    job = get_record_or_404(database_session, Job, job_id, "Job")
    base_resume = get_record_or_404(database_session, Resume, request_body.resume_id, "CV")
    tailoring_result = create_tailored_resume_for_job(base_resume, job, database_session)
    return TailorResumeResponse(
        tailored_resume_id=tailoring_result.tailored_resume.id,
        score_before=tailoring_result.score_before,
        score_after=tailoring_result.score_after,
        change_notes=tailoring_result.change_notes,
    )
