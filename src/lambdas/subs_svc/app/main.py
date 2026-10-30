"""
main.py
========
FastAPI application entry point for Subscription Service.

Purpose
-------
• Initialize FastAPI app with CORS, middleware, and routes
• Mount all endpoint routers via api_router
• Configure exception handlers

Routes
------
• /api/v1/plans - Plan management (admin + public)
• /api/v1/subscriptions - Subscription management (tenant)
• /api/v1/webhooks - Payment SVC webhook endpoints

Health Check
------------
• GET /health - Returns service status

Environment
-----------
• Runs on AWS Lambda via Mangum adapter
• Environment variables loaded from SAM template
"""

import logging
import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from app.api.v1 import api_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI with redirect_slashes disabled as a safeguard
app = FastAPI(
    title="MenuLay Subscription Service",
    description="Subscription management for MenuLay SaaS platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware to expose full execution details in CloudWatch
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.time()
    logger.info(f"request.started | method={request.method} | path={request.url.path} | id={request_id}")
    
    response = await call_next(request)
    
    duration = round((time.time() - start) * 1000, 2)
    logger.info(
        f"request.completed | method={request.method} | path={request.url.path} | "
        f"status={response.status_code} | duration_ms={duration} | id={request_id}"
    )
    response.headers["X-Request-Id"] = request_id
    return response


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "subscription-svc"}


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Mount v1 API router
app.include_router(api_router, prefix="/api/v1")

# Lambda handler with lifespan disabled for AWS Lambda compatibility
handler = Mangum(app, lifespan="off")