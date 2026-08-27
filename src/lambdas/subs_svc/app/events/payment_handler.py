import logging

from app.services.subscription_service import SubscriptionService


logger = logging.getLogger()
logger.setLevel(logging.INFO)

subscription_service = SubscriptionService()


def handle_payment_succeeded(event, context):
    """
    EventBridge consumer for payment.succeeded.

    Payment SVC
        ↓
    EventBridge
        ↓
    this Lambda
        ↓
    SubscriptionService.activate_subscription()
        ↓
    TenantSubscriptionTable = ACTIVE
        ↓
    TenantTable = ACTIVE
    """

    logger.info(
        "Received EventBridge payment.succeeded event",
        extra={
            "event": event,
        },
    )

    detail = event.get("detail", {})

    tenant_id = detail.get("tenant_id")
    plan_id = detail.get("plan_id")
    payment_id = (
        detail.get("payment_id")
        or detail.get("transaction_id")
    )

    # ---------------------------------------------------------
    # Validate event
    # ---------------------------------------------------------

    if not tenant_id:
        logger.error(
            "payment.succeeded event missing tenant_id",
            extra={"detail": detail},
        )

        return {
            "status": "FAILED",
            "reason": "Missing tenant_id",
        }

    if not plan_id:
        logger.error(
            "payment.succeeded event missing plan_id",
            extra={"detail": detail},
        )

        return {
            "status": "FAILED",
            "reason": "Missing plan_id",
        }

    if not payment_id:
        logger.error(
            "payment.succeeded event missing payment_id",
            extra={"detail": detail},
        )

        return {
            "status": "FAILED",
            "reason": "Missing payment_id",
        }

    # ---------------------------------------------------------
    # Activate subscription
    # ---------------------------------------------------------

    try:
        result = subscription_service.activate_subscription(
            tenant_id=tenant_id,
            plan_id=plan_id,
            payment_id=payment_id,
        )

        logger.info(
            "Subscription activated successfully",
            extra={
                "tenant_id": tenant_id,
                "plan_id": plan_id,
                "payment_id": payment_id,
                "result": result,
            },
        )

        return {
            "status": "SUCCESS",
            "tenant_id": tenant_id,
            "plan_id": plan_id,
            "payment_id": payment_id,
            "subscription": result,
        }

    except Exception as exc:
        logger.exception(
            "Failed to activate subscription from payment.succeeded",
            extra={
                "tenant_id": tenant_id,
                "plan_id": plan_id,
                "payment_id": payment_id,
                "error": str(exc),
            },
        )

        raise