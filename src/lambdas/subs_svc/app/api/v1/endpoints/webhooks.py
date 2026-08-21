"""
app.api.v1.endpoints.webhooks
==============================
Payment SVC webhook endpoints.

Who may do what
---------------
POST   /webhooks/payment/confirm    Payment SVC (confirm payment)
POST   /webhooks/payment/cancel     Payment SVC (cancel payment)
POST   /webhooks/payment/refund     Payment SVC (refund payment)
POST   /webhooks/payment/failed     Payment SVC (failed payment)

Webhook Flow
-------------
1. Payment SVC processes payment
2. Payment SVC calls /payment/confirm → activates subscription
3. Payment SVC calls /payment/cancel → marks subscription as CANCELLED
4. Payment SVC calls /payment/refund → handles refunds

Security
--------
• Webhook endpoint is unauthenticated (Payment SVC calls it)
• Payment SVC should include a signature header for verification
• IP whitelisting recommended for production

Payload Format
--------------
{
    "tenant_id": "TENANT#123",
    "plan_id": "weekly",
    "payment_id": "pay_123456",
    "payment_status": "succeeded",  # or "failed", "refunded"
    "amount": 9.99,
    "currency": "USD"
}

Notes
-----
• This is the integration point for the Payment SVC developer
• All webhooks update subscription status accordingly
• Idempotency is handled via payment_id (deduplication)
"""

import logging
import json
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Header
from datetime import datetime
from app.services.subscription_service import SubscriptionService
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.tenant_repository import TenantRepository

logger = logging.getLogger(__name__)

# Router without prefix - prefix applied in v1/__init__.py
router = APIRouter()
subscription_service = SubscriptionService()
subscription_repo = SubscriptionRepository()
tenant_repo = TenantRepository()


@router.post("/payment/confirm")
async def confirm_payment_webhook(
    request: Request,
    x_webhook_signature: Optional[str] = Header(None)
):
    """
    Payment confirmation webhook - called by Payment SVC when payment succeeds.
    
    This activates the tenant's subscription and sets it to ACTIVE.
    """
    try:
        raw_body = await request.body()
        body = json.loads(raw_body)
        
        logger.info(f"Payment confirmation webhook received: {body.get('payment_id')}")
        
        # Validate required fields
        tenant_id = body.get("tenant_id")
        plan_id = body.get("plan_id")
        payment_id = body.get("payment_id")
        payment_status = body.get("payment_status", "succeeded")
        
        if not tenant_id or not plan_id or not payment_id:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: tenant_id, plan_id, payment_id"
            )
        
        # Verify payment succeeded
        if payment_status.lower() != "succeeded":
            logger.warning(f"Payment not successful: {payment_status} for {payment_id}")
            subscription_repo.update_subscription_status(tenant_id, "CANCELLED", "FAILED")
            return {
                "status": "failed",
                "message": f"Payment status: {payment_status}",
                "payment_id": payment_id
            }
        
        # Activate the subscription
        result = subscription_service.activate_subscription(
            tenant_id=tenant_id,
            plan_id=plan_id,
            payment_id=payment_id
        )
        
        logger.info(f"Subscription activated for tenant {tenant_id} via payment {payment_id}")
        
        return {
            "status": "success",
            "message": "Subscription activated successfully",
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing payment confirmation webhook: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")


@router.post("/payment/cancel")
async def cancel_payment_webhook(
    request: Request,
    x_webhook_signature: Optional[str] = Header(None)
):
    """
    Payment cancellation webhook - called by Payment SVC when payment is cancelled.
    
    This marks the subscription as CANCELLED and revokes access.
    """
    try:
        raw_body = await request.body()
        body = json.loads(raw_body)
        
        logger.info(f"Payment cancellation webhook received: {body.get('payment_id')}")
        
        tenant_id = body.get("tenant_id")
        payment_id = body.get("payment_id")
        
        if not tenant_id or not payment_id:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: tenant_id, payment_id"
            )
        
        tenant = tenant_repo.get_tenant(tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        subscription_repo.update_subscription_status(tenant_id, "CANCELLED", "FAILED")
        tenant_repo.update_subscription_status(tenant_id, "CANCELLED", False)
        
        logger.info(f"Subscription cancelled for tenant {tenant_id} via payment {payment_id}")
        
        return {
            "status": "success",
            "message": "Subscription cancelled successfully",
            "tenant_id": tenant_id,
            "payment_id": payment_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing cancellation webhook: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")


@router.post("/payment/refund")
async def refund_payment_webhook(
    request: Request,
    x_webhook_signature: Optional[str] = Header(None)
):
    """
    Payment refund webhook - called by Payment SVC when payment is refunded.
    
    This marks the subscription as CANCELLED and revokes access.
    """
    try:
        raw_body = await request.body()
        body = json.loads(raw_body)
        
        logger.info(f"Payment refund webhook received: {body.get('payment_id')}")
        
        tenant_id = body.get("tenant_id")
        payment_id = body.get("payment_id")
        refund_amount = body.get("refund_amount")
        
        if not tenant_id or not payment_id:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: tenant_id, payment_id"
            )
        
        tenant = tenant_repo.get_tenant(tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        subscription_repo.update_subscription_status(tenant_id, "CANCELLED", "REFUNDED")
        tenant_repo.update_subscription_status(tenant_id, "CANCELLED", False)
        
        logger.info(f"Subscription refunded for tenant {tenant_id} via payment {payment_id}")
        
        return {
            "status": "success",
            "message": "Subscription refunded successfully",
            "tenant_id": tenant_id,
            "payment_id": payment_id,
            "refund_amount": refund_amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing refund webhook: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")


@router.post("/payment/failed")
async def failed_payment_webhook(
    request: Request,
    x_webhook_signature: Optional[str] = Header(None)
):
    """
    Payment failed webhook - called by Payment SVC when payment fails.
    
    This marks the subscription as FAILED and keeps access revoked.
    """
    try:
        raw_body = await request.body()
        body = json.loads(raw_body)
        
        logger.info(f"Payment failed webhook received: {body.get('payment_id')}")
        
        tenant_id = body.get("tenant_id")
        payment_id = body.get("payment_id")
        error_message = body.get("error_message", "Payment failed")
        
        if not tenant_id or not payment_id:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: tenant_id, payment_id"
            )
        
        subscription_repo.update_subscription_status(tenant_id, "FAILED", "FAILED")
        
        logger.warning(f"Payment failed for tenant {tenant_id}: {error_message}")
        
        return {
            "status": "failed",
            "message": "Payment failed recorded",
            "tenant_id": tenant_id,
            "payment_id": payment_id,
            "error": error_message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing failed payment webhook: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")