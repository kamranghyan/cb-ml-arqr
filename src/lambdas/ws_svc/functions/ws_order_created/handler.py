"""
ws-order-created-lambda
Trigger  : DynamoDB Streams on the Orders table (INSERT events only)
Memory   : 512 MB  |  Timeout : 10s
Env Vars : TABLE_CONN, WS_ENDPOINT

Purpose:
  Guest-app creates a new order -> order-service writes it to the Orders
  table -> this Lambda fires off that INSERT -> pushes ORDER_CREATED to
  every KDS screen on the same tenant/branch over the existing WebSocket
  connections.

  This is the missing piece: ws-message-lambda only broadcasts when a
  connected client (KDS) sends an "orderStatusUpdate" message. Nothing
  broadcasts when an order is first created by a guest, because order
  creation never touches the WS service at all. Streams close that gap
  without the order-service needing to know WS exists, and without KDS
  needing to poll.
"""

import os
import json
import logging
import boto3
from boto3.dynamodb.types import TypeDeserializer
from botocore.exceptions import ClientError
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_CONN = os.environ["TABLE_CONN"]
WS_ENDPOINT = os.environ["WS_ENDPOINT"]  # https://{apiId}.execute-api.{region}.amazonaws.com/{stage}

dynamodb = boto3.resource("dynamodb")
conn_table = dynamodb.Table(TABLE_CONN)
apigw_mgmt = boto3.client("apigatewaymanagementapi", endpoint_url=WS_ENDPOINT)

_deserializer = TypeDeserializer()

class _DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj == obj.to_integral_value() else float(obj)
        return super().default(obj)


def _deserialize(dynamo_image: dict) -> dict:
    """Convert a DynamoDB Streams NEW_IMAGE (low-level attribute map) into a plain dict."""
    return {k: _deserializer.deserialize(v) for k, v in dynamo_image.items()}


def _broadcast(payload: dict, tenant_id: str, restaurant_id: str = "") -> None:
    """
    Same scoping rules as ws-message-lambda's _broadcast:
      - limited to the order's tenant
      - if the order belongs to a specific branch, only screens on that
        branch (plus tenant-wide listeners with no branch) receive it
    """
    data = json.dumps(payload, cls=_DecimalEncoder).encode()

    try:
        resp = conn_table.query(
            IndexName="tenantId-index",
            KeyConditionExpression="tenantId = :t",
            ExpressionAttributeValues={":t": tenant_id},
            ProjectionExpression="connectionId, restaurantId",
        )
    except ClientError as e:
        logger.error("Connection query failed: %s", e)
        return

    sent = 0
    skipped_branch = 0
    for item in resp.get("Items", []):
        conn_id = item["connectionId"]

        if restaurant_id:
            target_branch = item.get("restaurantId", "")
            if target_branch and target_branch != restaurant_id:
                skipped_branch += 1
                continue

        try:
            apigw_mgmt.post_to_connection(ConnectionId=conn_id, Data=data)
            sent += 1
        except apigw_mgmt.exceptions.GoneException:
            try:
                conn_table.delete_item(Key={"connectionId": conn_id})
            except ClientError:
                pass
        except ClientError as e:
            logger.warning("post_to_connection failed conn=%s: %s", conn_id, e)

    logger.info(
        "ORDER_CREATED broadcast tenant=%s restaurant=%s sent=%d skipped_other_branch=%d",
        tenant_id, restaurant_id or "-", sent, skipped_branch,
    )


def lambda_handler(event: dict, context) -> dict:
    for record in event.get("Records", []):
        # Only new orders — ignore MODIFY (status updates already broadcast
        # via ws-message-lambda) and REMOVE.
        if record.get("eventName") != "INSERT":
            continue

        new_image = record.get("dynamodb", {}).get("NewImage")
        if not new_image:
            continue

        try:
            order = _deserialize(new_image)
        except Exception as e:
            logger.error("Failed to deserialize stream record: %s", e)
            continue

        tenant_id = order.get("tenantId", "")
        restaurant_id = order.get("restaurantId", "")

        if not tenant_id:
            logger.warning("New order %s has no tenantId, skipping broadcast",
                            order.get("orderId"))
            continue

        payload = {
            "type": "ORDER_CREATED",
            "orderId": order.get("orderId"),
            "tenantId": tenant_id,
            "restaurantId": restaurant_id,
            "tableId": order.get("tableId"),
            "status": order.get("status", "pending"),
            "lineItems": order.get("lineItems", []),
            "placedAt": order.get("placedAt"),
            "totalAmountMinorUnits": order.get("totalAmountMinorUnits"),
            "currencyCode": order.get("currencyCode"),
        }

        _broadcast(payload, tenant_id, restaurant_id)

    return {"statusCode": 200}
