"""Fetches web pages from user-supplied links without letting them reach private or internal addresses (SSRF protection)."""

import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx

MAXIMUM_REDIRECTS = 3
REQUEST_TIMEOUT_SECONDS = 10
MAXIMUM_RESPONSE_BYTES = 5 * 1024 * 1024
BROWSER_LIKE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


class UnsafeUrlError(ValueError):
    """Raised when a link points somewhere Kushlof refuses to fetch."""


class WebPageFetchError(ValueError):
    """Raised when a website could not be reached or answered with an error. status_code is None for connection problems."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def is_ip_address_public(ip_address_text: str) -> bool:
    """Return True only for internet-routable addresses (not private, loopback, link-local or reserved)."""
    return ipaddress.ip_address(ip_address_text).is_global


def ensure_url_is_public(url: str) -> None:
    """Raise UnsafeUrlError unless the URL is http(s) and every address its host resolves to is public."""
    parsed_url = urlparse(url)
    if parsed_url.scheme not in {"http", "https"}:
        raise UnsafeUrlError("Only http and https links are supported.")
    if not parsed_url.hostname:
        raise UnsafeUrlError("The link has no website address.")
    try:
        resolved_addresses = socket.getaddrinfo(parsed_url.hostname, parsed_url.port or 443)
    except socket.gaierror as lookup_error:
        raise UnsafeUrlError("That website address could not be found.") from lookup_error
    for address_info in resolved_addresses:
        resolved_ip_address = str(address_info[4][0])
        if not is_ip_address_public(resolved_ip_address):
            raise UnsafeUrlError("Links to private or local network addresses are not allowed.")


def fetch_public_web_page(url: str) -> str:
    """Download a public web page's HTML, re-checking every redirect and capping the response size."""
    try:
        return download_page_following_safe_redirects(url)
    except httpx.TransportError as connection_error:
        raise WebPageFetchError("The website could not be reached. Check your internet connection.") from connection_error


def download_page_following_safe_redirects(url: str) -> str:
    """Follow up to MAXIMUM_REDIRECTS redirects by hand, checking each destination is public before requesting it."""
    current_url = url
    with httpx.Client(
        follow_redirects=False, timeout=REQUEST_TIMEOUT_SECONDS, headers=BROWSER_LIKE_HEADERS
    ) as http_client:
        for _ in range(MAXIMUM_REDIRECTS + 1):
            ensure_url_is_public(current_url)
            with http_client.stream("GET", current_url) as http_response:
                if http_response.is_redirect:
                    redirect_target = http_response.headers.get("location", "")
                    current_url = urljoin(current_url, redirect_target)
                    continue
                if http_response.status_code >= 400:
                    raise WebPageFetchError(
                        f"The website responded with an error ({http_response.status_code}).",
                        status_code=http_response.status_code,
                    )
                downloaded_bytes = bytearray()
                for content_chunk in http_response.iter_bytes():
                    downloaded_bytes.extend(content_chunk)
                    if len(downloaded_bytes) > MAXIMUM_RESPONSE_BYTES:
                        raise UnsafeUrlError("The page is too large to import.")
                return downloaded_bytes.decode(http_response.encoding or "utf-8", errors="replace")
    raise UnsafeUrlError("The link redirected too many times.")
