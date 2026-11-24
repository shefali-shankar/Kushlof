"""Extracts skills, keywords and responsibilities from a job description using the AI model chosen for 'extract_job_requirements'."""

from pydantic import BaseModel, Field
from sqlmodel import Session

from app.models.job import Job
from app.services.ai.prompts import EXTRACT_JOB_REQUIREMENTS_INSTRUCTIONS, wrap_in_tag
from app.services.ai.provider_registry import get_provider_for_task
from app.services.jobs.job_description_loader import ensure_job_has_description

MAXIMUM_DESCRIPTION_CHARACTERS = 30_000


class JobRequirements(BaseModel):
    """What the AI extracts from a job description."""

    job_title: str = ""
    company: str = ""
    seniority: str = ""
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    ats_keywords: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)


def extract_job_requirements(job: Job, database_session: Session) -> JobRequirements:
    """Analyse the job description, save the results on the job, and fill in a missing title or company."""
    ensure_job_has_description(job, database_session)
    ai_provider = get_provider_for_task("extract_job_requirements", database_session)
    job_text = f"Title: {job.title}\nCompany: {job.company}\n\n{job.description[:MAXIMUM_DESCRIPTION_CHARACTERS]}"
    job_requirements = ai_provider.generate_structured_output(
        EXTRACT_JOB_REQUIREMENTS_INSTRUCTIONS,
        "Analyse this job posting.\n\n" + wrap_in_tag("job_description", job_text),
        JobRequirements,
    )
    job.requirements = job_requirements.model_dump()
    if not job.title.strip() and job_requirements.job_title:
        job.title = job_requirements.job_title[:300]
    if not job.company.strip() and job_requirements.company:
        job.company = job_requirements.company[:300]
    database_session.add(job)
    database_session.commit()
    database_session.refresh(job)
    return job_requirements
