"""Fetches job listings from LinkedIn, Indeed, Glassdoor, Google Jobs and ZipRecruiter using python-jobspy.

Only ever runs when the user clicks "Fetch jobs" or starts the pipeline. Keep searches small:
job sites rate-limit heavy scraping.
"""

import math
from typing import Any

from sqlmodel import Session, select

from app.models.job import Job


class JobFetchError(Exception):
    """Raised when job sites cannot be searched. The message is shown to the user."""


def clean_cell_value(cell_value: Any) -> Any:
    """Convert pandas 'missing' values (NaN/NaT/None) to None."""
    if cell_value is None:
        return None
    if isinstance(cell_value, float) and math.isnan(cell_value):
        return None
    if str(cell_value) in {"nan", "NaT", "None", ""}:
        return None
    return cell_value


def format_salary(job_row: dict[str, Any]) -> str | None:
    """Build a readable salary such as 'AUD 90,000–110,000 / yearly'."""
    minimum_amount = job_row.get("min_amount")
    maximum_amount = job_row.get("max_amount")
    if minimum_amount is None and maximum_amount is None:
        return None
    amounts = [f"{float(amount):,.0f}" for amount in [minimum_amount, maximum_amount] if amount is not None]
    currency = job_row.get("currency") or ""
    interval = job_row.get("interval") or ""
    return f"{currency} {'–'.join(amounts)}{f' / {interval}' if interval else ''}".strip()


def search_job_sites(
    search_term: str,
    location: str,
    country: str,
    sites: list[str],
    results_wanted: int,
    hours_old: int,
    is_remote: bool,
) -> list[dict[str, Any]]:
    """Run one jobspy search and return the results as plain dictionaries."""
    try:
        from jobspy import scrape_jobs  # Imported here so the app still starts if jobspy has a problem.
    except ImportError as import_error:
        raise JobFetchError("The job search library (python-jobspy) is not installed.") from import_error
    try:
        jobs_table = scrape_jobs(
            site_name=sites,
            search_term=search_term,
            google_search_term=f"{search_term} jobs near {location}" if location else f"{search_term} jobs",
            location=location or None,
            country_indeed=country,
            results_wanted=results_wanted,
            hours_old=hours_old,
            is_remote=is_remote,
            # Fetching every LinkedIn description during the search means one extra request per job, which quickly
            # gets your connection rate-limited (HTTP 429). Descriptions are loaded one at a time when a job is used.
            linkedin_fetch_description=False,
            description_format="markdown",
        )
    except Exception as scraping_error:  # jobspy raises many different error types
        raise JobFetchError(f"Job search failed: {str(scraping_error)[:300]}") from scraping_error
    if jobs_table is None or jobs_table.empty:
        return []
    return [
        {column_name: clean_cell_value(cell_value) for column_name, cell_value in job_row.items()}
        for job_row in jobs_table.to_dict(orient="records")
    ]


def save_fetched_jobs(job_rows: list[dict[str, Any]], database_session: Session) -> tuple[list[Job], int]:
    """Store fetched jobs, skipping ones already saved (matched by URL). Returns (all jobs from this search, new count)."""
    jobs_from_this_search: list[Job] = []
    new_job_count = 0
    for job_row in job_rows:
        job_url = job_row.get("job_url")
        if not job_url or not job_row.get("title"):
            continue
        existing_job = database_session.exec(select(Job).where(Job.job_url == job_url)).first()
        if existing_job:
            jobs_from_this_search.append(existing_job)
            continue
        new_job = Job(
            title=str(job_row.get("title") or "")[:300],
            company=str(job_row.get("company") or "")[:300],
            location=str(job_row.get("location") or "")[:300],
            description=str(job_row.get("description") or ""),
            job_url=str(job_url)[:2000],
            apply_url=str(job_row.get("job_url_direct") or job_url)[:2000],
            source=str(job_row.get("site") or "jobspy")[:50],
            is_remote=bool(job_row.get("is_remote") or False),
            salary=format_salary(job_row),
            job_type=str(job_row["job_type"])[:100] if job_row.get("job_type") else None,
            date_posted=str(job_row["date_posted"])[:50] if job_row.get("date_posted") else None,
        )
        database_session.add(new_job)
        jobs_from_this_search.append(new_job)
        new_job_count += 1
    database_session.commit()
    for job in jobs_from_this_search:
        database_session.refresh(job)
    return jobs_from_this_search, new_job_count


def fetch_and_save_jobs(
    database_session: Session,
    search_term: str,
    location: str,
    country: str,
    sites: list[str],
    results_wanted: int,
    hours_old: int,
    is_remote: bool,
) -> tuple[list[Job], int]:
    """Search job sites and save the results. Returns (jobs found, number that were new)."""
    job_rows = search_job_sites(search_term, location, country, sites, results_wanted, hours_old, is_remote)
    return save_fetched_jobs(job_rows, database_session)
