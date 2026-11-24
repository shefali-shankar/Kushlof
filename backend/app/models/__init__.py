"""Database tables. Importing this package registers every table with SQLModel."""

from app.models.ai_settings import AIProviderCredential, AITaskAssignment
from app.models.application import Application, ApplicationStatus, ApplicationStatusChange
from app.models.cover_letter import CoverLetter
from app.models.job import Job, SavedJobSearch
from app.models.pipeline import PipelineRun, PipelineRunStatus
from app.models.resume import Resume
from app.models.user import UserProfile, UserSession

__all__ = [
    "AIProviderCredential",
    "AITaskAssignment",
    "Application",
    "ApplicationStatus",
    "ApplicationStatusChange",
    "CoverLetter",
    "Job",
    "PipelineRun",
    "PipelineRunStatus",
    "Resume",
    "SavedJobSearch",
    "UserProfile",
    "UserSession",
]
