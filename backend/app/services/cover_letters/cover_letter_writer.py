"""Writes cover letters using the AI model chosen for 'write_cover_letter'."""

from sqlmodel import Session

from app.models.job import Job
from app.schemas.resume_content import ResumeContent
from app.services.ai.prompts import WRITE_COVER_LETTER_INSTRUCTIONS, wrap_in_tag
from app.services.ai.provider_registry import get_provider_for_task
from app.services.jobs.job_description_loader import ensure_job_has_description
from app.services.resumes.resume_tailor import describe_job_for_prompt


def write_cover_letter(
    resume_content: ResumeContent, job: Job, extra_instructions: str, database_session: Session
) -> str:
    """Return a plain-text cover letter for the job, based on the CV."""
    ensure_job_has_description(job, database_session)
    ai_provider = get_provider_for_task("write_cover_letter", database_session)
    cover_letter_prompt = (
        "Write a cover letter for this job.\n\n"
        + wrap_in_tag("resume", resume_content.model_dump_json(indent=2))
        + "\n\n"
        + wrap_in_tag("job_description", describe_job_for_prompt(job))
    )
    if extra_instructions.strip():
        cover_letter_prompt += f"\n\nAdditional instructions from the candidate: {extra_instructions.strip()}"
    return ai_provider.generate_text(WRITE_COVER_LETTER_INSTRUCTIONS, cover_letter_prompt).strip()
