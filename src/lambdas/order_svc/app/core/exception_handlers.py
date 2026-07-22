"""
app.core.exception_handlers
===========================
Global exception → HTTP response mapping. Registered by ``app.main``.

Error envelope:
    {"success": false, "error": {"code": "...", "message": "...", "detail": {...}}}
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from shared.exceptions import (
    AppBaseException,
    AuthError,
    BadRequestError,
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from shared.structured_logger import get_logger

log = get_logger("exception_handlers")


def _err(code: str, msg: str, detail: dict | None = None) -> dict:
    body: dict = {"success": False, "error": {"code": code, "message": msg}}
    if detail:
        body["error"]["detail"] = detail
    return body


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI app."""

    @app.exception_handler(AuthError)
    async def auth_handler(r: Request, exc: AuthError):
        return JSONResponse(
            status_code=exc.http_status, content=_err(exc.error_code, exc.message)
        )

    @app.exception_handler(ForbiddenError)
    async def forbidden_handler(r: Request, exc: ForbiddenError):
        return JSONResponse(status_code=403, content=_err(exc.error_code, exc.message))

    @app.exception_handler(ResourceNotFoundError)
    async def not_found_handler(r: Request, exc: ResourceNotFoundError):
        return JSONResponse(status_code=404, content=_err(exc.error_code, exc.message))

    @app.exception_handler(BadRequestError)
    async def bad_request_handler(r: Request, exc: BadRequestError):
        return JSONResponse(
            status_code=400,
            content=_err(exc.error_code, exc.message, exc.context or None),
        )

    @app.exception_handler(ValidationError)
    async def validation_handler(r: Request, exc: ValidationError):
        return JSONResponse(status_code=422, content=_err(exc.error_code, exc.message))

    @app.exception_handler(AppBaseException)
    async def app_exc_handler(r: Request, exc: AppBaseException):
        log.error("app.exception", error_code=exc.error_code)
        return JSONResponse(
            status_code=exc.http_status, content=_err(exc.error_code, exc.message)
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(r: Request, exc: Exception):
        log.error(
            "unhandled.exception",
            exc_type=type(exc).__name__, exc_message=str(exc),
        )
        return JSONResponse(
            status_code=500,
            content=_err("INTERNAL_ERROR", "An unexpected error occurred."),
        )
