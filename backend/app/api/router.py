"""Combines every API route module under the /api prefix.

Only the auth routes are public. Every other router is included with the require_signed_in_user
dependency, so it cannot be used without signing in (a test enforces this).
"""

from fastapi import APIRouter, Depends

from app.api.dependencies import require_signed_in_user
from app.api.routes import ai_settings, applications, auth, cover_letters, dashboard, jobs, pipeline, resumes

api_router = APIRouter(prefix="/api")

# Public: sign in, sign out, session status.
api_router.include_router(auth.router)

# Protected: everything else.
protected_router = APIRouter(dependencies=[Depends(require_signed_in_user)])
for route_module in [dashboard, resumes, jobs, applications, cover_letters, ai_settings, pipeline]:
    protected_router.include_router(route_module.router)
api_router.include_router(protected_router)
