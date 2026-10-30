"""
app.core.exception_handlers
===========================
Maps exceptions to the platform's standard error envelope:

    {"success": false, "error": {"code": "...", "message": "..."}}
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from shared.exceptions import AppBaseException
from shared.structured_logger import get_logger

log = get_logger("auth.exceptions")


def _envelope(code: str, message: str, detail: dict | None = None) -> dict:
    body: dict = {"success": False, "error": {"code": code, "message": message}}
    if detail:
        body["error"]["detail"] = detail
    return body


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(AppBaseException)
    async def _app_exception(request: Request, exc: AppBaseException):
        status = getattr(exc, "http_status", 400)
        code = getattr(exc, "error_code", "APP_ERROR")
        message = getattr(exc, "message", str(exc))

        log.error("app.exception", error_code=code, status_code=status)
        return JSONResponse(status_code=status, content=_envelope(code, message))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=_envelope(
                "VALIDATION_ERROR",
                "Request body failed validation.",
                {"errors": exc.errors()},
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.error("unhandled.exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content=_envelope("INTERNAL_ERROR", "An unexpected error occurred."),
        )
