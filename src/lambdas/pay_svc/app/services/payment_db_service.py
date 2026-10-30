import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError


logger = logging.getLogger(__name__)


class PaymentDbService:
    """
    DynamoDB service for Payment SVC.

    PaymentTable-${Environment}

    Primary key:
        orderId
    """

    def __init__(
        self,
        table_name: str | None = None,
        client=None,
    ):
        self.table_name = (
            table_name
            or os.environ.get("PAYMENTS_TABLE_NAME")
            or "PaymentTable-dev"
        )

        dynamodb = client or boto3.resource("dynamodb")

        self.table = dynamodb.Table(
            self.table_name
        )

        logger.info(
            "PaymentDbService initialized",
            extra={
                "table_name": self.table_name,
            },
        )

    def create_payment_record(
        self,
        order_id: str,
        tenant_id: str,
        plan_id: str,
        amount: float,
        email: str,
        mobile_no: str,
        payment_method: str,
        status: str = "PENDING",
    ) -> dict[str, Any]:

        if not order_id:
            raise ValueError("order_id is required")

        if not tenant_id:
            raise ValueError("tenant_id is required")

        if not plan_id:
            raise ValueError("plan_id is required")

        now = datetime.now(
            timezone.utc
        ).isoformat()

        item = {
            "orderId": order_id,
            "tenantId": tenant_id,
            "planId": plan_id,

            # Keep money consistent in DynamoDB.
            "amount": str(amount),

            "email": email,
            "mobileNo": mobile_no,
            "paymentMethod": payment_method,
            "status": status,

            "createdAt": now,
            "updatedAt": now,
        }

        try:
            self.table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(orderId)",
            )

            logger.info(
                "Created payment record",
                extra={
                    "order_id": order_id,
                    "tenant_id": tenant_id,
                    "plan_id": plan_id,
                    "status": status,
                },
            )

            return item

        except ClientError as exc:

            error_code = exc.response.get(
                "Error",
                {},
            ).get(
                "Code"
            )

            if error_code == "ConditionalCheckFailedException":
                logger.warning(
                    "Payment record already exists",
                    extra={
                        "order_id": order_id,
                    },
                )

            logger.exception(
                "Failed to create payment record",
                extra={
                    "order_id": order_id,
                },
            )

            raise

        except BotoCoreError:
            logger.exception(
                "DynamoDB error while creating payment",
                extra={
                    "order_id": order_id,
                },
            )
            raise

    def get_payment_by_order_id(
        self,
        order_id: str,
    ) -> dict[str, Any] | None:

        if not order_id:
            raise ValueError("order_id is required")

        try:
            response = self.table.get_item(
                Key={
                    "orderId": order_id,
                }
            )

            return response.get("Item")

        except (BotoCoreError, ClientError):
            logger.exception(
                "Failed to fetch payment record",
                extra={
                    "order_id": order_id,
                },
            )
            raise

    def update_payment_status(
        self,
        order_id: str,
        status: str,
        transaction_id: str | None = None,
        raw_response: dict | None = None,
    ) -> dict[str, Any]:

        if not order_id:
            raise ValueError("order_id is required")

        if not status:
            raise ValueError("status is required")

        now = datetime.now(
            timezone.utc
        ).isoformat()

        update_expr = """
            SET #st = :status,
                updatedAt = :updatedAt
        """

        expression_names = {
            "#st": "status",
        }

        expression_values = {
            ":status": status,
            ":updatedAt": now,
        }

        if transaction_id:
            update_expr += """
                , transactionId = :transactionId
            """

            expression_values[
                ":transactionId"
            ] = transaction_id

        if raw_response is not None:
            update_expr += """
                , rawResponse = :rawResponse
            """

            expression_values[
                ":rawResponse"
            ] = raw_response

        try:
            response = self.table.update_item(
                Key={
                    "orderId": order_id,
                },

                UpdateExpression=update_expr,

                ExpressionAttributeNames=expression_names,

                ExpressionAttributeValues=expression_values,

                ReturnValues="ALL_NEW",
            )

            attributes = response.get(
                "Attributes",
                {},
            )

            logger.info(
                "Payment status updated",
                extra={
                    "order_id": order_id,
                    "status": status,
                    "transaction_id": transaction_id,
                },
            )

            return attributes

        except (BotoCoreError, ClientError):
            logger.exception(
                "Failed to update payment status",
                extra={
                    "order_id": order_id,
                    "status": status,
                },
            )
            raise