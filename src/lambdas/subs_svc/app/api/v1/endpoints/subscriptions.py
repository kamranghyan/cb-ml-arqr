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


# Router
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
    print("")
    print("==============================================")
    print("          SUBSCRIBE DEBUG")
    print("==============================================")

    # Show what Pydantic actually received
    print("Subscription object:", subscription)

    try:
        print(
            "Subscription body:",
            subscription.model_dump()
        )
    except Exception:
        print(
            "Subscription dict:",
            subscription.__dict__
        )

    print("Authenticated tenant:", tenant)
    print(
        "Authenticated tenant_id:",
        tenant.get("tenant_id")
    )
    print(
        "Authenticated role:",
        tenant.get("role")
    )

    print("==============================================")

    tenant_id = tenant.get("tenant_id")

    if not tenant_id:
        raise HTTPException(
            status_code=401,
            detail="Tenant ID not found in authenticated user.",
        )

    # Make sure plan ID exists
    if not getattr(subscription, "plan_id", None):
        print("❌ PLAN ID IS MISSING")

        raise HTTPException(
            status_code=400,
            detail="planId is required",
        )

    print(
        "✅ Plan ID received:",
        subscription.plan_id
    )

    try:
        result = subscription_service.create_subscription(
            tenant_id,
            subscription.plan_id,
        )

        print("✅ SUBSCRIPTION CREATED:")
        print(result)
        print("==============================================")

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
        print("❌❌❌ SUBSCRIBE ERROR ❌❌❌")
        print("Exception type:", type(e).__name__)
        print("Exception:", str(e))
        print("==============================================")

        traceback.print_exc()

        print("==============================================")

        raise HTTPException(
            status_code=500,
            detail=f"{type(e).__name__}: {str(e)}",
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

    print(
        "Requested tenant_id:",
        tenant_id
    )

    print(
        "Authenticated tenant:",
        tenant
    )

    print(
        "Authenticated ID:",
        tenant.get("tenant_id")
    )

    print(
        "Authenticated role:",
        tenant.get("role")
    )

    print("==============================================")

    # Authorization
    if (
        tenant["role"] not in {
            "admin",
            "platform_admin",
            "menulay_admin",
        }
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
        print(
            "❌ RESOURCE NOT FOUND:",
            repr(e)
        )

        raise HTTPException(
            status_code=404,
            detail=str(e),
        )

    except Exception as e:
        import traceback

        print("")
        print("❌❌❌ ACTUAL SUBSCRIPTION ERROR ❌❌❌")
        print(
            "Exception type:",
            type(e).__name__
        )
        print(
            "Exception:",
            str(e)
        )
        print("==============================================")

        traceback.print_exc()

        print("==============================================")

        raise HTTPException(
            status_code=500,
            detail=f"{type(e).__name__}: {str(e)}",
        )