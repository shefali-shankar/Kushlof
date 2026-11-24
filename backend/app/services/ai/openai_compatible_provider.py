"""Uses any service that offers an OpenAI-style chat API: OpenAI, Google Gemini, Groq, OpenRouter, LM Studio and others."""

import openai

from app.services.ai.base_provider import AIProvider, AIProviderError, remove_thinking_text


class OpenAICompatibleProvider(AIProvider):
    """Calls an OpenAI-compatible /chat/completions endpoint."""

    def __init__(self, model_name: str, base_url: str, api_key: str | None) -> None:
        super().__init__(model_name)
        self.api_client = openai.OpenAI(
            api_key=api_key or "not-required", base_url=base_url, timeout=600
        )

    def generate_text(
        self, system_instructions: str, user_prompt: str, expect_json: bool = False
    ) -> str:
        """Send one chat request and return the reply text."""
        chat_messages = [
            {"role": "system", "content": system_instructions},
            {"role": "user", "content": user_prompt},
        ]
        try:
            try:
                chat_response = self.api_client.chat.completions.create(
                    model=self.model_name,
                    messages=chat_messages,
                    **({"response_format": {"type": "json_object"}} if expect_json else {}),
                )
            except openai.BadRequestError:
                if not expect_json:
                    raise
                # Some providers do not support JSON mode; the prompt already asks for JSON.
                chat_response = self.api_client.chat.completions.create(
                    model=self.model_name, messages=chat_messages
                )
        except openai.AuthenticationError as api_error:
            raise AIProviderError("The API key was rejected. Check it in Settings.") from api_error
        except openai.NotFoundError as api_error:
            raise AIProviderError(f"The provider does not recognise the model '{self.model_name}'.") from api_error
        except openai.RateLimitError as api_error:
            raise AIProviderError("Rate limit or quota reached for this provider.") from api_error
        except openai.APIStatusError as api_error:
            raise AIProviderError(f"Provider error ({api_error.status_code}).") from api_error
        except openai.APIConnectionError as api_error:
            raise AIProviderError("Cannot reach the provider. Check the address and your connection.") from api_error

        reply_text = chat_response.choices[0].message.content or ""
        return remove_thinking_text(reply_text)
