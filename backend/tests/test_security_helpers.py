"""Tests for link safety (SSRF), upload validation, API key encryption and fact protection."""

import io
import zipfile

import pytest

from app.core.encryption import decrypt_secret, encrypt_secret, mask_secret
from app.core.file_validation import InvalidUploadError, detect_resume_file_type
from app.core.url_safety import UnsafeUrlError, ensure_url_is_public, is_ip_address_public
from app.schemas.resume_content import Education, ResumeContent, SkillGroup, WorkExperience
from app.services.resumes.fact_protection import protect_resume_facts


@pytest.mark.parametrize("private_address", ["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "::1"])
def test_private_addresses_are_not_public(private_address: str) -> None:
    assert is_ip_address_public(private_address) is False


def test_public_address_is_public() -> None:
    assert is_ip_address_public("8.8.8.8") is True


@pytest.mark.parametrize("unsafe_url", ["http://127.0.0.1/admin", "http://localhost:8000/api", "file:///etc/passwd", "ftp://example.com"])
def test_unsafe_urls_are_rejected(unsafe_url: str) -> None:
    with pytest.raises(UnsafeUrlError):
        ensure_url_is_public(unsafe_url)


def build_docx_bytes(include_document_xml: bool = True) -> bytes:
    archive_buffer = io.BytesIO()
    with zipfile.ZipFile(archive_buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        if include_document_xml:
            archive.writestr("word/document.xml", "<document/>")
    return archive_buffer.getvalue()


def test_pdf_and_docx_are_accepted() -> None:
    assert detect_resume_file_type(b"%PDF-1.7 rest of file") == "pdf"
    assert detect_resume_file_type(build_docx_bytes()) == "docx"


@pytest.mark.parametrize("bad_file", [b"", b"MZ\x90\x00 windows program", b"plain text cv"])
def test_other_files_are_rejected(bad_file: bytes) -> None:
    with pytest.raises(InvalidUploadError):
        detect_resume_file_type(bad_file)


def test_zip_that_is_not_word_is_rejected() -> None:
    with pytest.raises(InvalidUploadError):
        detect_resume_file_type(build_docx_bytes(include_document_xml=False))


def test_api_keys_round_trip_and_are_masked() -> None:
    encrypted_key = encrypt_secret("sk-test-1234567890abcd")
    assert "1234567890" not in encrypted_key
    assert decrypt_secret(encrypted_key) == "sk-test-1234567890abcd"
    assert mask_secret("sk-test-1234567890abcd") == "sk-…abcd"


def test_fact_protection_restores_facts_and_removes_invented_skills() -> None:
    original = ResumeContent(
        work=[WorkExperience(company="Acme", position="Analyst", start_date="2020", end_date="2023", highlights=["Made reports"])],
        education=[Education(institution="Uni", degree="BSc")],
        skills=[SkillGroup(name="Tools", keywords=["Excel", "SQL"])],
    )
    ai_edited = ResumeContent(
        work=[WorkExperience(company="Google", position="Director", start_date="2015", end_date="2023",
                             highlights=["Built 25 reports in SQL for 3 teams"])],
        education=[Education(institution="Harvard", degree="PhD")],
        skills=[SkillGroup(name="Tools", keywords=["SQL", "Kubernetes", "Excel"])],
    )
    protected, warnings = protect_resume_facts(original, ai_edited)
    assert protected.work[0].company == "Acme"
    assert protected.work[0].position == "Analyst"
    assert protected.work[0].start_date == "2020"
    assert protected.work[0].highlights == ["Built 25 reports in SQL for 3 teams"]
    assert protected.education[0].institution == "Uni"
    assert protected.skills[0].keywords == ["SQL", "Excel"]
    assert len(warnings) == 1  # "25" and "3" are not in the original CV
