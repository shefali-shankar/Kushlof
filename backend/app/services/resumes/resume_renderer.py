"""Renders CVs and cover letters as HTML documents using the Jinja templates in app/templates."""

from datetime import date

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import TEMPLATES_FOLDER
from app.schemas.resume_content import ResumeBasics, ResumeContent

RESUME_TEMPLATE_FILES = {
    "classic": "resume_classic.html",
    "modern": "resume_modern.html",
}

# Autoescaping makes sure text from a CV can never inject HTML or scripts into the document.
template_environment = Environment(
    loader=FileSystemLoader(TEMPLATES_FOLDER),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_resume_html(resume_content: ResumeContent, template_name: str) -> str:
    """Return the CV as a complete HTML page in the chosen design."""
    template_file_name = RESUME_TEMPLATE_FILES.get(template_name, RESUME_TEMPLATE_FILES["classic"])
    return template_environment.get_template(template_file_name).render(resume=resume_content)


def render_cover_letter_html(
    letter_body: str, candidate_basics: ResumeBasics, job_title: str, company_name: str
) -> str:
    """Return a cover letter as a complete HTML page."""
    return template_environment.get_template("cover_letter.html").render(
        paragraphs=[paragraph.strip() for paragraph in letter_body.split("\n\n") if paragraph.strip()],
        basics=candidate_basics,
        job_title=job_title,
        company_name=company_name,
        today=date.today().strftime("%d %B %Y"),
    )
