"""
app.api.v1
==========
Aggregates all v1 endpoint routers into a single ``api_router``.

The ar_assets router declares routes as "/{restaurantId}/{itemId}", so the
``/ar`` prefix is applied here; ``app.main`` mounts this aggregate at root.
"""
from fastapi import APIRouter

from .endpoints import ar_assets

api_router = APIRouter()
api_router.include_router(ar_assets.router, prefix="/ar", tags=["AR Assets"])
