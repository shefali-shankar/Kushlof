"""Encrypts AI provider API keys before they are stored, and masks them for display."""

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

secret_cipher = Fernet(settings.api_key_encryption_secret.encode())


def encrypt_secret(plain_text_secret: str) -> str:
    """Encrypt a secret (such as an API key) for storage in the database."""
    return secret_cipher.encrypt(plain_text_secret.encode()).decode()


def decrypt_secret(encrypted_secret: str) -> str:
    """Decrypt a stored secret. Raises ValueError if it was encrypted with a different key."""
    try:
        return secret_cipher.decrypt(encrypted_secret.encode()).decode()
    except InvalidToken as decryption_error:
        raise ValueError(
            "A saved API key could not be decrypted. Please enter it again in Settings."
        ) from decryption_error


def mask_secret(plain_text_secret: str) -> str:
    """Show only the start and last 4 characters of a secret, e.g. 'sk-…abcd'."""
    if len(plain_text_secret) <= 8:
        return "••••"
    return f"{plain_text_secret[:3]}…{plain_text_secret[-4:]}"
