"""Calculates an ATS (applicant tracking system) score for a CV, with a breakdown and suggestions.

Score = keyword match (50%) + formatting (25%) + content quality (25%) when a job is given.
Without a job, formatting and content quality count 50% each.
"""

import re

from app.schemas.ats import ATSCheckResult, ATSScoreReport, ResumeSuggestion
from app.schemas.resume_content import ResumeContent
from app.services.resumes.keyword_matcher import split_keywords_by_presence
from app.services.resumes.resume_text import (
    convert_resume_to_plain_text,
    list_all_bullet_points,
    list_all_skills,
)

ACTION_VERBS = {
    "achieved", "accelerated", "analysed", "analyzed", "architected", "automated", "boosted", "built",
    "championed", "collaborated", "completed", "configured", "consolidated", "coordinated", "created",
    "cut", "decreased", "defined", "delivered", "deployed", "designed", "developed", "directed", "drove",
    "enabled", "engineered", "established", "exceeded", "executed", "expanded", "facilitated", "founded",
    "generated", "grew", "guided", "headed", "identified", "implemented", "improved", "increased",
    "initiated", "integrated", "introduced", "launched", "led", "maintained", "managed", "mentored",
    "migrated", "modernised", "modernized", "negotiated", "optimised", "optimized", "orchestrated",
    "organised", "organized", "oversaw", "owned", "partnered", "pioneered", "planned", "presented",
    "produced", "reduced", "redesigned", "refactored", "resolved", "restructured", "revamped",
    "saved", "scaled", "secured", "shipped", "simplified", "spearheaded", "streamlined", "strengthened",
    "supervised", "supported", "trained", "transformed", "tripled", "doubled", "upgraded", "won", "wrote",
}

NUMBER_PATTERN = re.compile(r"\d|%|\$|£|€")
FIRST_PERSON_PATTERN = re.compile(r"\b(i|me|my|myself)\b", re.IGNORECASE)


def calculate_percentage(part_count: int, total_count: int) -> float:
    """Return part/total as a 0-100 percentage (0 when there is nothing to count)."""
    return 100 * part_count / total_count if total_count else 0.0


def check_formatting(resume_content: ResumeContent) -> tuple[list[ATSCheckResult], list[ResumeSuggestion]]:
    """Check the sections and contact details an ATS expects to find."""
    basics = resume_content.basics
    word_count = len(convert_resume_to_plain_text(resume_content).split())
    every_job_has_dates = bool(resume_content.work) and all(
        job.start_date.strip() and job.end_date.strip() for job in resume_content.work
    )
    formatting_rules = [
        ("Name present", bool(basics.name.strip()), "basics", "Add your full name at the top.", "high"),
        ("Email address present", "@" in basics.email, "basics", "Add a professional email address.", "high"),
        ("Phone number present", len(re.sub(r"\D", "", basics.phone)) >= 8, "basics", "Add a phone number.", "medium"),
        ("Professional summary", len(resume_content.summary.split()) >= 25, "summary",
         "Write a 2-4 sentence summary of your experience and strengths.", "medium"),
        ("Work experience listed", bool(resume_content.work), "work", "Add your work experience.", "high"),
        ("Dates on every job", every_job_has_dates, "work",
         "Add start and end dates to every job (ATS systems use them to calculate experience).", "medium"),
        ("Skills section", len(list_all_skills(resume_content)) >= 5, "skills",
         "List at least 5 relevant skills in a Skills section.", "high"),
        ("Education listed", bool(resume_content.education), "education", "Add your education.", "low"),
        ("Suitable length", 250 <= word_count <= 1100, "general",
         f"Your CV has about {word_count} words. Aim for roughly 400-900 words (1-2 pages).", "low"),
    ]
    check_results: list[ATSCheckResult] = []
    suggestions: list[ResumeSuggestion] = []
    for check_name, has_passed, section_name, fix_message, severity in formatting_rules:
        check_results.append(ATSCheckResult(name=check_name, passed=has_passed, detail="" if has_passed else fix_message))
        if not has_passed:
            suggestions.append(ResumeSuggestion(section=section_name, message=fix_message, severity=severity))
    return check_results, suggestions


