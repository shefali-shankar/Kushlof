"""Imports a job from a pasted link (LinkedIn or any job page).

Tries, in order: LinkedIn's public job page, structured schema.org JobPosting data, then the page's main text.
If the site blocks the request, the user can paste the job description text instead.
"""

import json
import re
from dataclasses import dataclass
from typing import Any

from bs4 import BeautifulSoup

from app.core.url_safety import WebPageFetchError, fetch_public_web_page

LINKEDIN_JOB_ID_PATTERNS = [
    re.compile(r"linkedin\.com/jobs/view/(?:[^/?#]*?-)?(\d{6,})"),
    re.compile(r"[?&]currentJobId=(\d{6,})"),
]
LINKEDIN_PUBLIC_JOB_URL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
LINKEDIN_JOB_VIEW_URL = "https://www.linkedin.com/jobs/view/{job_id}/"
HTTP_TOO_MANY_REQUESTS = 429
MAXIMUM_FALLBACK_TEXT_CHARACTERS = 20_000


class JobImportError(Exception):
    """Raised when a job page cannot be read. The message is shown to the user."""


@dataclass
class ImportedJobDetails:
    """The details read from a job page."""

    title: str
    company: str
    location: str
    description: str
    source: str
    is_remote: bool = False


def convert_html_to_text(html_fragment: str) -> str:
    """Turn an HTML fragment into readable plain text with line breaks kept."""
    text = BeautifulSoup(html_fragment, "html.parser").get_text("\n")
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def find_linkedin_job_id(url: str) -> str | None:
    """Return the numeric job ID from a LinkedIn job link, if it is one."""
    for id_pattern in LINKEDIN_JOB_ID_PATTERNS:
        id_match = id_pattern.search(url)
        if id_match:
            return id_match.group(1)
    return None


def read_linkedin_job_page(page_html: str) -> ImportedJobDetails | None:
    """Pull the job out of a LinkedIn job page's HTML. Returns None if the page has no description."""
    page = BeautifulSoup(page_html, "html.parser")

    def read_text(css_selector: str) -> str:
        found_element = page.select_one(css_selector)
        return found_element.get_text(" ", strip=True) if found_element else ""

    description_element = page.select_one("div.show-more-less-html__markup") or page.select_one("div.description__text")
    description_text = convert_html_to_text(str(description_element)) if description_element else ""
    if not description_text:
        structured_details = import_from_structured_data(page)
        if structured_details and structured_details.description:
            structured_details.source = "linkedin"
            return structured_details
        return None
    location_text = read_text("span.topcard__flavor--bullet")
    return ImportedJobDetails(
        title=read_text("h2.top-card-layout__title") or read_text("h1"),
        company=read_text("a.topcard__org-name-link") or read_text("span.topcard__flavor"),
        location=location_text,
        description=description_text,
        source="linkedin",
        is_remote="remote" in location_text.lower(),
    )


def import_linkedin_job(linkedin_job_id: str) -> ImportedJobDetails:
    """Read a LinkedIn job without signing in: first the guest job API, then the normal public job page."""
    page_addresses = [
        LINKEDIN_PUBLIC_JOB_URL.format(job_id=linkedin_job_id),
        LINKEDIN_JOB_VIEW_URL.format(job_id=linkedin_job_id),
    ]
    was_rate_limited = False
    for page_address in page_addresses:
        try:
            imported_details = read_linkedin_job_page(fetch_public_web_page(page_address))
        except WebPageFetchError as fetch_error:
            if fetch_error.status_code == HTTP_TOO_MANY_REQUESTS:
                was_rate_limited = True
                continue
            if fetch_error.status_code is None:
                raise JobImportError(str(fetch_error)) from fetch_error
            continue
        if imported_details:
            return imported_details

    if was_rate_limited:
        raise JobImportError(
            "LinkedIn is temporarily limiting requests from your internet connection (usually after a big job search). "
            "Wait 15–60 minutes and try again, or paste the job description text instead."
        )
    raise JobImportError(
        "LinkedIn did not show this job without signing in (it may be closed or private). Paste the job description text instead."
    )


def find_job_posting_data(json_ld_data: Any) -> dict[str, Any] | None:
    """Search JSON-LD data (which may be a list or a @graph) for a schema.org JobPosting object."""
    if isinstance(json_ld_data, list):
        for item in json_ld_data:
            found_posting = find_job_posting_data(item)
            if found_posting:
                return found_posting
    elif isinstance(json_ld_data, dict):
        item_type = json_ld_data.get("@type")
        if item_type == "JobPosting" or (isinstance(item_type, list) and "JobPosting" in item_type):
            return json_ld_data
        if "@graph" in json_ld_data:
            return find_job_posting_data(json_ld_data["@graph"])
    return None


def read_job_location(job_posting: dict[str, Any]) -> str:
    """Build 'City, Region, Country' from a JobPosting's jobLocation."""
    job_location = job_posting.get("jobLocation")
    if isinstance(job_location, list):
        job_location = job_location[0] if job_location else None
    if not isinstance(job_location, dict):
        return ""
    address = job_location.get("address", {})
    if isinstance(address, str):
        return address
    location_parts = [address.get("addressLocality"), address.get("addressRegion"), address.get("addressCountry")]
    return ", ".join(str(part) for part in location_parts if part and isinstance(part, str))


def import_from_structured_data(page: BeautifulSoup) -> ImportedJobDetails | None:
    """Read a job from the schema.org JobPosting data many job sites embed for search engines."""
    for script_element in page.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            json_ld_data = json.loads(script_element.string or "")
        except json.JSONDecodeError:
            continue
        job_posting = find_job_posting_data(json_ld_data)
        if not job_posting:
            continue
        hiring_organization = job_posting.get("hiringOrganization") or {}
        company_name = hiring_organization.get("name", "") if isinstance(hiring_organization, dict) else str(hiring_organization)
        return ImportedJobDetails(
            title=str(job_posting.get("title", "")),
            company=str(company_name),
            location=read_job_location(job_posting),
            description=convert_html_to_text(str(job_posting.get("description", ""))),
            source="imported",
            is_remote=job_posting.get("jobLocationType") == "TELECOMMUTE",
        )
    return None


def import_from_page_text(page: BeautifulSoup) -> ImportedJobDetails:
    """Last resort: use the page title and its main visible text."""
    for unwanted_element in page(["script", "style", "nav", "header", "footer", "noscript", "svg", "form"]):
        unwanted_element.decompose()
    main_content = page.find("main") or page.find("article") or page.body
    page_text = convert_html_to_text(str(main_content)) if main_content else ""
    if len(page_text) < 200:
        raise JobImportError("Could not find a job description on that page. Paste the description text instead.")
    page_title = page.title.get_text(strip=True) if page.title else ""
    return ImportedJobDetails(
        title=page_title[:300],
        company="",
        location="",
        description=page_text[:MAXIMUM_FALLBACK_TEXT_CHARACTERS],
        source="imported",
    )


def import_job_from_url(url: str) -> ImportedJobDetails:
    """Read a job's details from a link."""
    linkedin_job_id = find_linkedin_job_id(url)
    if linkedin_job_id:
        return import_linkedin_job(linkedin_job_id)

    try:
        page_html = fetch_public_web_page(url)
    except ValueError as fetch_error:
        raise JobImportError(str(fetch_error)) from fetch_error
    page = BeautifulSoup(page_html, "html.parser")
    return import_from_structured_data(page) or import_from_page_text(page)
