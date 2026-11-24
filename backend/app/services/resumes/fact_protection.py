"""Safety net applied after every AI edit: restores facts the AI must never change, and flags anything suspicious.

The prompts already forbid inventing information. This code enforces it for the facts that can be
checked automatically (employers, titles, dates, education, certifications, skills, numbers).
"""

import re

from app.schemas.resume_content import Project, ResumeContent, WorkExperience
from app.services.resumes.keyword_matcher import does_text_contain_keyword, normalise_keyword
from app.services.resumes.resume_text import convert_resume_to_plain_text

NUMBER_TOKEN_PATTERN = re.compile(r"\d+(?:[.,]\d+)?")


def restore_work_facts(original_jobs: list[WorkExperience], edited_jobs: list[WorkExperience]) -> list[WorkExperience]:
    """Keep the AI's improved bullets but always use the original company, position, location and dates."""
    edited_jobs_by_company = {normalise_keyword(job.company): job for job in edited_jobs}
    protected_jobs: list[WorkExperience] = []
    for job_index, original_job in enumerate(original_jobs):
        if len(edited_jobs) == len(original_jobs):
            matching_edited_job = edited_jobs[job_index]
        else:
            matching_edited_job = edited_jobs_by_company.get(normalise_keyword(original_job.company))
        improved_highlights = matching_edited_job.highlights if matching_edited_job else original_job.highlights
        protected_jobs.append(original_job.model_copy(update={"highlights": improved_highlights}))
    return protected_jobs


def restore_project_facts(original_projects: list[Project], edited_projects: list[Project]) -> list[Project]:
    """Keep the AI's improved descriptions but always use the original project names and links."""
    if len(edited_projects) != len(original_projects):
        return original_projects
    return [
        edited_project.model_copy(update={"name": original_project.name, "url": original_project.url})
        for original_project, edited_project in zip(original_projects, edited_projects, strict=True)
    ]


def remove_unsupported_skills(original_content: ResumeContent, edited_content: ResumeContent) -> None:
    """Drop any skill the AI added that does not appear anywhere in the original CV (edits in place)."""
    original_text_lowercase = convert_resume_to_plain_text(original_content).lower()
    for skill_group in edited_content.skills:
        skill_group.keywords = [
            skill for skill in skill_group.keywords
            if does_text_contain_keyword(original_text_lowercase, normalise_keyword(skill))
        ]
    edited_content.skills = [group for group in edited_content.skills if group.keywords]


def find_bullets_with_new_numbers(original_content: ResumeContent, edited_content: ResumeContent) -> list[str]:
    """Return edited bullets containing numbers that were not in the original CV, so the user can check them."""
    original_numbers = set(NUMBER_TOKEN_PATTERN.findall(convert_resume_to_plain_text(original_content)))
    suspicious_bullets: list[str] = []
    for job in edited_content.work:
        for bullet in job.highlights:
            if any(number not in original_numbers for number in NUMBER_TOKEN_PATTERN.findall(bullet)):
                suspicious_bullets.append(bullet)
    return suspicious_bullets


def protect_resume_facts(original_content: ResumeContent, edited_content: ResumeContent) -> tuple[ResumeContent, list[str]]:
    """Return the AI-edited CV with protected facts restored, plus warnings for the user to review."""
    protected_content = edited_content.model_copy(deep=True)
    protected_content.basics = original_content.basics.model_copy()
    protected_content.education = [entry.model_copy() for entry in original_content.education]
    protected_content.certifications = [entry.model_copy() for entry in original_content.certifications]
    protected_content.work = restore_work_facts(original_content.work, edited_content.work)
    protected_content.projects = restore_project_facts(original_content.projects, edited_content.projects)
    remove_unsupported_skills(original_content, protected_content)

    review_warnings = [
        f"Please check this bullet — it contains a number not found in your original CV: \"{bullet}\""
        for bullet in find_bullets_with_new_numbers(original_content, protected_content)
    ]
    return protected_content, review_warnings
