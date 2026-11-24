"""Loads a job's description when it was saved without one.

LinkedIn search results are saved without descriptions (fetching them all at once gets you rate-limited),
so the description is downloaded the first time the job is analysed, tailored for, or opened with "Load description".
"""

from sqlmodel import Session

from app.models.job import Job
from app.services.jobs.job_link_importer import JobImportError, find_linkedin_job_id, import_linkedin_job

MISSING_DESCRIPTION_MESSAGE = (
    "This job has no description yet. Open the job and paste the description text from the job posting."
)


def ensure_job_has_description(job: Job, database_session: Session) -> None:
    """Make sure the job has a description, downloading it from LinkedIn if needed. Raises JobImportError otherwise."""
    if job.description.strip():
        return
    linkedin_job_id = find_linkedin_job_id(job.job_url or "")
    if not linkedin_job_id:
        raise JobImportError(MISSING_DESCRIPTION_MESSAGE)

    imported_details = import_linkedin_job(linkedin_job_id)
    job.description = imported_details.description
    if not job.company.strip() and imported_details.company:
        job.company = imported_details.company[:300]
    if not job.location.strip() and imported_details.location:
        job.location = imported_details.location[:300]
    database_session.add(job)
    database_session.commit()
    database_session.refresh(job)
