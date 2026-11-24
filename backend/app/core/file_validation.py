"""Checks uploaded CV files are genuine, safe-sized PDF or Word documents before they are read."""

import io
import zipfile
from typing import Literal

from app.core.config import settings

MAXIMUM_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
MAXIMUM_DOCX_ENTRIES = 2000

ResumeFileType = Literal["pdf", "docx"]


class InvalidUploadError(ValueError):
    """Raised when an uploaded file is rejected."""


def detect_resume_file_type(file_bytes: bytes) -> ResumeFileType:
    """Identify the file by its actual content (not its name) and reject anything that is not PDF or DOCX."""
    if len(file_bytes) == 0:
        raise InvalidUploadError("The file is empty.")
    if len(file_bytes) > settings.maximum_upload_size_bytes:
        raise InvalidUploadError("The file is larger than 10 MB.")
    if file_bytes.startswith(b"%PDF-"):
        return "pdf"
    if file_bytes.startswith(b"PK\x03\x04"):
        ensure_docx_is_safe(file_bytes)
        return "docx"
    raise InvalidUploadError("Only PDF and Word (.docx) files are supported.")


def ensure_docx_is_safe(file_bytes: bytes) -> None:
    """Confirm a ZIP file is a Word document and is not a 'zip bomb' that expands to a huge size."""
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx_archive:
            archive_entries = docx_archive.infolist()
            if len(archive_entries) > MAXIMUM_DOCX_ENTRIES:
                raise InvalidUploadError("The Word file has too many parts.")
            if sum(entry.file_size for entry in archive_entries) > MAXIMUM_DOCX_UNCOMPRESSED_BYTES:
                raise InvalidUploadError("The Word file expands to an unsafe size.")
            if "word/document.xml" not in docx_archive.namelist():
                raise InvalidUploadError("This ZIP file is not a Word document.")
    except zipfile.BadZipFile as zip_error:
        raise InvalidUploadError("The Word file is damaged.") from zip_error
