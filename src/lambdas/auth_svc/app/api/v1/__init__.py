"""API v1 router — mounts every endpoint module under /auth."""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, tenants

api_router = APIRouter()
api_router.include_router(auth.router,    prefix="/auth", tags=["auth"])
api_router.include_router(tenants.router, prefix="/auth", tags=["tenants"])
