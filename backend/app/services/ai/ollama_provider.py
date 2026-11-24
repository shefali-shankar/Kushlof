"""Runs free local models through Ollama (https://ollama.com)."""

import httpx

from app.services.ai.base_provider import AIProvider, AIProviderError, remove_thinking_text

DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"
OLLAMA_TIMEOUT_SECONDS = 900  # Local models on a CPU can be slow for long CVs.


class OllamaProvider(AIProvider):
    """Talks to the Ollama app running on this computer."""

    def __init__(self, model_name: str, base_url: str | None = None) -> None:
        super().__init__(model_name)
        self.base_url = (base_url or DEFAULT_OLLAMA_URL).rstrip("/")

    def generate_text(
        self, system_instructions: str, user_prompt: str, expect_json: bool = False
    ) -> str:
        """Send one chat request to Ollama and return the reply."""
        request_body: dict = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "think": False,
            "options": {"temperature": 0.3, "num_ctx": 16384},
        }
        if expect_json:
            request_body["format"] = "json"
        try:
            http_response = httpx.post(
                f"{self.base_url}/api/chat", json=request_body, timeout=OLLAMA_TIMEOUT_SECONDS
            )
        except httpx.ConnectError as connection_error:
            raise AIProviderError(
                "Cannot reach Ollama. Make sure the Ollama app is running."
            ) from connection_error
        except httpx.TimeoutException as timeout_error:
            raise AIProviderError(
                "The local model took too long. Try a smaller model or a cloud provider."
            ) from timeout_error
        if http_response.status_code == 404:
            raise AIProviderError(
                f"Ollama does not have the model '{self.model_name}'. "
                f"Download it with:  ollama pull {self.model_name}"
            )
        if http_response.status_code >= 400:
            raise AIProviderError(f"Ollama returned an error: {http_response.text[:300]}")
        return remove_thinking_text(http_response.json()["message"]["content"])
