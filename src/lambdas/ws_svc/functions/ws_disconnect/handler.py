"""
ws-disconnect-lambda
Trigger  : API Gateway WebSocket $disconnect
Memory   : 256 MB  |  Timeout : 5s
Env Vars : REDIS_URL, TABLE_CONN
"""

import os
import logging
import redis
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Cold-start initialisation ──
REDIS_URL    = os.environ["REDIS_URL"]
TABLE_CONN   = os.environ["TABLE_CONN"]

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2)
dynamodb     = boto3.resource("dynamodb")
table        = dynamodb.Table(TABLE_CONN)


def lambda_handler(event: dict, context) -> dict:
    request_ctx   = event.get("requestContext", {})
    connection_id = request_ctx.get("connectionId", "")

    # ── Redis DEL — non-critical ────────────────────────────
    try:
        deleted = redis_client.hdel("connections", connection_id)
        if deleted:
            logger.info("Redis: removed connectionId=%s", connection_id)
        else:
            logger.info("Redis: connectionId=%s was not in hash (already gone)", connection_id)
    except redis.RedisError as e:
        logger.error("Redis DEL failed for %s (non-critical): %s", connection_id, e)

    # ── DynamoDB Clean-up — critical ────────────────────────
    try:
        table.delete_item(
            Key={"connectionId": connection_id}
        )
        logger.info("DynamoDB: removed stale connectionId=%s", connection_id)
    except Exception as e:
        logger.error("DynamoDB delete failed for %s: %s", connection_id, e)

    logger.info("Disconnected: connectionId=%s", connection_id)
    return {"statusCode": 200, "body": "Disconnected"}