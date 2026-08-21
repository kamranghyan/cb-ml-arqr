# src/lambdas/subs_svc/app/events/payment_handler.py

import logging
from app.repositories.tenant_repository import TenantRepository

logger = logging.getLogger()
logger.setLevel(logging.INFO)

tenant_repo = TenantRepository()

def handle_payment_succeeded(event, context):
    """
    Triggered by EventBridge when payment_svc publishes 'payment.succeeded'.
    Updates the tenant's subscription in TenantTable-dev to ACTIVE.
    """
    logger.info(f"Received EventBridge Payment Event: {event}")
    
    detail = event.get("detail", {})
    tenant_id = detail.get("tenant_id")
    plan_id = detail.get("plan_id")
    
    if not tenant_id or not plan_id:
        logger.error(f"Missing tenant_id or plan_id in event payload: {detail}")
        return {"status": "FAILED", "reason": "Missing required fields"}

    # Activate tenant subscription in DynamoDB
    tenant_repo.update_tenant_subscription(tenant_id, {
        "status": "ACTIVE",
        "plan_id": plan_id,
        "is_active": True
    })
    
    logger.info(f"Successfully activated subscription for tenant: {tenant_id}")
    return {"status": "SUCCESS", "tenant_id": tenant_id}