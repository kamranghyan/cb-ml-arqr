import os
import logging
from datetime import datetime, timezone
import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


class PaymentDbService:
    def __init__(self, table_name: str = None, client=None):
        self.table_name = table_name or os.environ.get("PAYMENT_TABLE", "PaymentTable-dev")
        dynamodb = client or boto3.resource("dynamodb")
        self.table = dynamodb.Table(self.table_name)

    def create_payment_record(
        self,
        order_id: str,
        tenant_id: str,
        plan_id: str,
        amount: float,
        email: str,
        mobile_no: str,
        status: str = "PENDING",
    ) -> dict:
        """Creates a initial payment record in DynamoDB."""
        now = datetime.now(timezone.utc).isoformat()
        item = {
            "orderId": order_id,
            "tenantId": tenant_id,
            "planId": plan_id,
            "amount": str(amount),
            "email": email,
            "mobileNo": mobile_no,
            "status": status,
            "createdAt": now,
            "updatedAt": now,
        }
        try:
            self.table.put_item(Item=item)
            logger.info(f"Created payment record for orderId={order_id}")
            return item
        except (BotoCoreError, ClientError) as e:
            logger.exception(f"Error creating payment record for orderId={order_id}: {str(e)}")
            raise

    def get_payment_by_order_id(self, order_id: str) -> dict | None:
        """Fetches a payment record from DynamoDB using orderId."""
        try:
            response = self.table.get_item(Key={"orderId": order_id})
            return response.get("Item")
        except (BotoCoreError, ClientError) as e:
            logger.exception(f"Error fetching payment for orderId={order_id}: {str(e)}")
            raise

    def update_payment_status(
        self, order_id: str, status: str, transaction_id: str | None = None, raw_response: dict | None = None
    ) -> dict:
        """Updates payment status, transaction ID, and raw callback response in DynamoDB."""
        now = datetime.now(timezone.utc).isoformat()
        update_expr = "SET #st = :status, updatedAt = :updatedAt"
        expr_names = {"#st": "status"}
        expr_values = {
            ":status": status,
            ":updatedAt": now,
        }

        if transaction_id:
            update_expr += ", transactionId = :txnId"
            expr_values[":txnId"] = transaction_id

        if raw_response:
            update_expr += ", rawResponse = :rawResp"
            expr_values[":rawResp"] = raw_response

        try:
            response = self.table.update_item(
                Key={"orderId": order_id},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
                ReturnValues="ALL_NEW",
            )
            logger.info(f"Successfully updated orderId={order_id} status to {status}")
            return response.get("Attributes", {})
        except (BotoCoreError, ClientError) as e:
            logger.exception(f"Error updating payment status for orderId={order_id}: {str(e)}")
            raise