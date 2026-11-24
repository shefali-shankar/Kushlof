"""Uses Claude through your Claude subscription by calling the Claude Code command-line tool.

Personal use only: requests run under your own Claude account and count toward your plan's usage limits.
"""

import json
import shutil
import subprocess  # nosec B404 - used only with a fixed argument list, never a shell
import tempfile

from app.services.ai.base_provider import AIProvider, AIProviderError

CLAUDE_CODE_TIMEOUT_SECONDS = 600

# CV and job text can contain hidden instructions, so Claude Code is given no tools at all:
# it cannot run commands, read files or browse. It runs inside an empty temporary folder too.
TOOLS_DISABLED_FOR_SAFETY = [
    "Bash",
    "Edit",
    "Write",
    "MultiEdit",
    "NotebookEdit",
    "Read",
    "Glob",
    "Grep",
    "LS",
    "WebFetch",
    "WebSearch",
    "Task",
    "Agent",
    "Skill",
    "TodoWrite",
]


class ClaudeCodeProvider(AIProvider):
    """Sends prompts to `claude -p` (Claude Code's non-interactive mode)."""

    def generate_text(
        self, system_instructions: str, user_prompt: str, expect_json: bool = False
    ) -> str:
        """Run Claude Code once with the prompt on standard input and return its answer."""
        claude_executable_path = shutil.which("claude")
        if claude_executable_path is None:
            raise AIProviderError(
                "Claude Code is not installed or not on PATH. Install it and sign in with `claude`."
            )
        full_prompt = f"{system_instructions}\n\n{user_prompt}"
        command_arguments = [
            claude_executable_path,
            "-p",
            "--output-format",
            "json",
            "--model",
            self.model_name,
            "--disallowedTools",
            *TOOLS_DISABLED_FOR_SAFETY,
        ]
        with tempfile.TemporaryDirectory(prefix="kushlof_claude_") as empty_working_folder:
            try:
                completed_process = subprocess.run(  # nosec B603 - fixed arguments, no shell
                    command_arguments,
                    input=full_prompt,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=CLAUDE_CODE_TIMEOUT_SECONDS,
                    cwd=empty_working_folder,
                    check=False,
                )
            except subprocess.TimeoutExpired as timeout_error:
                raise AIProviderError("Claude took too long to respond.") from timeout_error

        try:
            claude_result = json.loads(completed_process.stdout)
        except json.JSONDecodeError as parsing_error:
            error_output = (completed_process.stderr or completed_process.stdout).strip()[:400]
            raise AIProviderError(
                f"Claude Code did not respond normally. {error_output}"
            ) from parsing_error

        if claude_result.get("is_error"):
            raise AIProviderError(
                f"Claude reported a problem (you may have reached your plan's usage limit): "
                f"{str(claude_result.get('result', ''))[:400]}"
            )
        return str(claude_result.get("result", "")).strip()
