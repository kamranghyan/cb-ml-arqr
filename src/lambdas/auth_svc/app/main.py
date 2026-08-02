"""
app.main
========
FastAPI entry point for auth_svc. Mangum wraps the ASGI app for
AWS Lambda + API Gateway (see ../handler.py).

Routes: /auth/*  +  /health
"""
from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from shared.structured_logger import bind_correlation_id, get_logger

from app.api.v1 import api_router
from app.core.exception_handlers import register_exception_handlers

log = get_logger("auth_svc")

SERVICE_VERSION = "1.0.0"

app = FastAPI(
    title="auth-svc",
    version=SERVICE_VERSION,
    description="MenuLay — authentication, registration, tenant management",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    correlation_id = str(uuid.uuid4())
    bind_correlation_id(correlation_id)
    started = time.perf_counter()

    log.info("request.started", method=request.method, path=request.url.path)

    response = await call_next(request)

    log.info(
        "request.completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round((time.perf_counter() - started) * 1000, 2),
    )
    return response


register_exception_handlers(app)
app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "auth-svc", "version": SERVICE_VERSION}


handler = Mangum(app)
