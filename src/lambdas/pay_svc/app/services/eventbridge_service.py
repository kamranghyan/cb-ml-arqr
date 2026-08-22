import json
import logging
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from app.core.config import settings

logger = logging.getLogger(__name__)


class EventBridgeService:
    def __init__(self):
        self.client = boto3.client("events")
        self.bus_name = settings.EVENT_BUS_NAME

    def publish_payment_succeeded(
        self, tenant_id: str, plan_id: str, order_id: str, amount: float
    ):
        event_detail = {
            "tenant_id": tenant_id,
            "plan_id": plan_id,
            "order_id": order_id,
            "amount": amount,
            "status": "SUCCESS",
        }

        try:
            response = self.client.put_events(
                Entries=[
                    {
                        "Source": "app.payment_svc",
                        "DetailType": "payment.succeeded",
                        "Detail": json.dumps(event_detail),
                        "EventBusName": self.bus_name,
                    }
                ]
            )

            # Check for EventBridge entry delivery failure
            if response.get("FailedEntryCount", 0) > 0:
                logger.error(
                    f"EventBridge failed to deliver event for orderId={order_id}: {response}"
                )
            else:
                logger.info(
                    f"Published payment.succeeded event for orderId={order_id}"
                )

            return response

        except (BotoCoreError, ClientError) as e:
            logger.exception(
                f"Exception publishing EventBridge event for orderId={order_id}: {str(e)}"
            )
            raise