"""
app.main
========
FastAPI application entry point. Mangum wraps the ASGI app for AWS
Lambda + API Gateway (see ../handler.py for the Lambda entry point
that wraps this).

Routes: /orders/*  +  /health
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

log = get_logger("order_svc")

SERVICE_VERSION = "2.0.0"

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="order-svc",
    version=SERVICE_VERSION,
    description="MenuLay — Order management: create, list, get, update (+ Step Functions)",
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


# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    bind_correlation_id(request_id)
    start = time.time()
    log.info("request.started", method=request.method, path=request.url.path)
    response = await call_next(request)
    log.info(
        "request.completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round((time.time() - start) * 1000, 2),
    )
    response.headers["X-Request-Id"] = request_id
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
register_exception_handlers(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "order_svc", "version": SERVICE_VERSION}


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(api_router)


# ---------------------------------------------------------------------------
# Lambda handler (wrapped again by ../handler.py)
# ---------------------------------------------------------------------------
handler = Mangum(app, lifespan="off")
