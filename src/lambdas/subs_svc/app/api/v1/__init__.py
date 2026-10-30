"""
app.api.v1
==========
Aggregates all v1 endpoint routers into a single ``api_router``.

Routers included:
- plans: Plan management (admin + public)
- subscriptions: Tenant subscription management
- webhooks: Payment SVC webhook endpoints

Note: Each router declares its own path prefixes internally.
The main app mounts this aggregate router at /api/v1.
"""

from fastapi import APIRouter
from .endpoints import plans, subscriptions, webhooks

api_router = APIRouter()

# Include all routers with their prefixes
api_router.include_router(plans.router, prefix="/plans", tags=["plans"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])

__all__ = ["api_router"]