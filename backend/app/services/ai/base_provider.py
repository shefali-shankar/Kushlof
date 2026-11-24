"""The common interface every AI provider implements, plus shared JSON parsing and validation."""

import json
import re
from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel, ValidationError

StructuredOutput = TypeVar("StructuredOutput", bound=BaseModel)

MAXIMUM_STRUCTURED_OUTPUT_ATTEMPTS = 3


class AIProviderError(Exception):
    """Raised when an AI provider cannot be reached or returns something unusable. The message is shown to the user."""


def extract_json_text(raw_model_reply: str) -> str:
    """Pull the JSON object out of a model reply that may include thinking tags or ```json fences."""
    reply_without_thinking = re.sub(r"<think>.*?</think>", "", raw_model_reply, flags=re.DOTALL)
    first_brace_position = reply_without_thinking.find("{")
    last_brace_position = reply_without_thinking.rfind("}")
    if first_brace_position == -1 or last_brace_position <= first_brace_position:
        raise ValueError("The reply did not contain a JSON object.")
    return reply_without_thinking[first_brace_position : last_brace_position + 1]


def remove_thinking_text(raw_model_reply: str) -> str:
    """Remove <think>...</think> blocks that some local models add before their answer."""
    return re.sub(r"<think>.*?</think>", "", raw_model_reply, flags=re.DOTALL).strip()


class AIProvider(ABC):
    """An AI model that can generate text. Subclasses only need to implement generate_text."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    @abstractmethod
    def generate_text(
        self, system_instructions: str, user_prompt: str, expect_json: bool = False
    ) -> str:
        """Send the instructions and prompt to the model and return its reply text."""

    def generate_structured_output(
        self,
        system_instructions: str,
        user_prompt: str,
        output_model: type[StructuredOutput],
    ) -> StructuredOutput:
        """Ask for JSON matching output_model, validate it, and retry with feedback if it is invalid."""
        output_schema_text = json.dumps(output_model.model_json_schema())
        instructions_with_format = (
            f"{system_instructions}\n\n"
            "Reply with ONLY a single JSON object (no markdown, no commentary) that matches "
            f"this JSON schema:\n{output_schema_text}"
        )
        prompt_for_this_attempt = user_prompt
        last_problem_description = ""
        for _ in range(MAXIMUM_STRUCTURED_OUTPUT_ATTEMPTS):
            raw_model_reply = self.generate_text(
                instructions_with_format, prompt_for_this_attempt, expect_json=True
            )
            try:
                return output_model.model_validate_json(extract_json_text(raw_model_reply))
            except (ValidationError, ValueError) as parsing_problem:
                last_problem_description = str(parsing_problem)[:800]
                prompt_for_this_attempt = (
                    f"{user_prompt}\n\nYour previous reply could not be used because: "
                    f"{last_problem_description}\nReply again with only the corrected JSON object."
                )
        raise AIProviderError(
            "The AI model did not return valid structured data after several attempts. "
            "Try a stronger model for this task in Settings."
        )
