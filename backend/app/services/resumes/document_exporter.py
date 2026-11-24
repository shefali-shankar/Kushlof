"""Exports CVs and cover letters as PDF (via a headless Chromium browser) or Word (.docx) files."""

import io
import re

import docx
from docx.document import Document as WordDocument
from docx.shared import Pt

from app.schemas.resume_content import ResumeBasics, ResumeContent


def convert_html_to_pdf(html_document: str) -> bytes:
    """Print an HTML document to an A4 PDF.

    JavaScript is disabled and every network request is blocked, so the document cannot load
    remote content or reach local files while it is rendered.
    """
    from playwright.sync_api import sync_playwright  # Imported here so the app starts even before Playwright is set up.

    with sync_playwright() as playwright_instance:
        browser = playwright_instance.chromium.launch()
        try:
            browser_context = browser.new_context(java_script_enabled=False)
            browser_page = browser_context.new_page()
            browser_page.route("**/*", lambda blocked_request: blocked_request.abort())
            browser_page.set_content(html_document, wait_until="load")
            return browser_page.pdf(format="A4", print_background=True, prefer_css_page_size=True)
        finally:
            browser.close()


def make_safe_file_name(name_text: str, fallback_name: str) -> str:
    """Turn any text into a safe file name (letters, numbers, dashes and underscores only)."""
    safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", name_text).strip("_")[:80]
    return safe_name or fallback_name


def add_section_heading(word_document: WordDocument, heading_text: str) -> None:
    """Add an uppercase section heading such as 'WORK EXPERIENCE'."""
    heading_paragraph = word_document.add_paragraph()
    heading_run = heading_paragraph.add_run(heading_text.upper())
    heading_run.bold = True
    heading_run.font.size = Pt(11.5)


def add_bullet_points(word_document: WordDocument, bullet_texts: list[str]) -> None:
    """Add a bulleted list."""
    for bullet_text in bullet_texts:
        if bullet_text.strip():
            word_document.add_paragraph(bullet_text, style="List Bullet")


def format_date_range(start_date: str, end_date: str) -> str:
    """Return 'start – end', or whichever part exists."""
    return " – ".join(part for part in [start_date, end_date] if part)


def convert_resume_to_docx(resume_content: ResumeContent) -> bytes:
    """Build an ATS-friendly single-column Word document from the CV."""
    word_document = docx.Document()
    default_style = word_document.styles["Normal"]
    default_style.font.name = "Calibri"
    default_style.font.size = Pt(10.5)

    basics = resume_content.basics
    name_run = word_document.add_paragraph().add_run(basics.name)
    name_run.bold = True
    name_run.font.size = Pt(20)
    if basics.headline:
        word_document.add_paragraph(basics.headline)
    contact_items = [basics.email, basics.phone, basics.location, basics.linkedin, basics.website]
    word_document.add_paragraph(" | ".join(item for item in contact_items if item))

    if resume_content.summary:
        add_section_heading(word_document, "Professional Summary")
        word_document.add_paragraph(resume_content.summary)

    if resume_content.work:
        add_section_heading(word_document, "Work Experience")
        for job in resume_content.work:
            job_title_paragraph = word_document.add_paragraph()
            job_title_paragraph.add_run(f"{job.position}, {job.company}").bold = True
            job_title_paragraph.add_run(f"    {format_date_range(job.start_date, job.end_date)}")
            if job.location:
                word_document.add_paragraph(job.location).runs[0].italic = True
            add_bullet_points(word_document, job.highlights)

    if resume_content.skills:
        add_section_heading(word_document, "Skills")
        for skill_group in resume_content.skills:
            skills_paragraph = word_document.add_paragraph()
            if skill_group.name:
                skills_paragraph.add_run(f"{skill_group.name}: ").bold = True
            skills_paragraph.add_run(", ".join(skill_group.keywords))

    if resume_content.projects:
        add_section_heading(word_document, "Projects")
        for project in resume_content.projects:
            word_document.add_paragraph().add_run(project.name).bold = True
            if project.description:
                word_document.add_paragraph(project.description)
            add_bullet_points(word_document, project.highlights)

    if resume_content.education:
        add_section_heading(word_document, "Education")
        for qualification in resume_content.education:
            qualification_paragraph = word_document.add_paragraph()
            degree_text = ", ".join(part for part in [qualification.degree, qualification.field_of_study] if part)
            qualification_paragraph.add_run(degree_text).bold = True
            qualification_paragraph.add_run(
                f" — {qualification.institution}    {format_date_range(qualification.start_date, qualification.end_date)}"
            )

    if resume_content.certifications:
        add_section_heading(word_document, "Certifications")
        add_bullet_points(
            word_document,
            [
                " — ".join(part for part in [certification.name, certification.issuer, certification.date] if part)
                for certification in resume_content.certifications
            ],
        )

    output_buffer = io.BytesIO()
    word_document.save(output_buffer)
    return output_buffer.getvalue()


def convert_cover_letter_to_docx(letter_body: str, candidate_basics: ResumeBasics) -> bytes:
    """Build a Word document for a cover letter."""
    word_document = docx.Document()
    word_document.styles["Normal"].font.name = "Calibri"
    word_document.styles["Normal"].font.size = Pt(11)
    sender_run = word_document.add_paragraph().add_run(candidate_basics.name)
    sender_run.bold = True
    sender_run.font.size = Pt(14)
    contact_items = [candidate_basics.email, candidate_basics.phone, candidate_basics.location]
    word_document.add_paragraph(" | ".join(item for item in contact_items if item))
    for paragraph_text in letter_body.split("\n\n"):
        if paragraph_text.strip():
            word_document.add_paragraph(paragraph_text.strip())
    output_buffer = io.BytesIO()
    word_document.save(output_buffer)
    return output_buffer.getvalue()
