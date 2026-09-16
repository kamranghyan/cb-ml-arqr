import json
import logging
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


logger = logging.getLogger(__name__)


class EventBridgeService:
    """
    Publishes payment lifecycle events to the shared EventBridge bus.

    Payment SVC is a producer.

    Invoice SVC / other services are consumers.
    """

    SOURCE = "app.payment_svc"
    PAYMENT_SUCCEEDED_DETAIL_TYPE = "payment.succeeded"

    def __init__(self, client=None):
        self.client = client or boto3.client("events")
        self.bus_name = settings.EVENT_BUS_NAME

        logger.info(
            "EventBridgeService initialized",
            extra={
                "event_bus_name": self.bus_name,
            },
        )

    def publish_payment_succeeded(
        self,
        tenantId: str,
        planId: str,
        orderId: str,
        amount: float,
        transactionId: str | None = None,
        currency: str = "PKR",
        paymentMethod: str | None = None,
    ) -> dict[str, Any]:
        """
        Publish payment.succeeded after a payment has successfully
        been confirmed and persisted as SUCCESS.

        Event consumers such as Invoice SVC can listen for:

            source = app.payment_svc
            detail-type = payment.succeeded
        """

        if not tenantId:
            raise ValueError("tenantId is required")

        if not planId:
            raise ValueError("planId is required")

        if not orderId:
            raise ValueError("orderId is required")

        payment_id = transactionId or orderId

        event_detail = {
            "tenant_id": tenantId,
            "plan_id": planId,

            "payment_id": payment_id,
            "payment_status": "succeeded",

            "amount": amount,
            "currency": currency,
            "payment_method": paymentMethod,

            # Traceability
            "order_id": orderId,
            "transaction_id": transactionId,
        }

        entry = {
            "Source": self.SOURCE,
            "DetailType": self.PAYMENT_SUCCEEDED_DETAIL_TYPE,
            "Detail": json.dumps(event_detail),
            "EventBusName": self.bus_name,
        }

        try:
            response = self.client.put_events(
                Entries=[entry]
            )

            failed_count = response.get(
                "FailedEntryCount",
                0,
            )

            if failed_count:
                logger.error(
                    "EventBridge failed to publish payment.succeeded",
                    extra={
                        "order_id": orderId,
                        "tenant_id": tenantId,
                        "plan_id": planId,
                        "failed_entry_count": failed_count,
                        "response": response,
                    },
                )

                raise RuntimeError(
                    "EventBridge failed to publish "
                    f"payment.succeeded for orderId={orderId}"
                )

            logger.info(
                "payment.succeeded published successfully",
                extra={
                    "order_id": orderId,
                    "tenant_id": tenantId,
                    "plan_id": planId,
                    "payment_id": payment_id,
                    "event_bus": self.bus_name,
                },
            )

            return response

        except (BotoCoreError, ClientError):
            logger.exception(
                "EventBridge exception while publishing "
                "payment.succeeded",
                extra={
                    "order_id": orderId,
                    "tenant_id": tenantId,
                },
            )
            raise