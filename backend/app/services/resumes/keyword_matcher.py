"""Finds skills and keywords in job descriptions and checks which ones a CV contains."""

import re

# Common skills recognised in job descriptions when no AI analysis is available yet.
COMMON_SKILLS_VOCABULARY = {
    # Programming and data
    "python", "java", "javascript", "typescript", "c#", "c++", "golang", "rust", "ruby", "php", "kotlin",
    "swift", "sql", "nosql", "scala", "html", "css", "react", "angular", "vue", "node.js", "django", "flask",
    "fastapi", "spring", ".net", "graphql", "rest api", "microservices",
    "pandas", "numpy", "spark", "hadoop", "airflow", "dbt", "kafka", "snowflake", "databricks", "etl",
    "machine learning", "deep learning", "nlp", "computer vision", "tensorflow", "pytorch", "scikit-learn",
    "data analysis", "data visualisation", "data visualization", "statistics", "a/b testing",
    "power bi", "tableau", "looker", "excel", "google analytics",
    # Cloud and ops
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform", "ansible", "jenkins",
    "ci/cd", "github actions", "linux", "git", "devops", "monitoring", "security",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "oracle",
    # Business and delivery
    "agile", "scrum", "kanban", "jira", "confluence", "project management", "product management",
    "stakeholder management", "requirements gathering", "business analysis", "change management",
    "risk management", "budgeting", "forecasting", "financial modelling", "financial modeling",
    "salesforce", "sap", "crm", "erp", "seo", "sem", "content marketing", "digital marketing",
    "social media", "copywriting", "customer service", "account management", "sales", "negotiation",
    "recruitment", "onboarding", "payroll", "procurement", "supply chain", "logistics", "operations",
    # Design
    "figma", "sketch", "adobe creative suite", "photoshop", "illustrator", "ux", "ui", "user research",
    # People skills
    "communication", "leadership", "teamwork", "problem solving", "presentation", "mentoring",
    "time management", "attention to detail", "collaboration",
}

KEYWORD_SYNONYMS = {
    "javascript": ["js"],
    "kubernetes": ["k8s"],
    "postgresql": ["postgres"],
    "machine learning": ["ml"],
    "artificial intelligence": ["ai"],
    "amazon web services": ["aws"],
    "aws": ["amazon web services"],
    "gcp": ["google cloud"],
    "google cloud": ["gcp"],
    "ci/cd": ["continuous integration", "continuous delivery", "continuous deployment"],
    "data visualisation": ["data visualization"],
    "data visualization": ["data visualisation"],
    "financial modelling": ["financial modeling"],
}


def normalise_keyword(keyword: str) -> str:
    """Lowercase a keyword and collapse spaces so variants compare equal."""
    return re.sub(r"\s+", " ", keyword.strip().lower())


def does_text_contain_keyword(text_lowercase: str, keyword: str) -> bool:
    """Check for a whole-word match of the keyword (or a known synonym) in already-lowercased text."""
    for keyword_variant in [keyword, *KEYWORD_SYNONYMS.get(keyword, [])]:
        whole_word_pattern = r"(?<![a-z0-9])" + re.escape(keyword_variant) + r"(?![a-z0-9])"
        if re.search(whole_word_pattern, text_lowercase):
            return True
    return False


def find_common_skills_in_text(text: str) -> list[str]:
    """Return the vocabulary skills mentioned in a piece of text."""
    text_lowercase = text.lower()
    return sorted(skill for skill in COMMON_SKILLS_VOCABULARY if does_text_contain_keyword(text_lowercase, skill))


def get_job_keywords(job_requirements: dict | None, job_description: str) -> list[str]:
    """Return the keywords a CV should cover: AI-extracted ones if available, otherwise vocabulary matches."""
    if job_requirements:
        extracted_keywords = (
            job_requirements.get("required_skills", [])
            + job_requirements.get("preferred_skills", [])
            + job_requirements.get("ats_keywords", [])
        )
        unique_keywords = list(dict.fromkeys(normalise_keyword(keyword) for keyword in extracted_keywords if keyword))
        if unique_keywords:
            return unique_keywords[:40]
    return find_common_skills_in_text(job_description)


def split_keywords_by_presence(keywords: list[str], resume_text: str) -> tuple[list[str], list[str]]:
    """Return (keywords found in the CV, keywords missing from the CV)."""
    resume_text_lowercase = resume_text.lower()
    matched_keywords = [keyword for keyword in keywords if does_text_contain_keyword(resume_text_lowercase, keyword)]
    missing_keywords = [keyword for keyword in keywords if keyword not in matched_keywords]
    return matched_keywords, missing_keywords
