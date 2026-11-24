"""Loads Kushlof configuration from the project's .env file, creating it with fresh secrets on first run."""

import secrets
from pathlib import Path

from cryptography.fernet import Fernet
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT_FOLDER = Path(__file__).resolve().parents[3]
ENVIRONMENT_FILE_PATH = PROJECT_ROOT_FOLDER / ".env"
DATA_FOLDER = PROJECT_ROOT_FOLDER / "data"
TEMPLATES_FOLDER = Path(__file__).resolve().parents[1] / "templates"


def create_environment_file_if_missing() -> None:
    """Write a .env file with newly generated secrets the first time the app starts."""
    if ENVIRONMENT_FILE_PATH.exists():
        return
    environment_file_lines = [
        "# Generated automatically on first run. Keep this file private and never commit it.",
        f"API_KEY_ENCRYPTION_SECRET={Fernet.generate_key().decode()}",
        f"INTERNAL_SECRET_SALT={secrets.token_urlsafe(32)}",
        "# Set to true only when you want to open Kushlof from your phone (prefer Tailscale).",
        "ALLOW_NETWORK_ACCESS=false",
        "FRONTEND_ORIGIN=http://localhost:5173",
        "USE_SECURE_COOKIES=false",
        "",
    ]
    ENVIRONMENT_FILE_PATH.write_text("\n".join(environment_file_lines), encoding="utf-8")


class Settings(BaseSettings):
    """All configurable values for the backend, read from environment variables or .env."""

    model_config = SettingsConfigDict(env_file=ENVIRONMENT_FILE_PATH, extra="ignore")

    api_key_encryption_secret: str
    internal_secret_salt: str
    allow_network_access: bool = False
    frontend_origin: str = "http://localhost:5173"
    use_secure_cookies: bool = False
    database_file_path: Path = DATA_FOLDER / "kushlof.db"
    session_lifetime_hours: int = 24 * 30
    maximum_upload_size_bytes: int = 10 * 1024 * 1024


def load_settings() -> Settings:
    """Ensure the .env file and data folder exist, then return the settings."""
    create_environment_file_if_missing()
    DATA_FOLDER.mkdir(parents=True, exist_ok=True)
    return Settings()


settings = load_settings()
