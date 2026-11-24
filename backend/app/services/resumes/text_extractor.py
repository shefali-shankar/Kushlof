"""Extracts plain text from uploaded PDF and Word CV files."""

import io

import docx
import pymupdf

from app.core.file_validation import InvalidUploadError, ResumeFileType

MAXIMUM_PDF_PAGES = 10


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Read the text of every page in a PDF."""
    with pymupdf.open(stream=file_bytes, filetype="pdf") as pdf_document:
        if pdf_document.page_count > MAXIMUM_PDF_PAGES:
            raise InvalidUploadError(f"CVs longer than {MAXIMUM_PDF_PAGES} pages are not supported.")
        page_texts = [page.get_text("text") for page in pdf_document]
    return "\n".join(page_texts).strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Read the text of every paragraph and table in a Word document."""
    word_document = docx.Document(io.BytesIO(file_bytes))
    text_lines = [paragraph.text for paragraph in word_document.paragraphs if paragraph.text.strip()]
    for table in word_document.tables:
        for table_row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in table_row.cells if cell.text.strip())
            if row_text:
                text_lines.append(row_text)
    return "\n".join(text_lines).strip()


def extract_resume_text(file_bytes: bytes, file_type: ResumeFileType) -> str:
    """Extract text from a validated CV file, and reject files with no readable text."""
    resume_text = extract_text_from_pdf(file_bytes) if file_type == "pdf" else extract_text_from_docx(file_bytes)
    if len(resume_text) < 50:
        raise InvalidUploadError(
            "No readable text was found. If this is a scanned PDF, export it as a text PDF or Word file."
        )
    return resume_text