def check_content_quality(resume_content: ResumeContent) -> tuple[list[ATSCheckResult], list[ResumeSuggestion], float]:
    """Score the bullet points: numbers, action verbs, sensible length and no 'I/my'."""
    bullet_points = list_all_bullet_points(resume_content)
    if not bullet_points:
        message = "Add achievement bullet points under each job."
        return (
            [ATSCheckResult(name="Achievement bullet points", passed=False, detail=message)],
            [ResumeSuggestion(section="work", message=message, severity="high")],
            0.0,
        )

    quantified_percentage = calculate_percentage(
        sum(1 for bullet in bullet_points if NUMBER_PATTERN.search(bullet)), len(bullet_points)
    )
    action_verb_percentage = calculate_percentage(
        sum(1 for bullet in bullet_points if bullet.split()[0].lower().strip(",.") in ACTION_VERBS),
        len(bullet_points),
    )
    good_length_percentage = calculate_percentage(
        sum(1 for bullet in bullet_points if 6 <= len(bullet.split()) <= 35), len(bullet_points)
    )
    first_person_count = sum(1 for bullet in bullet_points if FIRST_PERSON_PATTERN.search(bullet))

    quality_rules = [
        ("Achievements include numbers", quantified_percentage >= 40, quantified_percentage,
         f"Only {quantified_percentage:.0f}% of bullets include numbers. Add measurable results (%, $, time saved, team size).",
         "high"),
        ("Bullets start with action verbs", action_verb_percentage >= 60, action_verb_percentage,
         f"{action_verb_percentage:.0f}% of bullets start with an action verb. Start each with a verb like 'Led', 'Built', 'Reduced'.",
         "medium"),
        ("Bullets are a readable length", good_length_percentage >= 70, good_length_percentage,
         "Keep each bullet between 6 and 35 words.", "low"),
        ("No first-person words", first_person_count == 0, 100.0 if first_person_count == 0 else 0.0,
         "Remove 'I', 'me' and 'my' from bullet points.", "low"),
    ]
    check_results: list[ATSCheckResult] = []
    suggestions: list[ResumeSuggestion] = []
    for check_name, has_passed, _, fix_message, severity in quality_rules:
        check_results.append(ATSCheckResult(name=check_name, passed=has_passed, detail="" if has_passed else fix_message))
        if not has_passed:
            suggestions.append(ResumeSuggestion(section="work", message=fix_message, severity=severity))

    content_score = (
        0.4 * min(quantified_percentage / 60, 1) * 100
        + 0.3 * min(action_verb_percentage / 80, 1) * 100
        + 0.2 * good_length_percentage
        + 0.1 * (100 if first_person_count == 0 else 0)
    )
    return check_results, suggestions, content_score


def calculate_ats_score(resume_content: ResumeContent, job_keywords: list[str] | None = None) -> ATSScoreReport:
    """Score a CV out of 100, optionally against a job's keywords."""
    formatting_checks, formatting_suggestions = check_formatting(resume_content)
    content_checks, content_suggestions, content_score = check_content_quality(resume_content)
    formatting_score = calculate_percentage(sum(1 for check in formatting_checks if check.passed), len(formatting_checks))

    matched_keywords: list[str] = []
    missing_keywords: list[str] = []
    keyword_score: float | None = None
    keyword_suggestions: list[ResumeSuggestion] = []
    if job_keywords:
        matched_keywords, missing_keywords = split_keywords_by_presence(
            job_keywords, convert_resume_to_plain_text(resume_content)
        )
        keyword_score = calculate_percentage(len(matched_keywords), len(job_keywords))
        if missing_keywords:
            keyword_suggestions.append(
                ResumeSuggestion(
                    section="skills",
                    message="Missing job keywords (add only those you genuinely have): "
                    + ", ".join(missing_keywords[:12]),
                    severity="high" if keyword_score < 60 else "medium",
                )
            )

    if keyword_score is None:
        total_score = 0.5 * formatting_score + 0.5 * content_score
    else:
        total_score = 0.5 * keyword_score + 0.25 * formatting_score + 0.25 * content_score

    severity_order = {"high": 0, "medium": 1, "low": 2}
    all_suggestions = sorted(
        keyword_suggestions + formatting_suggestions + content_suggestions,
        key=lambda suggestion: severity_order[suggestion.severity],
    )
    return ATSScoreReport(
        total_score=round(total_score),
        keyword_score=None if keyword_score is None else round(keyword_score),
        formatting_score=round(formatting_score),
        content_score=round(content_score),
        matched_keywords=matched_keywords,
        missing_keywords=missing_keywords,
        checks=formatting_checks + content_checks,
        suggestions=all_suggestions,
    )
