"""The application pipeline: fetch jobs → rank them for a CV → tailor the best matches → put them in 'Ready to apply'.

It runs ONLY when the user clicks Start. There is no scheduler. It runs in a background thread so
the page can show progress, and it can be cancelled between steps. It never submits applications.
"""

import threading
from datetime import datetime

from sqlmodel import Session, select

from app.core.database import database_engine
from app.models.application import Application
from app.models.cover_letter import CoverLetter
from app.models.job import Job, SavedJobSearch
from app.models.pipeline import PipelineRun, PipelineRunStatus
from app.models.resume import Resume
from app.models.timestamps import utc_now
from app.schemas.pipeline import StartPipelineRequest
from app.schemas.resume_content import ResumeContent
from app.services.cover_letters.cover_letter_writer import write_cover_letter
from app.services.jobs.job_link_importer import JobImportError
from app.services.jobs.job_matcher import rank_jobs_for_resume
from app.services.jobs.jobspy_fetcher import fetch_and_save_jobs
from app.services.resumes.tailored_resume_creator import create_tailored_resume_for_job

cancellation_flags_by_run_id: dict[int, threading.Event] = {}


class PipelineAlreadyRunningError(Exception):
    """Raised when the user tries to start a second run while one is in progress."""


class PipelineCancelledError(Exception):
    """Raised inside the run when the user clicks Cancel."""


def record_progress(run_id: int, current_step: str, **counter_updates: int) -> None:
    """Save the current step (and any counters) and add a timestamped line to the activity log."""
    with Session(database_engine) as database_session:
        pipeline_run = database_session.get(PipelineRun, run_id)
        if pipeline_run is None:
            return
        pipeline_run.current_step = current_step[:300]
        pipeline_run.activity_log = [*pipeline_run.activity_log, f"{datetime.now():%H:%M:%S}  {current_step}"]
        for counter_name, counter_value in counter_updates.items():
            setattr(pipeline_run, counter_name, counter_value)
        database_session.add(pipeline_run)
        database_session.commit()


def finish_run(run_id: int, final_status: PipelineRunStatus, error_message: str | None = None) -> None:
    """Mark a run as finished."""
    with Session(database_engine) as database_session:
        pipeline_run = database_session.get(PipelineRun, run_id)
        if pipeline_run is None:
            return
        pipeline_run.status = final_status.value
        pipeline_run.error_message = error_message
        pipeline_run.finished_at = utc_now()
        database_session.add(pipeline_run)
        database_session.commit()
    cancellation_flags_by_run_id.pop(run_id, None)


def stop_if_cancelled(run_id: int) -> None:
    """Stop the run between steps if the user asked to cancel."""
    cancellation_flag = cancellation_flags_by_run_id.get(run_id)
    if cancellation_flag and cancellation_flag.is_set():
        raise PipelineCancelledError()


