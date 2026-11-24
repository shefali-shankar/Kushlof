"""AI help for improving a CV: rewriting one section on request, and expert review suggestions."""

from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlmodel import Session

from app.models.job import Job
from app.schemas.ats import ResumeSuggestion
from app.schemas.resume_content import (
    Certification,
    Education,
    Project,
    ResumeContent,
    ResumeSectionName,
    SkillGroup,
    WorkExperience,
)
from app.services.ai.prompts import (
    REVIEW_RESUME_INSTRUCTIONS,
    REWRITE_SECTION_INSTRUCTIONS,
    wrap_in_tag,
)
from app.services.ai.provider_registry import get_provider_for_task
from app.services.resumes.fact_protection import protect_resume_facts
from app.services.resumes.resume_tailor import describe_job_for_prompt


class SummarySection(BaseModel):
    summary: str


class WorkSection(BaseModel):
    work: list[WorkExperience]


class EducationSection(BaseModel):
    education: list[Education]


class SkillsSection(BaseModel):
    skills: list[SkillGroup]


class ProjectsSection(BaseModel):
    projects: list[Project]


class CertificationsSection(BaseModel):
    certifications: list[Certification]


SECTION_OUTPUT_MODELS: dict[str, type[BaseModel]] = {
    "summary": SummarySection,
    "work": WorkSection,
    "education": EducationSection,
    "skills": SkillsSection,
    "projects": ProjectsSection,
    "certifications": CertificationsSection,
}


class AIReviewSuggestion(BaseModel):
    section: Literal["basics", "summary", "work", "education", "skills", "projects", "certifications", "general"]
    message: str
    severity: Literal["high", "medium", "low"] = "medium"


class AIReviewResult(BaseModel):
    suggestions: list[AIReviewSuggestion] = Field(default_factory=list)


def get_section_value(resume_content: ResumeContent, section_name: ResumeSectionName) -> Any:
    """Return one section of the CV as plain JSON-compatible data."""
    return resume_content.model_dump()[section_name]


def rewrite_resume_section(
    resume_content: ResumeContent,
    section_name: ResumeSectionName,
    instruction: str,
    job: Job | None,
    database_session: Session,
) -> Any:
    """Ask the AI to rewrite one section and return the proposed new value (not saved until the user accepts)."""
    ai_provider = get_provider_for_task("rewrite_section", database_session)
    output_model = SECTION_OUTPUT_MODELS[section_name]
    rewrite_prompt = (
        f"Rewrite the '{section_name}' section of this CV.\n"
        f"User's instruction: {instruction}\n\n"
        + wrap_in_tag("current_section", output_model.model_validate(
            {section_name: get_section_value(resume_content, section_name)}
        ).model_dump_json(indent=2))
        + "\n\nFull CV for context:\n"
        + wrap_in_tag("resume", resume_content.model_dump_json(indent=2))
    )
    if job is not None:
        rewrite_prompt += "\n\nTarget job:\n" + wrap_in_tag("job_description", describe_job_for_prompt(job))

    rewritten_section = ai_provider.generate_structured_output(
        REWRITE_SECTION_INSTRUCTIONS, rewrite_prompt, output_model
    )
    edited_content = resume_content.model_copy(update={section_name: getattr(rewritten_section, section_name)})
    protected_content, _ = protect_resume_facts(resume_content, edited_content)
    return get_section_value(protected_content, section_name)


def review_resume_with_ai(
    resume_content: ResumeContent, job: Job | None, database_session: Session
) -> list[ResumeSuggestion]:
    """Ask the AI for expert improvement suggestions."""
    ai_provider = get_provider_for_task("review_resume", database_session)
    review_prompt = "Review this CV.\n\n" + wrap_in_tag("resume", resume_content.model_dump_json(indent=2))
    if job is not None:
        review_prompt += "\n\nTarget job:\n" + wrap_in_tag("job_description", describe_job_for_prompt(job))
    review_result = ai_provider.generate_structured_output(REVIEW_RESUME_INSTRUCTIONS, review_prompt, AIReviewResult)
    return [
        ResumeSuggestion(section=suggestion.section, message=suggestion.message, severity=suggestion.severity, source="ai")
        for suggestion in review_result.suggestions
    ]
