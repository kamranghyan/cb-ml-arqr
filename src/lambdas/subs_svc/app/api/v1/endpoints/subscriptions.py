"""
app.api.v1.endpoints.subscriptions
===================================
Tenant subscription management endpoints

Who may do what
---------------
POST   /subscriptions/subscribe     tenant owner (subscribe to a plan)
GET    /subscriptions/status/{tenant_id} tenant owner | platform admin

Authorization
-------------
• Tenant can only view their OWN subscription status
• Admin can view ANY tenant's subscription status

Notes
-----
• Subscription status: PENDING → ACTIVE → EXPIRED → CANCELLED
• Access guard checks subscriptionIsActive before allowing restaurant operations
• Daily CloudWatch job expires subscriptions when endDate passes
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.security import get_current_tenant
from app.schemas.subscription import SubscriptionCreate, SubscriptionResponse
from app.services.subscription_service import SubscriptionService
from app.services.access_guard import SubscriptionAccessGuard

# Router without prefix - prefix applied in v1/__init__.py
router = APIRouter()
subscription_service = SubscriptionService()
access_guard = SubscriptionAccessGuard()


@router.post("/subscribe", response_model=SubscriptionResponse)
async def subscribe_to_plan(
    subscription: SubscriptionCreate,
    request: Request,
    tenant=Depends(get_current_tenant)
):
    """Subscribe to a plan"""
    tenant_id = tenant["tenant_id"]
    return subscription_service.create_subscription(tenant_id, subscription.plan_id)


@router.get("/status/{tenant_id}", response_model=SubscriptionResponse)
async def get_subscription_status(
    tenant_id: str,
    request: Request,
    tenant=Depends(get_current_tenant)
):
    """Get subscription status for a tenant"""
    # Ensure tenant can only view their own subscription (or admin)
    if tenant["role"] != "admin" and tenant["tenant_id"] != tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this subscription")
    
    return subscription_service.get_subscription_status(tenant_id)