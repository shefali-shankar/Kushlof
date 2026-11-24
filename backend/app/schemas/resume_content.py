"""The structured shape of a CV. Every CV feature (editing, scoring, tailoring, export) works on this."""

from typing import Literal

from pydantic import BaseModel, Field

ResumeSectionName = Literal["summary", "work", "education", "skills", "projects", "certifications"]


class ResumeBasics(BaseModel):
    """Name and contact details shown at the top of the CV."""

    name: str = ""
    headline: str = Field(default="", description="Professional title, e.g. 'Senior Data Analyst'")
    email: str = ""
    phone: str = ""
    location: str = ""
    website: str = ""
    linkedin: str = ""


class WorkExperience(BaseModel):
    """One job in the work history."""

    company: str = ""
    position: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = Field(default="", description="Use 'Present' for a current role")
    highlights: list[str] = Field(default_factory=list, description="Achievement bullet points")


class Education(BaseModel):
    """One qualification."""

    institution: str = ""
    degree: str = ""
    field_of_study: str = ""
    start_date: str = ""
    end_date: str = ""
    grade: str = ""


class SkillGroup(BaseModel):
    """A named group of skills, e.g. 'Programming': ['Python', 'SQL']."""

    name: str = ""
    keywords: list[str] = Field(default_factory=list)


class Project(BaseModel):
    """A personal or professional project."""

    name: str = ""
    description: str = ""
    url: str = ""
    highlights: list[str] = Field(default_factory=list)


class Certification(BaseModel):
    """A certificate or licence."""

    name: str = ""
    issuer: str = ""
    date: str = ""


class ResumeContent(BaseModel):
    """A complete CV."""

    basics: ResumeBasics = Field(default_factory=ResumeBasics)
    summary: str = ""
    work: list[WorkExperience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    skills: list[SkillGroup] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
