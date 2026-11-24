"""Tables for AI provider credentials and which model is used for each task."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.timestamps import utc_now


class AIProviderCredential(SQLModel, table=True):
    """Connection details for one AI provider. API keys are stored encrypted."""

    __tablename__ = "ai_provider_credentials"

    provider_name: str = Field(primary_key=True, max_length=50)
    encrypted_api_key: str | None = None
    base_url: str | None = Field(default=None, max_length=500)
    updated_at: datetime = Field(default_factory=utc_now)


class AITaskAssignment(SQLModel, table=True):
    """Which provider and model the user chose for one AI task (e.g. tailoring)."""

    __tablename__ = "ai_task_assignments"

    task_name: str = Field(primary_key=True, max_length=50)
    provider_name: str = Field(max_length=50)
    model_name: str = Field(max_length=200)
