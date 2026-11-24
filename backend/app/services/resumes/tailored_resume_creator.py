"""The full 'tailor my CV to this job' workflow: analyse the job, tailor, score before/after, and save the new CV."""

from dataclasses import dataclass

from sqlmodel import Session

from app.models.application import ApplicationStatus
from app.models.job import Job
from app.models.resume import Resume
from app.schemas.ats import ATSScoreReport
from app.schemas.resume_content import ResumeContent
from app.services.applications.application_tracker import change_application_status, get_or_create_application
from app.services.jobs.job_description_loader import ensure_job_has_description
from app.services.jobs.requirement_extractor import extract_job_requirements
from app.services.resumes.ats_scorer import calculate_ats_score
from app.services.resumes.keyword_matcher import get_job_keywords
from app.services.resumes.resume_tailor import tailor_resume_to_job


@dataclass
class TailoredResumeResult:
    """The saved tailored CV and how its score changed."""

    tailored_resume: Resume
    score_before: ATSScoreReport
    score_after: ATSScoreReport
    change_notes: list[str]


def create_tailored_resume_for_job(base_resume: Resume, job: Job, database_session: Session) -> TailoredResumeResult:
    """Tailor a CV to a job, save it as a new CV, and link it to the job's board card (moved to 'Ready to apply')."""
    ensure_job_has_description(job, database_session)
    if job.requirements is None:
        extract_job_requirements(job, database_session)

    application = get_or_create_application(job.id, database_session)
    if application.status == ApplicationStatus.SAVED.value:
        change_application_status(application, ApplicationStatus.TAILORING, database_session)

    original_content = ResumeContent.model_validate(base_resume.content)
    job_keywords = get_job_keywords(job.requirements, job.description)
    score_before = calculate_ats_score(original_content, job_keywords)

    tailored_content, change_notes = tailor_resume_to_job(original_content, job, database_session)
    score_after = calculate_ats_score(tailored_content, job_keywords)

    tailored_resume = Resume(
        title=f"{base_resume.title} – {job.company or job.title}"[:200],
        content=tailored_content.model_dump(),
        template_name=base_resume.template_name,
        tailored_for_job_id=job.id,
        based_on_resume_id=base_resume.id,
        tailoring_notes=change_notes,
    )
    database_session.add(tailored_resume)
    database_session.commit()
    database_session.refresh(tailored_resume)

    application.resume_id = tailored_resume.id
    database_session.add(application)
    database_session.commit()
    if application.status in {ApplicationStatus.SAVED.value, ApplicationStatus.TAILORING.value}:
        change_application_status(application, ApplicationStatus.READY_TO_APPLY, database_session)

    return TailoredResumeResult(tailored_resume, score_before, score_after, change_notes)
