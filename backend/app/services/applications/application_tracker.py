"""Creates applications on the board and moves them between columns, recording every status change."""

from sqlmodel import Session, select

from app.models.application import Application, ApplicationStatus, ApplicationStatusChange
from app.models.timestamps import utc_now


def get_or_create_application(job_id: int, database_session: Session) -> Application:
    """Return the board card for a job, creating it in the 'Saved' column if it does not exist yet."""
    existing_application = database_session.exec(select(Application).where(Application.job_id == job_id)).first()
    if existing_application:
        return existing_application
    new_application = Application(job_id=job_id, status=ApplicationStatus.SAVED.value)
    database_session.add(new_application)
    database_session.commit()
    database_session.refresh(new_application)
    database_session.add(
        ApplicationStatusChange(application_id=new_application.id, from_status=None, to_status=new_application.status)
    )
    database_session.commit()
    return new_application


def change_application_status(
    application: Application, new_status: ApplicationStatus, database_session: Session
) -> Application:
    """Move an application to another column and record the move."""
    if application.status == new_status.value:
        return application
    database_session.add(
        ApplicationStatusChange(application_id=application.id, from_status=application.status, to_status=new_status.value)
    )
    application.status = new_status.value
    application.updated_at = utc_now()
    if new_status == ApplicationStatus.APPLIED and application.applied_at is None:
        application.applied_at = utc_now()
    database_session.add(application)
    database_session.commit()
    database_session.refresh(application)
    return application