def run_pipeline_steps(run_id: int, pipeline_options: StartPipelineRequest) -> None:
    """Do the work of one pipeline run (called in a background thread)."""
    with Session(database_engine) as database_session:
        base_resume = database_session.get(Resume, pipeline_options.base_resume_id)
        if base_resume is None:
            raise ValueError("The chosen CV no longer exists.")
        base_resume_content = ResumeContent.model_validate(base_resume.content)

        fetched_jobs: dict[int, Job] = {}
        for saved_search_id in pipeline_options.saved_search_ids:
            stop_if_cancelled(run_id)
            saved_search = database_session.get(SavedJobSearch, saved_search_id)
            if saved_search is None:
                continue
            record_progress(run_id, f"Searching for '{saved_search.search_term}' in {saved_search.location or saved_search.country}…")
            jobs_found, new_job_count = fetch_and_save_jobs(
                database_session,
                search_term=saved_search.search_term,
                location=saved_search.location,
                country=saved_search.country,
                sites=saved_search.sites,
                results_wanted=saved_search.results_wanted,
                hours_old=saved_search.hours_old,
                is_remote=saved_search.is_remote,
            )
            fetched_jobs.update({job.id: job for job in jobs_found if job.id is not None})
            record_progress(
                run_id,
                f"Found {len(jobs_found)} jobs ({new_job_count} new) for '{saved_search.search_term}'.",
                jobs_fetched=len(fetched_jobs),
            )

        stop_if_cancelled(run_id)
        job_ids_already_tailored = {
            application.job_id
            for application in database_session.exec(select(Application).where(Application.resume_id.is_not(None))).all()
        }
        good_matches = [
            job_match
            for job_match in rank_jobs_for_resume(base_resume_content, list(fetched_jobs.values()))
            if job_match.match_score >= pipeline_options.minimum_match_score
            and job_match.job.id not in job_ids_already_tailored
        ]
        record_progress(
            run_id,
            f"{len(good_matches)} jobs scored {pipeline_options.minimum_match_score}% or higher.",
            jobs_matched=len(good_matches),
        )

        resumes_tailored = 0
        cover_letters_written = 0
        for job_match in good_matches[: pipeline_options.maximum_resumes_to_tailor]:
            stop_if_cancelled(run_id)
            job = job_match.job
            record_progress(run_id, f"Tailoring your CV for {job.title} at {job.company} ({job_match.match_score}% match)…")
            try:
                tailoring_result = create_tailored_resume_for_job(base_resume, job, database_session)
            except JobImportError as description_error:
                record_progress(run_id, f"Skipped {job.title}: {description_error}")
                continue
            resumes_tailored += 1
            record_progress(
                run_id,
                f"Tailored CV ready for {job.title}: ATS score {tailoring_result.score_before.total_score} → "
                f"{tailoring_result.score_after.total_score}.",
                resumes_tailored=resumes_tailored,
            )
            if pipeline_options.write_cover_letters:
                stop_if_cancelled(run_id)
                record_progress(run_id, f"Writing a cover letter for {job.title}…")
                tailored_content = ResumeContent.model_validate(tailoring_result.tailored_resume.content)
                cover_letter = CoverLetter(
                    job_id=job.id,
                    resume_id=tailoring_result.tailored_resume.id,
                    body=write_cover_letter(tailored_content, job, "", database_session),
                )
                database_session.add(cover_letter)
                database_session.commit()
                database_session.refresh(cover_letter)
                application = database_session.exec(select(Application).where(Application.job_id == job.id)).first()
                if application:
                    application.cover_letter_id = cover_letter.id
                    database_session.add(application)
                    database_session.commit()
                cover_letters_written += 1
                record_progress(run_id, f"Cover letter written for {job.title}.", cover_letters_written=cover_letters_written)

    record_progress(run_id, "Done. Review the 'Ready to apply' column on your board.")


def run_pipeline_in_background(run_id: int, pipeline_options: StartPipelineRequest) -> None:
    """Thread entry point: run the steps and record how the run ended."""
    try:
        run_pipeline_steps(run_id, pipeline_options)
        finish_run(run_id, PipelineRunStatus.COMPLETED)
    except PipelineCancelledError:
        record_progress(run_id, "Cancelled by you.")
        finish_run(run_id, PipelineRunStatus.CANCELLED)
    except Exception as pipeline_error:  # Any failure must be recorded, never crash silently.
        record_progress(run_id, f"Stopped because of an error: {pipeline_error}")
        finish_run(run_id, PipelineRunStatus.FAILED, str(pipeline_error)[:1000])


def start_pipeline_run(pipeline_options: StartPipelineRequest, database_session: Session) -> PipelineRun:
    """Create a run record and start it in a background thread. Only one run can be active at a time."""
    active_run = database_session.exec(
        select(PipelineRun).where(PipelineRun.status == PipelineRunStatus.RUNNING.value)
    ).first()
    if active_run:
        raise PipelineAlreadyRunningError("A pipeline run is already in progress.")
    if database_session.get(Resume, pipeline_options.base_resume_id) is None:
        raise ValueError("Choose a CV for the pipeline.")

    new_run = PipelineRun(activity_log=[f"{datetime.now():%H:%M:%S}  Started by you."])
    database_session.add(new_run)
    database_session.commit()
    database_session.refresh(new_run)

    cancellation_flags_by_run_id[new_run.id] = threading.Event()
    threading.Thread(
        target=run_pipeline_in_background, args=(new_run.id, pipeline_options), daemon=True, name=f"pipeline-run-{new_run.id}"
    ).start()
    return new_run


def request_pipeline_cancellation(run_id: int) -> bool:
    """Ask a running pipeline to stop after its current step. Returns False if it is not running."""
    cancellation_flag = cancellation_flags_by_run_id.get(run_id)
    if cancellation_flag is None:
        return False
    cancellation_flag.set()
    return True


def mark_interrupted_runs_as_failed() -> None:
    """On startup, any run still marked 'running' was interrupted by the app closing."""
    with Session(database_engine) as database_session:
        interrupted_runs = database_session.exec(
            select(PipelineRun).where(PipelineRun.status == PipelineRunStatus.RUNNING.value)
        ).all()
        for interrupted_run in interrupted_runs:
            interrupted_run.status = PipelineRunStatus.FAILED.value
            interrupted_run.error_message = "Kushlof was closed while this run was in progress."
            interrupted_run.finished_at = utc_now()
            database_session.add(interrupted_run)
        database_session.commit()
