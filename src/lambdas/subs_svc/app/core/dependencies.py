"""
app.core.dependencies
======================
FastAPI dependency injection utilities.

Purpose
-------
• Provide common dependencies for endpoints
• Handle tenant-scoped authorization
• Validate subscription access before protected operations

Dependencies
------------
• get_current_tenant() - Returns authenticated tenant info
• get_tenant_or_403() - Validates tenant access and returns tenant object
• require_active_subscription() - Guards endpoints that require subscription

Usage
-----
@router.post("/restaurants")
async def create_restaurant(
    tenant: dict = Depends(require_active_subscription)
):
    # Only tenants with active subscription can reach here
    pass

Notes
-----
• Dependencies are injected into FastAPI route handlers
• Subscription guard checks both status AND expiration date
"""

from fastapi import Depends, HTTPException, Request
from app.core.security import get_current_tenant
from app.services.access_guard import SubscriptionAccessGuard

access_guard = SubscriptionAccessGuard()


async def require_active_subscription(request: Request, tenant=Depends(get_current_tenant)):
    """
    Dependency that ensures the current tenant has an active subscription.
    Raises HTTPException 403 if subscription is inactive or expired.
    """
    tenant_id = tenant["tenant_id"]
    access_guard.require_active_subscription(tenant_id)
    return tenant


async def get_tenant_or_403(request: Request, tenant=Depends(get_current_tenant)):
    """
    Validates that the tenant exists and returns tenant data.
    Raises 403 if tenant not found.
    """
    tenant_id = tenant["tenant_id"]
    from app.repositories.tenant_repository import TenantRepository
    repo = TenantRepository()
    tenant_data = repo.get_tenant(tenant_id)
    if not tenant_data:
        raise HTTPException(status_code=403, detail="Tenant not found")
    return tenant_data