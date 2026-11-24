"""Shape of an ATS (applicant tracking system) score report."""

from typing import Literal

from pydantic import BaseModel

from app.schemas.resume_content import ResumeSectionName

SuggestionSection = ResumeSectionName | Literal["basics", "general"]


class ATSCheckResult(BaseModel):
    """One pass/fail check, e.g. 'Email address present'."""

    name: str
    passed: bool
    detail: str = ""


class ResumeSuggestion(BaseModel):
    """A suggested improvement, linked to the CV section it applies to."""

    section: SuggestionSection
    message: str
    severity: Literal["high", "medium", "low"] = "medium"
    source: Literal["rules", "ai"] = "rules"


class ATSScoreReport(BaseModel):
    """Overall ATS score with its breakdown and suggestions."""

    total_score: int
    keyword_score: int | None
    formatting_score: int
    content_score: int
    matched_keywords: list[str]
    missing_keywords: list[str]
    checks: list[ATSCheckResult]
    suggestions: list[ResumeSuggestion]
