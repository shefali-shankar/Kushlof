"""Uses Claude models through the Anthropic API with the user's own API key (pay per use)."""

import anthropic

from app.services.ai.base_provider import AIProvider, AIProviderError

MAXIMUM_OUTPUT_TOKENS = 16000

# These models support automatic server-side fallback when a request is declined by a safety check.
MODELS_WITH_SERVER_SIDE_FALLBACK = {"claude-opus-5-5", "claude-sonnet-5-5"}
SERVER_SIDE_FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicProvider(AIProvider):
    """Calls the Anthropic Messages API."""

    def __init__(self, model_name: str, api_key: str) -> None:
        super().__init__(model_name)
        self.api_client = anthropic.Anthropic(api_key=api_key)

    def generate_text(
        self, system_instructions: str, user_prompt: str, expect_json: bool = False
    ) -> str:
        """Send one message to Claude and return the text of its reply."""
        request_options = {
            "model": self.model_name,
            "max_tokens": MAXIMUM_OUTPUT_TOKENS,
            "system": system_instructions,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        try:
            if self.model_name in MODELS_WITH_SERVER_SIDE_FALLBACK:
                api_response = self.api_client.beta.messages.create(
                    **request_options,
                    betas=[SERVER_SIDE_FALLBACK_BETA],
                    extra_body={"fallbacks": "default"},
                )
            else:
                api_response = self.api_client.messages.create(**request_options)
        except anthropic.AuthenticationError as api_error:
            raise AIProviderError("Your Anthropic API key was rejected. Check it in Settings.") from api_error
        except anthropic.NotFoundError as api_error:
            raise AIProviderError(f"Anthropic does not recognise the model '{self.model_name}'.") from api_error
        except anthropic.RateLimitError as api_error:
            raise AIProviderError("Anthropic rate limit reached. Wait a moment and try again.") from api_error
        except anthropic.APIStatusError as api_error:
            raise AIProviderError(f"Anthropic API error ({api_error.status_code}).") from api_error
        except anthropic.APIConnectionError as api_error:
            raise AIProviderError("Cannot reach the Anthropic API. Check your internet connection.") from api_error

        if api_response.stop_reason == "refusal":
            raise AIProviderError("Claude declined this request. Try rewording your instructions.")
        reply_text = "".join(
            content_block.text for content_block in api_response.content if content_block.type == "text"
        )
        return reply_text.strip()
