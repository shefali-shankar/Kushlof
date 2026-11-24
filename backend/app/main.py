"""Creates the Kushlof FastAPI application: security middleware, error handling and the API routes."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.database import create_database_tables
from app.core.http_security import SecurityHeadersMiddleware
from app.services.ai.base_provider import AIProviderError
from app.services.jobs.job_link_importer import JobImportError
from app.services.jobs.jobspy_fetcher import JobFetchError
from app.services.pipeline.application_pipeline import (
    PipelineAlreadyRunningError,
    mark_interrupted_runs_as_failed,
)


@asynccontextmanager
async def prepare_application(application: FastAPI) -> AsyncIterator[None]:
    """Create database tables and tidy up interrupted pipeline runs before serving requests."""
    create_database_tables()
    mark_interrupted_runs_as_failed()
    yield


app = FastAPI(
    title="Kushlof API",
    lifespan=prepare_application,
    # Interactive API docs are only offered when Kushlof is limited to this computer.
    docs_url=None if settings.allow_network_access else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.allow_network_access else "/api/openapi.json",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Requested-With"],
)


def add_error_handler(error_class: type[Exception], http_status_code: int) -> None:
    """Turn a known error type into a JSON response whose message the frontend shows to the user."""

    async def handle_error(_: Request, raised_error: Exception) -> JSONResponse:
        return JSONResponse(status_code=http_status_code, content={"detail": str(raised_error)})

    app.add_exception_handler(error_class, handle_error)


add_error_handler(AIProviderError, 502)
add_error_handler(JobFetchError, 502)
add_error_handler(JobImportError, 422)
add_error_handler(PipelineAlreadyRunningError, 409)
add_error_handler(ValueError, 400)  # Includes invalid uploads and unsafe links.

app.include_router(api_router)
