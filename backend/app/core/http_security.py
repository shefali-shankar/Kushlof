"""Adds protective HTTP headers to API responses and blocks cross-site requests (CSRF)."""

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

STATE_CHANGING_HTTP_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_HEADER_NAME = "X-Requested-With"
CSRF_HEADER_VALUE = "Kushlof"

SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Rejects API writes missing the Kushlof header, and adds security headers to every API response."""

    async def dispatch(
        self, http_request: Request, call_next_handler: RequestResponseEndpoint
    ) -> Response:
        is_api_request = http_request.url.path.startswith("/api")
        is_state_changing = http_request.method in STATE_CHANGING_HTTP_METHODS
        has_csrf_header = http_request.headers.get(CSRF_HEADER_NAME) == CSRF_HEADER_VALUE

        # Browsers cannot add custom headers to cross-site form posts, so this header proves
        # the request came from Kushlof's own frontend.
        if is_api_request and is_state_changing and not has_csrf_header:
            http_response: Response = JSONResponse(
                status_code=403, content={"detail": "Missing request verification header."}
            )
        else:
            http_response = await call_next_handler(http_request)

        if is_api_request:
            for header_name, header_value in SECURITY_HEADERS.items():
                http_response.headers[header_name] = header_value
        return http_response
