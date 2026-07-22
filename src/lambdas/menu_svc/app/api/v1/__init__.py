"""
app.api.v1
==========
Aggregates all v1 endpoint routers into a single ``api_router`` that
``app.main`` mounts under the ``/menus`` prefix.
"""
from fastapi import APIRouter

from .endpoints import categories, items, restaurants, tables, uploads

api_router = APIRouter()
api_router.include_router(restaurants.router, tags=["Restaurants"])
api_router.include_router(categories.router,  tags=["Categories"])
api_router.include_router(items.router,       tags=["Items"])
api_router.include_router(tables.router,      tags=["Tables"])
api_router.include_router(uploads.router,     tags=["Uploads"])
