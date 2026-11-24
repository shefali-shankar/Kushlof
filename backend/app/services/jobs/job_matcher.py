"""Ranks saved jobs by how well they fit a CV, using keyword overlap and job-title similarity.

Runs entirely on this computer with no AI calls, so it is instant and free.
"""

import re
from dataclasses import dataclass

from app.models.job import Job
from app.schemas.resume_content import ResumeContent
from app.services.resumes.keyword_matcher import get_job_keywords, split_keywords_by_presence
from app.services.resumes.resume_text import convert_resume_to_plain_text

KEYWORD_WEIGHT = 0.75
TITLE_WEIGHT = 0.25
TITLE_STOP_WORDS = {"and", "or", "the", "of", "a", "an", "to", "in", "for", "with", "-", "&", "senior", "junior", "lead"}


@dataclass
class JobMatch:
    """A job with its fit score for a CV."""

    job: Job
    match_score: int
    matched_keywords: list[str]


def split_into_title_words(title_text: str) -> set[str]:
    """Return the meaningful lowercase words of a job title."""
    return {word for word in re.findall(r"[a-z0-9+#.]+", title_text.lower()) if word not in TITLE_STOP_WORDS}


def calculate_title_similarity(resume_content: ResumeContent, job_title: str) -> float:
    """Return 0-1: how much the job title overlaps with the CV's headline and job titles."""
    resume_title_words = split_into_title_words(resume_content.basics.headline)
    for job_entry in resume_content.work[:3]:
        resume_title_words |= split_into_title_words(job_entry.position)
    job_title_words = split_into_title_words(job_title)
    if not job_title_words or not resume_title_words:
        return 0.0
    return len(job_title_words & resume_title_words) / len(job_title_words)


def score_job_for_resume(resume_content: ResumeContent, resume_text: str, job: Job) -> JobMatch:
    """Score one job from 0 to 100 for a CV."""
    job_keywords = get_job_keywords(job.requirements, job.description)
    matched_keywords, _ = split_keywords_by_presence(job_keywords, resume_text)
    keyword_coverage = len(matched_keywords) / len(job_keywords) if job_keywords else 0.0
    title_similarity = calculate_title_similarity(resume_content, job.title)
    match_score = round(100 * (KEYWORD_WEIGHT * keyword_coverage + TITLE_WEIGHT * title_similarity))
    return JobMatch(job=job, match_score=match_score, matched_keywords=matched_keywords)


def rank_jobs_for_resume(resume_content: ResumeContent, jobs: list[Job]) -> list[JobMatch]:
    """Return the jobs sorted from best to worst fit for the CV."""
    resume_text = convert_resume_to_plain_text(resume_content)
    job_matches = [score_job_for_resume(resume_content, resume_text, job) for job in jobs]
    return sorted(job_matches, key=lambda job_match: job_match.match_score, reverse=True)


def suggest_search_term_from_resume(resume_content: ResumeContent) -> str:
    """Pick a job search term from the CV: its headline, or the most recent job title."""
    if resume_content.basics.headline.strip():
        return resume_content.basics.headline.strip()
    if resume_content.work and resume_content.work[0].position.strip():
        return resume_content.work[0].position.strip()
    raise ValueError("Add a headline or a job title to your CV so Kushlof knows what to search for.")
