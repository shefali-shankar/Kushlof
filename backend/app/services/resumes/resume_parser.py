"""Turns raw CV text into structured, editable CV content using the AI model chosen for 'parse_resume'."""

from sqlmodel import Session

from app.core.file_validation import InvalidUploadError
from app.schemas.resume_content import ResumeContent
from app.services.ai.prompts import PARSE_RESUME_INSTRUCTIONS, wrap_in_tag
from app.services.ai.provider_registry import get_provider_for_task

MAXIMUM_RESUME_TEXT_CHARACTERS = 40_000


def convert_resume_text_to_structured_content(resume_text: str, database_session: Session) -> ResumeContent:
    """Ask the AI to split CV text into sections (contact details, work, education, skills, ...)."""
    if len(resume_text) > MAXIMUM_RESUME_TEXT_CHARACTERS:
        raise InvalidUploadError("This CV is unusually long. Please upload a shorter version.")
    ai_provider = get_provider_for_task("parse_resume", database_session)
    return ai_provider.generate_structured_output(
        PARSE_RESUME_INSTRUCTIONS,
        "Convert this CV into structured data.\n\n" + wrap_in_tag("resume_text", resume_text),
        ResumeContent,
    )
