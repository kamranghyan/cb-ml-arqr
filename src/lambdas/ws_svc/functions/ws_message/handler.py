"""
ws-message-lambda
Trigger  : API Gateway WebSocket $default
Memory   : 512 MB  |  Timeout : 10s
Env Vars : TABLE_ORDER, STEP_ARN, DLQ_URL, TABLE_REAL_ORDERS
"""

import os
import json
import uuid
import time
import logging
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Cold-start initialisation ──
TABLE_ORDER      = os.environ["TABLE_ORDER"]
STEP_ARN         = os.environ["STEP_ARN"]
DLQ_URL          = os.environ["DLQ_URL"]
TABLE_CONN       = os.environ["TABLE_CONN"]
WS_ENDPOINT      = os.environ["WS_ENDPOINT"]  # https://{apiId}.execute-api.{region}.amazonaws.com/{stage}
TABLE_REAL_ORDERS = os.environ["TABLE_REAL_ORDERS"]  # the order-service's actual Orders table (PK=TENANT#..#ORDER#.., SK=STATUS#..)

VALID_STATUSES = {"new", "preparing", "ready", "delivered", "cancelled"}

dynamodb        = boto3.resource("dynamodb")
table           = dynamodb.Table(TABLE_ORDER)
real_orders     = dynamodb.Table(TABLE_REAL_ORDERS)
conn_table      = dynamodb.Table(TABLE_CONN)
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
        # Using query() on GSI is much faster and cheaper at scale than scan()
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


def _get_scope_for_connection(conn_id: str) -> tuple[str, str, str]:
    """Returns (tenantId, restaurantId, role) for a connection; blanks if unknown."""
    try:
        item = conn_table.get_item(Key={"connectionId": conn_id}).get("Item") or {}
        return item.get("tenantId", ""), item.get("restaurantId", ""), item.get("role", "")
    except ClientError:
        return "", "", ""


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
            # MessageGroupId removed because standard queues don't support it
        )
        logger.info("Sent to DLQ: connectionId=%s reason=%s", connection_id, reason)
    except ClientError as e:
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
    if action == "subscribe":
        channel = body.get("channel", "orders")
        logger.info("subscribe: connectionId=%s channel=%s", connection_id, channel)

        # Platform admins have no tenantId of their own in their JWT, so their
        # connection is stored with an empty tenantId at $connect. To receive
        # broadcasts for whichever tenant/branch they're browsing in the
        # console, they can re-scope their connection here.
        requested_tenant_id = body.get("tenantId")
        requested_restaurant_id = body.get("restaurantId", "")

        if requested_tenant_id:
            _, _, role = _get_scope_for_connection(connection_id)

            if role == "admin":
                try:
                    conn_table.update_item(
                        Key={"connectionId": connection_id},
                        UpdateExpression="SET tenantId = :t, restaurantId = :r",
                        ExpressionAttributeValues={
                            ":t": requested_tenant_id,
                            ":r": requested_restaurant_id,
                        },
                    )
                    logger.info(
                        "Admin connection %s re-scoped to tenant=%s restaurant=%s",
                        connection_id, requested_tenant_id, requested_restaurant_id or "-",
                    )
                except ClientError as e:
                    logger.error("Failed to re-scope admin connection %s: %s", connection_id, e)
            else:
                logger.warning(
                    "Non-admin connection %s attempted to subscribe to tenant=%s — ignored",
                    connection_id, requested_tenant_id,
                )

        return {
            "statusCode": 200,
            "body": json.dumps({"type": "SUBSCRIBED", "channel": channel}),
        }

    if action == "ping":
        return {"statusCode": 200, "body": json.dumps({"type": "PONG"})}

    # KDS broadcasts a status change to every other screen on the same tenant.
    if action == "orderstatusupdate":
        # ── 1. Status Validation Check (Change #4) ──
        status = (body.get("status") or "").lower()
        if status not in VALID_STATUSES:
            logger.warning("Invalid status update attempted from %s: status=%r", connection_id, status)
            return {
                "statusCode": 400,
                "body": json.dumps({"type": "INVALID_STATUS", "reason": f"Status '{status}' is not supported."})
            }

        # Ensure your helper returns the role along with scope data
        tenant_id, restaurant_id, role = _get_scope_for_connection(connection_id)
        
        # ── 2. Authentication Check ──
        if not tenant_id:
            logger.warning("orderStatusUpdate from unknown connection %s", connection_id)
            return {"statusCode": 403, "body": json.dumps({"type": "UNAUTHORIZED", "reason": "Unknown connection"})}
            
        # ── 3. Role Authorization Check ──
        ALLOWED_ROLES = {"kitchen", "kds", "admin"}
        if role not in ALLOWED_ROLES:
            logger.warning("Unauthorized role %s attempted status update on connection %s", role, connection_id)
            return {"statusCode": 403, "body": json.dumps({"type": "UNAUTHORIZED", "reason": "Insufficient role privileges"})}

        # ── 4. Multi-Tenant / Cross-Branch Data Leak Check ──
        order_id = body.get("orderId")
        # Explicitly ensure order_id is present even in the broadcast path
        if not order_id:
            return {"statusCode": 400, "body": json.dumps({"type": "MISSING_ORDER_ID", "reason": "orderId parameter is required"})}
        
        try:
            order_resp = real_orders.query(
                KeyConditionExpression=Key("PK").eq(f"TENANT#{tenant_id}#ORDER#{order_id}"),
                Limit=1,
                ScanIndexForward=False,
            )
            items = order_resp.get("Items", [])
            order_item = items[0] if items else None

            if not order_item:
                logger.warning("Order %s not found for update by connection %s", order_id, connection_id)
                return {"statusCode": 404, "body": json.dumps({"type": "NOT_FOUND", "reason": "Order does not exist"})}

            # PK already encodes tenant_id, so a match here already proves tenant
            # ownership — no separate tenantId comparison needed.

            if role != "admin" and restaurant_id and order_item.get("restaurantId") != restaurant_id:
                logger.warning("Cross-branch modification blocked for connection %s on Order %s", connection_id, order_id)
                return {"statusCode": 403, "body": json.dumps({"type": "UNAUTHORIZED", "reason": "Branch mismatch"})}

        except ClientError as e:
            logger.error("Failed to fetch order validation metadata: %s", e)
            return {"statusCode": 500, "body": "Internal server validation failure"}

        # Broadcast update safely now that identity, state constraints, and scopes are verified
        _broadcast(
            {
                "type":    "ORDER_UPDATE",
                "orderId": order_id,
                "status":  status,
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
    order_id   = body.get("orderId")

    # ── 1. Order ID Missing Validation Check (Change #5) ──
    # If the payload doesn't contain an order ID, fail fast instead of fabricating a fake record
    if not order_id:
        logger.warning("Rejected legacy update path from %s: missing orderId", connection_id)
        return {
            "statusCode": 400,
            "body": json.dumps({"type": "BAD_REQUEST", "reason": "orderId field is required."})
        }

    if status not in VALID_STATUSES:
        logger.warning("Unhandled message from %s: action=%r status=%r",
                       connection_id, action, status)
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