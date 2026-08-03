"""
ws-message-lambda
Trigger  : API Gateway WebSocket $default
Memory   : 512 MB  |  Timeout : 10s
Env Vars : TABLE_ORDER, STEP_ARN, DLQ_URL
"""

import os
import json
import uuid
import time
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Cold-start initialisation ──
TABLE_ORDER = os.environ["TABLE_ORDER"]
STEP_ARN    = os.environ["STEP_ARN"]
DLQ_URL     = os.environ["DLQ_URL"]
TABLE_CONN  = os.environ["TABLE_CONN"]
WS_ENDPOINT = os.environ["WS_ENDPOINT"]  # https://{apiId}.execute-api.{region}.amazonaws.com/{stage}

VALID_STATUSES = {"pending", "confirmed", "processing", "cancelled", "delivered"}

dynamodb   = boto3.resource("dynamodb")
table      = dynamodb.Table(TABLE_ORDER)
conn_table = dynamodb.Table(TABLE_CONN)
sfn        = boto3.client("stepfunctions")
sqs        = boto3.client("sqs")
apigw_mgmt = boto3.client("apigatewaymanagementapi", endpoint_url=WS_ENDPOINT)


def _broadcast(
    payload: dict,
    tenant_id: str,
    restaurant_id: str = "",
    exclude_conn: str = "",
) -> None:
    """
    Push payload to the other screens that should see it.

    Scope rules:
      • always limited to the sender's tenant
      • if the sender is bound to a branch (kitchen staff), only screens on
        that same branch receive it — Islamabad's kitchen must not see
        Lahore's orders
      • connections with no restaurantId (tenant owners watching everything)
        still receive it
    """
    data = json.dumps(payload).encode()
    try:
        resp = conn_table.scan(
            FilterExpression="tenantId = :t",
            ExpressionAttributeValues={":t": tenant_id},
            ProjectionExpression="connectionId, restaurantId",
        )
    except ClientError as e:
        logger.error("Connection scan failed: %s", e)
        return

    sent = 0
    skipped_branch = 0
    for item in resp.get("Items", []):
        conn_id = item["connectionId"]
        if conn_id == exclude_conn:
            continue

        # Branch isolation: a sender on a branch only reaches that branch
        # (plus tenant-wide listeners that have no branch of their own).
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
        "Broadcast tenant=%s restaurant=%s sent=%d skipped_other_branch=%d",
        tenant_id, restaurant_id or "-", sent, skipped_branch)


def _get_scope_for_connection(conn_id: str) -> tuple[str, str]:
    """Returns (tenantId, restaurantId) for a connection; blanks if unknown."""
    try:
        item = conn_table.get_item(Key={"connectionId": conn_id}).get("Item") or {}
        return item.get("tenantId", ""), item.get("restaurantId", "")
    except ClientError:
        return "", ""


def _send_to_dlq(connection_id: str, body: dict, reason: str) -> None:
    """Failed message ko Dead Letter Queue mein bhejo."""
    try:
        sqs.send_message(
            QueueUrl=DLQ_URL,
            MessageBody=json.dumps({
                "connectionId": connection_id,
                "originalBody": body,
                "failureReason": reason,
                "timestamp":    int(time.time()),
            }),
            MessageGroupId=connection_id,   # FIFO queue ho to ordering maintain ho
        )
        logger.info("Sent to DLQ: connectionId=%s reason=%s", connection_id, reason)
    except ClientError as e:
        # DLQ bhi fail ho gaya — yahan sirf log kar sakte hain
        logger.critical("DLQ send FAILED for %s: %s", connection_id, e)


def lambda_handler(event: dict, context) -> dict:
    request_ctx   = event.get("requestContext", {})
    connection_id = request_ctx.get("connectionId", "")

    # ── 1. Body parse karo ────────────────────────────────
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        logger.warning("Invalid JSON body from %s", connection_id)
        return {"statusCode": 400, "body": "Invalid JSON"}

    action = (body.get("action") or "").lower()

    # ── Action routing ────────────────────────────────────
    # KDS/admin clients send {action:"subscribe", channel:"orders"} on open.
    # There is nothing to persist — the connection row (with its role) already
    # exists from $connect, which is what the notifications lambda targets.
    # Just acknowledge so the client knows the socket is live.
    if action == "subscribe":
        channel = body.get("channel", "orders")
        logger.info("subscribe: connectionId=%s channel=%s", connection_id, channel)
        return {
            "statusCode": 200,
            "body": json.dumps({"type": "SUBSCRIBED", "channel": channel}),
        }

    if action == "ping":
        return {"statusCode": 200, "body": json.dumps({"type": "PONG"})}

    # KDS broadcasts a status change to every other screen on the same tenant.
    if action == "orderstatusupdate":
        tenant_id, restaurant_id = _get_scope_for_connection(connection_id)
        if not tenant_id:
            logger.warning("orderStatusUpdate from unknown connection %s", connection_id)
            return {"statusCode": 200, "body": json.dumps({"type": "IGNORED"})}
        _broadcast(
            {
                "type":    "ORDER_UPDATE",
                "orderId": body.get("orderId"),
                "status":  body.get("status"),
                "flags":   body.get("flags"),
            },
            tenant_id,
            restaurant_id=restaurant_id,
            exclude_conn=connection_id,
        )
        return {"statusCode": 200, "body": json.dumps({"type": "BROADCAST_OK"})}

    # ── Legacy status-update path (Step Functions task token) ─────────────────
    status     = body.get("status", "").lower()
    task_token = body.get("taskToken", "")
    order_id   = body.get("orderId") or str(uuid.uuid4())

    if status not in VALID_STATUSES:
        logger.warning("Unhandled message from %s: action=%r status=%r",
                       connection_id, action, status)
        # 200 so API Gateway does not close the socket over an unknown message.
        return {
            "statusCode": 200,
            "body": json.dumps({"type": "IGNORED", "reason": "unknown action/status"}),
        }

    # ── 3. DynamoDB mein order save karo ─────────────────
    table.put_item(Item={
        "connectionId": connection_id,
        "orderId":      order_id,
        "status":       status,
        "payload":      body,
        "updatedAt":    int(time.time()),
    })
    logger.info("Order saved: connectionId=%s orderId=%s status=%s",
                connection_id, order_id, status)

    # ── 4. Step Functions SendTaskSuccess ─────────────────
    if task_token:
        try:
            sfn.send_task_success(
                taskToken=task_token,
                output=json.dumps({
                    "connectionId": connection_id,
                    "orderId":      order_id,
                    "status":       status,
                }),
            )
            logger.info("SFN SendTaskSuccess: orderId=%s", order_id)
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            logger.error("SFN SendTaskSuccess FAILED (orderId=%s): %s %s",
                         order_id, error_code, e)
            # SFN fail → DLQ
            _send_to_dlq(connection_id, body, reason=f"SFN error: {error_code}")
            # 200 return karo — client ka kaam ho gaya, orchestration side ka issue hai
    else:
        logger.info("No taskToken in body — skipping SFN call (orderId=%s)", order_id)

    return {"statusCode": 200, "body": json.dumps({"orderId": order_id, "status": status})}