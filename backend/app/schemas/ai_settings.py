"""Request and response shapes for AI provider settings."""

from pydantic import BaseModel, Field


class AIProviderResponse(BaseModel):
    """An AI provider and its saved connection details. The API key itself is never returned."""

    name: str
    display_name: str
    description: str
    needs_api_key: bool
    needs_base_url: bool
    has_api_key: bool
    masked_api_key: str | None
    base_url: str | None
    suggested_models: list[str]


class UpdateAIProviderRequest(BaseModel):
    """New connection details. Send an empty api_key to remove a saved key; omit it to keep the current one."""

    api_key: str | None = Field(default=None, max_length=500)
    base_url: str | None = Field(default=None, max_length=500)


class AITaskAssignmentResponse(BaseModel):
    """Which provider and model are used for one AI task."""

    task_name: str
    display_name: str
    description: str
    provider_name: str
    model_name: str


class UpdateAITaskAssignmentRequest(BaseModel):
    """Choose a provider and model for a task."""

    provider_name: str = Field(max_length=50)
    model_name: str = Field(min_length=1, max_length=200)


class TestConnectionRequest(BaseModel):
    """Check that a provider and model respond."""

    provider_name: str = Field(max_length=50)
    model_name: str = Field(min_length=1, max_length=200)


class TestConnectionResponse(BaseModel):
    """Result of a connection test."""

    success: bool
    message: str
