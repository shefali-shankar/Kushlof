"""Converts structured CV content into plain text for keyword matching and AI prompts."""

from app.schemas.resume_content import ResumeContent


def list_all_bullet_points(resume_content: ResumeContent) -> list[str]:
    """Return every highlight bullet from work experience and projects."""
    work_bullets = [bullet for job in resume_content.work for bullet in job.highlights]
    project_bullets = [bullet for project in resume_content.projects for bullet in project.highlights]
    return [bullet for bullet in work_bullets + project_bullets if bullet.strip()]


def list_all_skills(resume_content: ResumeContent) -> list[str]:
    """Return every skill keyword in the CV."""
    return [skill for group in resume_content.skills for skill in group.keywords if skill.strip()]


def convert_resume_to_plain_text(resume_content: ResumeContent) -> str:
    """Flatten the whole CV into readable plain text."""
    basics = resume_content.basics
    text_lines = [basics.name, basics.headline, basics.email, basics.phone, basics.location, resume_content.summary]
    for job in resume_content.work:
        text_lines.append(f"{job.position} at {job.company} ({job.start_date} - {job.end_date})")
        text_lines.extend(job.highlights)
    for qualification in resume_content.education:
        text_lines.append(f"{qualification.degree} {qualification.field_of_study}, {qualification.institution}")
    for skill_group in resume_content.skills:
        text_lines.append(f"{skill_group.name}: {', '.join(skill_group.keywords)}")
    for project in resume_content.projects:
        text_lines.append(f"{project.name}: {project.description}")
        text_lines.extend(project.highlights)
    for certification in resume_content.certifications:
        text_lines.append(f"{certification.name} {certification.issuer}")
    return "\n".join(line for line in text_lines if line and line.strip())
