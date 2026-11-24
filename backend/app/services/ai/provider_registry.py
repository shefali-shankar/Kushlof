"""Lists the supported AI providers and tasks, and builds the right provider for each task from the user's settings."""

from dataclasses import dataclass, field

from sqlmodel import Session

from app.core.encryption import decrypt_secret
from app.models.ai_settings import AIProviderCredential, AITaskAssignment
from app.services.ai.anthropic_provider import AnthropicProvider
from app.services.ai.base_provider import AIProvider, AIProviderError
from app.services.ai.claude_code_provider import ClaudeCodeProvider
from app.services.ai.ollama_provider import DEFAULT_OLLAMA_URL, OllamaProvider
from app.services.ai.openai_compatible_provider import OpenAICompatibleProvider


@dataclass(frozen=True)
class ProviderDefinition:
    """Static information about one AI provider."""

    display_name: str
    description: str
    needs_api_key: bool
    needs_base_url: bool
    default_base_url: str | None
    suggested_models: list[str] = field(default_factory=list)


PROVIDER_DEFINITIONS: dict[str, ProviderDefinition] = {
    "ollama": ProviderDefinition(
        "Ollama (local, free)",
        "Runs open-source models on this computer. Private and free, but slower.",
        needs_api_key=False,
        needs_base_url=True,
        default_base_url=DEFAULT_OLLAMA_URL,
        suggested_models=["qwen3:4b", "qwen3:8b", "gemma3:4b", "llama3.2:3b"],
    ),
    "claude_code": ProviderDefinition(
        "Claude (your subscription)",
        "Uses your Claude Pro/Max plan through Claude Code. Personal use; counts toward plan limits.",
        needs_api_key=False,
        needs_base_url=False,
        default_base_url=None,
        suggested_models=["sonnet", "opus", "haiku"],
    ),
    "anthropic": ProviderDefinition(
        "Anthropic API",
        "Claude models with your own API key. Pay per use.",
        needs_api_key=True,
        needs_base_url=False,
        default_base_url=None,
        suggested_models=["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
    ),
    "openai": ProviderDefinition(
        "OpenAI API",
        "GPT models with your own API key. Pay per use.",
        needs_api_key=True,
        needs_base_url=False,
        default_base_url="https://api.openai.com/v1",
        suggested_models=["gpt-4.1-mini", "gpt-4.1"],
    ),
    "gemini": ProviderDefinition(
        "Google Gemini API",
        "Gemini models with your own API key. Has a free tier.",
        needs_api_key=True,
        needs_base_url=False,
        default_base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        suggested_models=["gemini-2.5-flash", "gemini-2.5-pro"],
    ),
    "groq": ProviderDefinition(
        "Groq",
        "Very fast hosted open-source models. Has a free tier.",
        needs_api_key=True,
        needs_base_url=False,
        default_base_url="https://api.groq.com/openai/v1",
        suggested_models=["llama-3.3-70b-versatile", "qwen/qwen3-32b"],
    ),
    "openrouter": ProviderDefinition(
        "OpenRouter",
        "One key for many models, including some free ones.",
        needs_api_key=True,
        needs_base_url=False,
        default_base_url="https://openrouter.ai/api/v1",
        suggested_models=["meta-llama/llama-3.3-70b-instruct:free"],
    ),
    "custom_openai_compatible": ProviderDefinition(
        "Custom (OpenAI-compatible)",
        "Any other OpenAI-style endpoint, e.g. LM Studio at http://127.0.0.1:1234/v1.",
        needs_api_key=False,
        needs_base_url=True,
        default_base_url="http://127.0.0.1:1234/v1",
        suggested_models=[],
    ),
}


@dataclass(frozen=True)
class TaskDefinition:
    """Static information about one AI task and its default model."""

    display_name: str
    description: str
    default_provider_name: str
    default_model_name: str


TASK_DEFINITIONS: dict[str, TaskDefinition] = {
    "parse_resume": TaskDefinition(
        "Read uploaded CVs", "Turns an uploaded PDF or Word CV into editable sections.", "ollama", "qwen3:4b"
    ),
    "extract_job_requirements": TaskDefinition(
        "Analyse job descriptions", "Pulls the skills and keywords out of a job description.", "ollama", "qwen3:4b"
    ),
    "tailor_resume": TaskDefinition(
        "Tailor CVs to jobs", "Rewrites a CV to match a job without inventing anything.", "claude_code", "sonnet"
    ),
    "rewrite_section": TaskDefinition(
        "Rewrite CV sections", "Improves one CV section following your instructions.", "claude_code", "sonnet"
    ),
    "review_resume": TaskDefinition(
        "Review CVs", "Gives expert suggestions to improve a CV.", "claude_code", "sonnet"
    ),
    "write_cover_letter": TaskDefinition(
        "Write cover letters", "Writes a cover letter from your CV and the job.", "claude_code", "sonnet"
    ),
}


def get_task_assignment(task_name: str, database_session: Session) -> tuple[str, str]:
    """Return (provider_name, model_name) chosen for a task, falling back to the default."""
    if task_name not in TASK_DEFINITIONS:
        raise ValueError(f"Unknown AI task: {task_name}")
    saved_assignment = database_session.get(AITaskAssignment, task_name)
    if saved_assignment:
        return saved_assignment.provider_name, saved_assignment.model_name
    task_definition = TASK_DEFINITIONS[task_name]
    return task_definition.default_provider_name, task_definition.default_model_name


def build_provider(provider_name: str, model_name: str, database_session: Session) -> AIProvider:
    """Create a ready-to-use provider object from the saved connection details."""
    provider_definition = PROVIDER_DEFINITIONS.get(provider_name)
    if provider_definition is None:
        raise AIProviderError(f"Unknown AI provider: {provider_name}")

    saved_credential = database_session.get(AIProviderCredential, provider_name)
    api_key = (
        decrypt_secret(saved_credential.encrypted_api_key)
        if saved_credential and saved_credential.encrypted_api_key
        else None
    )
    base_url = (saved_credential.base_url if saved_credential else None) or provider_definition.default_base_url

    if provider_definition.needs_api_key and not api_key:
        raise AIProviderError(
            f"{provider_definition.display_name} needs an API key. Add it in Settings → AI providers."
        )
    if provider_name == "ollama":
        return OllamaProvider(model_name, base_url)
    if provider_name == "claude_code":
        return ClaudeCodeProvider(model_name)
    if provider_name == "anthropic":
        return AnthropicProvider(model_name, api_key or "")
    if not base_url:
        raise AIProviderError(f"{provider_definition.display_name} needs a server address in Settings.")
    return OpenAICompatibleProvider(model_name, base_url, api_key)


def get_provider_for_task(task_name: str, database_session: Session) -> AIProvider:
    """Build the provider the user chose for this task."""
    provider_name, model_name = get_task_assignment(task_name, database_session)
    return build_provider(provider_name, model_name, database_session)
