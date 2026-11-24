"""Tailors a CV to a specific job using the AI model chosen for 'tailor_resume'."""

import json

from pydantic import BaseModel, Field
from sqlmodel import Session

from app.models.job import Job
from app.schemas.resume_content import ResumeContent
from app.services.ai.prompts import TAILOR_RESUME_INSTRUCTIONS, wrap_in_tag
from app.services.ai.provider_registry import get_provider_for_task
from app.services.resumes.fact_protection import protect_resume_facts


class TailoringResult(BaseModel):
    """What the AI returns when tailoring a CV."""

    tailored_resume: ResumeContent
    change_notes: list[str] = Field(default_factory=list)


def describe_job_for_prompt(job: Job) -> str:
    """Build the job section of a prompt: title, company, extracted requirements and description."""
    job_summary = f"Job title: {job.title}\nCompany: {job.company}\nLocation: {job.location}\n"
    if job.requirements:
        job_summary += f"Extracted requirements: {json.dumps(job.requirements)}\n"
    return job_summary + f"\nFull description:\n{job.description}"


def tailor_resume_to_job(
    original_content: ResumeContent, job: Job, database_session: Session
) -> tuple[ResumeContent, list[str]]:
    """Return a tailored copy of the CV and a list of change notes (including any facts to double-check)."""
    ai_provider = get_provider_for_task("tailor_resume", database_session)
    tailoring_prompt = (
        "Tailor this CV to the job below.\n\n"
        + wrap_in_tag("resume", original_content.model_dump_json(indent=2))
        + "\n\n"
        + wrap_in_tag("job_description", describe_job_for_prompt(job))
    )
    tailoring_result = ai_provider.generate_structured_output(
        TAILOR_RESUME_INSTRUCTIONS, tailoring_prompt, TailoringResult
    )
    protected_content, review_warnings = protect_resume_facts(original_content, tailoring_result.tailored_resume)
    return protected_content, tailoring_result.change_notes + review_warnings
