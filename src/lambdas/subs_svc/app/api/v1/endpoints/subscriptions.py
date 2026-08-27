"""
app.api.v1.endpoints.subscriptions
===================================

Tenant subscription management endpoints.

Who may do what
---------------

POST   /subscriptions/subscribe
       Tenant owner can subscribe to a plan.

GET    /subscriptions/status/{tenant_id}
       Tenant owner can view their own subscription.
       Platform admin can view any tenant subscription.

Authorization
-------------

• Tenant can only view their OWN subscription status.
• Admin can view ANY tenant's subscription status.

Notes
-----

• Subscription status:
  PENDING → ACTIVE → EXPIRED → CANCELLED

• Access guard checks subscriptionIsActive before
  allowing restaurant operations.

• Daily CloudWatch job expires subscriptions when
  endDate passes.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.security import get_current_tenant

from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionResponse,
)

from app.services.subscription_service import (
    SubscriptionService,
)

from app.services.access_guard import (
    SubscriptionAccessGuard,
)

from shared.exceptions import ResourceNotFoundError


# Router without prefix.
# Prefix is applied in v1/__init__.py
router = APIRouter()

subscription_service = SubscriptionService()
access_guard = SubscriptionAccessGuard()


# ─────────────────────────────────────────────────────────────
# Subscribe
# ─────────────────────────────────────────────────────────────

@router.post(
    "/subscribe",
    response_model=SubscriptionResponse,
)
async def subscribe_to_plan(
    subscription: SubscriptionCreate,
    request: Request,
    tenant=Depends(get_current_tenant),
):
    """Subscribe current tenant to a plan."""

    tenant_id = tenant["tenant_id"]

    return subscription_service.create_subscription(
        tenant_id,
        subscription.plan_id,
    )


# ─────────────────────────────────────────────────────────────
# Get Subscription Status
# ─────────────────────────────────────────────────────────────

@router.get(
    "/status/{tenant_id}",
    response_model=SubscriptionResponse,
)
async def get_subscription_status(
    tenant_id: str,
    request: Request,
    tenant=Depends(get_current_tenant),
):
    print("")
    print("==============================================")
    print("       SUBSCRIPTION STATUS DEBUG")
    print("==============================================")
    print("Requested tenant_id :", tenant_id)
    print("Authenticated tenant:", tenant)
    print(
        "Authenticated ID    :",
        tenant.get("tenant_id"),
    )
    print(
        "Authenticated role  :",
        tenant.get("role"),
    )
    print("==============================================")

    # Authorization
    if (
        tenant["role"] != "admin"
        and tenant["tenant_id"] != tenant_id
    ):
        print("❌ AUTHORIZATION FAILED")

        raise HTTPException(
            status_code=403,
            detail="Not authorized to view this subscription",
        )

    try:
        print(
            "🔍 Calling subscription service for:",
            tenant_id,
        )

        result = subscription_service.get_subscription_status(
            tenant_id
        )

        print("✅ RESULT:", result)

        return result

    except ResourceNotFoundError as e:
        print("❌ RESOURCE NOT FOUND:", repr(e))

        raise HTTPException(
            status_code=404,
            detail=str(e),
        )

    except Exception as e:
        import traceback

        print("")
        print("❌❌❌ ACTUAL SUBSCRIPTION ERROR ❌❌❌")
        print("Exception type:", type(e).__name__)
        print("Exception:", str(e))
        print("==============================================")
        traceback.print_exc()
        print("==============================================")

        # TEMPORARY DEBUG RESPONSE
        raise HTTPException(
            status_code=500,
            detail=f"{type(e).__name__}: {str(e)}",
        )


