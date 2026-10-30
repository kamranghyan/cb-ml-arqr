"""
handler.py
===========
AWS Lambda handler for Subscription Service.
"""

from shared.structured_logger import get_logger
from app.main import app, handler as mangum_handler

# Expiration job execution handler
from app.jobs.expiration import expire_subscriptions

log = get_logger("subscription.handler")


def handler(event, context):
    """
    Main Lambda entry point.
    Routes EventBridge scheduled events to background cron logic
    and HTTP requests to FastAPI/Mangum.
    """
    is_scheduled_event = (
        event.get("detail-type") == "Scheduled Event" or
        event.get("source") == "aws.events"
    )

    if is_scheduled_event:
        log.info("eventbridge.cron_triggered", job="expire_subscriptions")
        return expire_subscriptions(event, context)

    return mangum_handler(event, context)


__all__ = ["handler"]