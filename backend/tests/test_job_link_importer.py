"""Tests for reading LinkedIn job links, using fake responses instead of real network calls."""

import pytest

from app.core.url_safety import WebPageFetchError
from app.services.jobs import job_link_importer
from app.services.jobs.job_link_importer import JobImportError, find_linkedin_job_id, import_job_from_url

LINKEDIN_GUEST_PAGE_HTML = """
<h2 class="top-card-layout__title">Data Analyst</h2>
<a class="topcard__org-name-link">Example Pty Ltd</a>
<span class="topcard__flavor--bullet">Sydney, NSW</span>
<div class="show-more-less-html__markup"><p>Build dashboards with SQL and Power BI.</p></div>
"""


def test_finds_job_id_in_common_linkedin_link_formats():
    assert find_linkedin_job_id("https://www.linkedin.com/jobs/view/4492271387/") == "4492271387"
    assert find_linkedin_job_id("https://www.linkedin.com/jobs/view/data-analyst-at-example-4492271387") == "4492271387"
    assert find_linkedin_job_id("https://www.linkedin.com/jobs/search/?currentJobId=4492271387") == "4492271387"


def test_reads_job_from_linkedin_guest_page(monkeypatch):
    monkeypatch.setattr(job_link_importer, "fetch_public_web_page", lambda url: LINKEDIN_GUEST_PAGE_HTML)
    imported_job = import_job_from_url("https://www.linkedin.com/jobs/view/4492271387/")
    assert imported_job.title == "Data Analyst"
    assert imported_job.company == "Example Pty Ltd"
    assert "Power BI" in imported_job.description


def test_rate_limited_linkedin_gives_clear_wait_message(monkeypatch):
    def fake_rate_limited_fetch(url: str) -> str:
        raise WebPageFetchError("Too many requests", status_code=429)

    monkeypatch.setattr(job_link_importer, "fetch_public_web_page", fake_rate_limited_fetch)
    with pytest.raises(JobImportError, match="temporarily limiting"):
        import_job_from_url("https://www.linkedin.com/jobs/view/4492271387/")


def test_falls_back_to_normal_job_page_when_guest_api_fails(monkeypatch):
    def fake_fetch(url: str) -> str:
        if "jobs-guest" in url:
            raise WebPageFetchError("Not found", status_code=404)
        return LINKEDIN_GUEST_PAGE_HTML

    monkeypatch.setattr(job_link_importer, "fetch_public_web_page", fake_fetch)
    assert import_job_from_url("https://www.linkedin.com/jobs/view/4492271387/").title == "Data Analyst"
