"""
app.api.v1
==========
Aggregates all v1 endpoint routers into a single ``api_router``.

Note: the orders router itself declares routes as "" / "/{orderId}", so it
must be included *with* a non-empty prefix. ``app.main`` mounts this
aggregate router at the root, and the ``/orders`` prefix is applied here.
"""
from fastapi import APIRouter

from .endpoints import orders

api_router = APIRouter()
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
