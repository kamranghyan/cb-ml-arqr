# app/services/eventbridge_service.py

import json
import boto3
from app.core.config import settings

class EventBridgeService:
    def __init__(self):
        self.client = boto3.client('events')
        self.bus_name = settings.EVENT_BUS_NAME  # e.g., "arqr-event-bus-dev"

    def publish_payment_succeeded(self, tenant_id: str, plan_id: str, order_id: str, amount: float):
        event_detail = {
            "tenant_id": tenant_id,
            "plan_id": plan_id,
            "order_id": order_id,
            "amount": amount,
            "status": "SUCCESS"
        }

        response = self.client.put_events(
            Entries=[
                {
                    'Source': 'app.payment_svc',
                    'DetailType': 'payment.succeeded',
                    'Detail': json.dumps(event_detail),
                    'EventBusName': self.bus_name
                }
            ]
        )
        return response