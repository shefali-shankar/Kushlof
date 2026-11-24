"""Tests for ATS scoring and keyword matching."""

from app.schemas.resume_content import Education, ResumeBasics, ResumeContent, SkillGroup, WorkExperience
from app.services.resumes.ats_scorer import calculate_ats_score
from app.services.resumes.keyword_matcher import get_job_keywords, split_keywords_by_presence


def build_strong_resume() -> ResumeContent:
    return ResumeContent(
        basics=ResumeBasics(name="Alex Taylor", headline="Data Analyst", email="alex@example.com", phone="+61 400 000 000"),
        summary=(
            "Data analyst with six years of experience turning messy operational data into clear dashboards and "
            "decisions for retail and logistics teams, with strong SQL, Python and stakeholder skills."
        ),
        work=[
            WorkExperience(
                company="Acme Retail",
                position="Senior Data Analyst",
                start_date="2021",
                end_date="Present",
                highlights=[
                    "Built 12 Power BI dashboards used weekly by 40 store managers",
                    "Reduced monthly reporting time by 60% by automating SQL pipelines in Python",
                    "Led a pricing analysis that increased margin by 3% across 120 products",
                ],
            )
        ],
        education=[Education(institution="University of Sydney", degree="Bachelor of Commerce")],
        skills=[SkillGroup(name="Technical", keywords=["SQL", "Python", "Power BI", "Excel", "Tableau", "Statistics"])],
    )


def test_strong_resume_scores_well_without_a_job() -> None:
    report = calculate_ats_score(build_strong_resume())
    assert report.keyword_score is None
    assert report.formatting_score >= 75
    assert report.total_score >= 70


def test_empty_resume_scores_low_with_suggestions() -> None:
    report = calculate_ats_score(ResumeContent())
    assert report.total_score < 30
    assert any(suggestion.section == "basics" for suggestion in report.suggestions)


def test_keyword_matching_reports_matched_and_missing() -> None:
    report = calculate_ats_score(build_strong_resume(), ["sql", "python", "snowflake"])
    assert report.matched_keywords == ["sql", "python"]
    assert report.missing_keywords == ["snowflake"]
    assert report.keyword_score == 67


def test_keywords_match_whole_words_and_synonyms() -> None:
    matched, missing = split_keywords_by_presence(["java", "kubernetes"], "Experienced with JavaScript and k8s")
    assert matched == ["kubernetes"]
    assert missing == ["java"]


def test_job_keywords_prefer_ai_requirements() -> None:
    requirements = {"required_skills": ["SQL", "dbt"], "preferred_skills": ["Looker"], "ats_keywords": ["sql"]}
    assert get_job_keywords(requirements, "ignored description") == ["sql", "dbt", "looker"]


def test_job_keywords_fall_back_to_vocabulary() -> None:
    assert "python" in get_job_keywords(None, "We need strong Python and SQL skills.")
