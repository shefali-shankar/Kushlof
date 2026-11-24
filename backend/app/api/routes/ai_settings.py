"""API routes for choosing AI providers and models, saving API keys, and testing connections."""

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.api.dependencies import DatabaseSession
from app.core.encryption import decrypt_secret, encrypt_secret, mask_secret
from app.models.ai_settings import AIProviderCredential, AITaskAssignment
from app.models.timestamps import utc_now
from app.schemas.ai_settings import (
    AIProviderResponse,
    AITaskAssignmentResponse,
    TestConnectionRequest,
    TestConnectionResponse,
    UpdateAIProviderRequest,
    UpdateAITaskAssignmentRequest,
)
from app.services.ai.base_provider import AIProviderError
from app.services.ai.provider_registry import (
    PROVIDER_DEFINITIONS,
    TASK_DEFINITIONS,
    build_provider,
    get_task_assignment,
)

router = APIRouter(prefix="/ai-settings", tags=["AI settings"])


def ensure_provider_exists(provider_name: str) -> None:
    """Respond with 404 for an unknown provider name."""
    if provider_name not in PROVIDER_DEFINITIONS:
        raise HTTPException(status_code=404, detail="Unknown AI provider.")


def build_provider_response(provider_name: str, saved_credential: AIProviderCredential | None) -> AIProviderResponse:
    """Describe a provider without ever revealing its API key."""
    provider_definition = PROVIDER_DEFINITIONS[provider_name]
    masked_api_key = None
    if saved_credential and saved_credential.encrypted_api_key:
        try:
            masked_api_key = mask_secret(decrypt_secret(saved_credential.encrypted_api_key))
        except ValueError:
            masked_api_key = "(cannot be read — enter it again)"
    return AIProviderResponse(
        name=provider_name,
        display_name=provider_definition.display_name,
        description=provider_definition.description,
        needs_api_key=provider_definition.needs_api_key,
        needs_base_url=provider_definition.needs_base_url,
        has_api_key=masked_api_key is not None,
        masked_api_key=masked_api_key,
        base_url=(saved_credential.base_url if saved_credential else None) or provider_definition.default_base_url,
        suggested_models=provider_definition.suggested_models,
    )


@router.get("/providers", response_model=list[AIProviderResponse])
def list_providers(database_session: DatabaseSession) -> list[AIProviderResponse]:
    """List every supported AI provider with its saved settings."""
    saved_credentials = {credential.provider_name: credential for credential in database_session.exec(select(AIProviderCredential)).all()}
    return [build_provider_response(provider_name, saved_credentials.get(provider_name)) for provider_name in PROVIDER_DEFINITIONS]


@router.put("/providers/{provider_name}", response_model=AIProviderResponse)
def update_provider(provider_name: str, request_body: UpdateAIProviderRequest, database_session: DatabaseSession) -> AIProviderResponse:
    """Save a provider's API key (encrypted) and/or server address."""
    ensure_provider_exists(provider_name)
    saved_credential = database_session.get(AIProviderCredential, provider_name) or AIProviderCredential(provider_name=provider_name)
    changed_fields = request_body.model_dump(exclude_unset=True)
    if "api_key" in changed_fields:
        new_api_key = (request_body.api_key or "").strip()
        saved_credential.encrypted_api_key = encrypt_secret(new_api_key) if new_api_key else None
    if "base_url" in changed_fields:
        new_base_url = (request_body.base_url or "").strip()
        if new_base_url and not new_base_url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="The server address must start with http:// or https://")
        saved_credential.base_url = new_base_url or None
    saved_credential.updated_at = utc_now()
    database_session.add(saved_credential)
    database_session.commit()
    database_session.refresh(saved_credential)
    return build_provider_response(provider_name, saved_credential)


@router.get("/tasks", response_model=list[AITaskAssignmentResponse])
def list_task_assignments(database_session: DatabaseSession) -> list[AITaskAssignmentResponse]:
    """List each AI task with the provider and model it uses."""
    task_responses = []
    for task_name, task_definition in TASK_DEFINITIONS.items():
        provider_name, model_name = get_task_assignment(task_name, database_session)
        task_responses.append(
            AITaskAssignmentResponse(
                task_name=task_name,
                display_name=task_definition.display_name,
                description=task_definition.description,
                provider_name=provider_name,
                model_name=model_name,
            )
        )
    return task_responses


@router.put("/tasks/{task_name}", response_model=AITaskAssignmentResponse)
def update_task_assignment(
    task_name: str, request_body: UpdateAITaskAssignmentRequest, database_session: DatabaseSession
) -> AITaskAssignmentResponse:
    """Choose which provider and model a task uses."""
    if task_name not in TASK_DEFINITIONS:
        raise HTTPException(status_code=404, detail="Unknown AI task.")
    ensure_provider_exists(request_body.provider_name)
    saved_assignment = database_session.get(AITaskAssignment, task_name) or AITaskAssignment(
        task_name=task_name, provider_name=request_body.provider_name, model_name=request_body.model_name
    )
    saved_assignment.provider_name = request_body.provider_name
    saved_assignment.model_name = request_body.model_name.strip()
    database_session.add(saved_assignment)
    database_session.commit()
    task_definition = TASK_DEFINITIONS[task_name]
    return AITaskAssignmentResponse(
        task_name=task_name,
        display_name=task_definition.display_name,
        description=task_definition.description,
        provider_name=saved_assignment.provider_name,
        model_name=saved_assignment.model_name,
    )


@router.post("/test-connection", response_model=TestConnectionResponse)
def test_provider_connection(request_body: TestConnectionRequest, database_session: DatabaseSession) -> TestConnectionResponse:
    """Send a tiny prompt to check the provider and model work."""
    ensure_provider_exists(request_body.provider_name)
    try:
        ai_provider = build_provider(request_body.provider_name, request_body.model_name, database_session)
        model_reply = ai_provider.generate_text("You are a connection test.", "Reply with exactly the word: OK")
    except (AIProviderError, ValueError) as connection_problem:
        return TestConnectionResponse(success=False, message=str(connection_problem))
    return TestConnectionResponse(success=True, message=f"Connected. The model replied: {model_reply[:60]}")
