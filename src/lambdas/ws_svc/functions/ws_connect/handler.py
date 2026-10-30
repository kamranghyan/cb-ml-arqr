"""
ws-connect-lambda
Trigger  : API Gateway WebSocket $connect
Memory   : 256 MB  | Timeout : 5s

Env Vars:
  REDIS_URL
  TABLE_CONN

Authentication:
  1. Logged-in users -> Cognito JWT
  2. Guests -> guestSessionId

Guest connection example:
  wss://.../dev?guestSessionId=<guest-session-id>

Authenticated connection example:
  wss://.../dev?token=<cognito-token>
"""

import os
import time
import json
import base64
import logging
import urllib.request
from typing import Optional, Dict, Any

import boto3
import redis


logger = logging.getLogger()
logger.setLevel(logging.INFO)


# ─────────────────────────────────────────────────────────────────────────────
# Environment
# ─────────────────────────────────────────────────────────────────────────────

REDIS_URL = os.environ["REDIS_URL"]
TABLE_CONN = os.environ["TABLE_CONN"]


# ─────────────────────────────────────────────────────────────────────────────
# Cognito configuration
# ─────────────────────────────────────────────────────────────────────────────

REGION = os.environ.get("AWS_REGION", "ap-south-1")
USER_POOL_ID = os.environ["USER_POOL_ID"]
CLIENT_ID = os.environ["CLIENT_ID"]

JWKS_URL = (
    f"https://cognito-idp.{REGION}.amazonaws.com/"
    f"{USER_POOL_ID}/.well-known/jwks.json"
)

EXPECTED_ISSUER = (
    f"https://cognito-idp.{REGION}.amazonaws.com/"
    f"{USER_POOL_ID}"
)


# ─────────────────────────────────────────────────────────────────────────────
# AWS clients
# ─────────────────────────────────────────────────────────────────────────────

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_CONN)


# ─────────────────────────────────────────────────────────────────────────────
# Redis optional
# ─────────────────────────────────────────────────────────────────────────────

try:
    redis_client = redis.Redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_timeout=2,
    )

    redis_client.ping()

    REDIS_AVAILABLE = True

    logger.info("Redis connected")

except Exception as e:

    logger.warning(
        "Redis not available, skipping (non-critical): %s",
        e,
    )

    redis_client = None
    REDIS_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
# JWKS cache
# ─────────────────────────────────────────────────────────────────────────────

_jwks_cache: Optional[Dict] = None
_jwks_cache_time: float = 0

JWKS_CACHE_TTL = 3600


def _get_jwks() -> Dict:
    """
    Get Cognito public keys.

    Keys are cached for one hour to avoid downloading JWKS
    on every WebSocket connection.
    """

    global _jwks_cache
    global _jwks_cache_time

    now = time.time()

    if (
        _jwks_cache
        and (now - _jwks_cache_time) < JWKS_CACHE_TTL
    ):
        return _jwks_cache

    with urllib.request.urlopen(
        JWKS_URL,
        timeout=5,
    ) as res:

        _jwks_cache = json.loads(
            res.read()
        )

        _jwks_cache_time = now

        logger.info("JWKS refreshed")

    return _jwks_cache


# ─────────────────────────────────────────────────────────────────────────────
# JWT payload decode
# ─────────────────────────────────────────────────────────────────────────────

def _decode_payload(token: str) -> Dict:
    """
    Decode JWT payload.

    IMPORTANT:
    This function is only used to read claims.

    It does NOT verify the JWT signature.
    """

    parts = token.split(".")

    if len(parts) != 3:
        raise ValueError("Invalid JWT format")

    payload = parts[1]

    payload += "=" * (
        4 - len(payload) % 4
    )

    return json.loads(
        base64.urlsafe_b64decode(payload)
    )


# ─────────────────────────────────────────────────────────────────────────────
# Cognito token verification
# ─────────────────────────────────────────────────────────────────────────────

def _verify_cognito_token(
    token: str,
) -> Dict[str, Any]:
    """
    Verify Cognito JWT.

    NOTE:
    This keeps the same validation behaviour as your
    current working implementation.
    """

    if token.startswith("Bearer "):
        token = token[7:]

    claims = _decode_payload(token)

    # Expiry
    if claims.get("exp", 0) < time.time():
        raise ValueError("Token has expired")

    # Issuer
    if claims.get("iss") != EXPECTED_ISSUER:
        raise ValueError("Invalid token issuer")

    # Client
    token_client = (
        claims.get("client_id")
        or claims.get("aud")
    )

    if token_client != CLIENT_ID:
        raise ValueError("Invalid token client")

    # Token use
    if claims.get("token_use") not in (
        "id",
        "access",
    ):
        raise ValueError("Invalid token_use")

    return claims


# ─────────────────────────────────────────────────────────────────────────────
# Role resolver
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_role(groups) -> str:

    if "menulay_kitchen_staff" in groups:
        return "kitchen"

    if "menulay_admin" in groups:
        return "admin"

    if "menulay_tenant" in groups:
        return "tenant"

    return "guest"


# ─────────────────────────────────────────────────────────────────────────────
# Lambda handler
# ─────────────────────────────────────────────────────────────────────────────

def lambda_handler(event: dict, context) -> dict:

    request_ctx = event.get(
        "requestContext",
        {},
    )

    connection_id = request_ctx.get(
        "connectionId",
        "",
    )

    headers = event.get("headers") or {}

    query_params = (
        event.get("queryStringParameters")
        or {}
    )


    # ─────────────────────────────────────────────────────────────────────────
    # 1. Extract authentication values
    # ─────────────────────────────────────────────────────────────────────────

    auth_header = (
        headers.get("Authorization")
        or headers.get("authorization")
        or query_params.get("token")
        or ""
    )

    token = auth_header.replace(
        "Bearer ",
        "",
    ).strip()

    guest_session_id = (
        query_params.get("guestSessionId")
        or ""
    ).strip()


    logger.info(
        "WebSocket connect attempt: connectionId=%s "
        "hasToken=%s hasGuestSession=%s",
        connection_id,
        bool(token),
        bool(guest_session_id),
    )


    # ─────────────────────────────────────────────────────────────────────────
    # 2. Authenticated user connection
    # ─────────────────────────────────────────────────────────────────────────

    if token:

        try:

            claims = _verify_cognito_token(
                token
            )

        except ValueError as e:

            logger.warning(
                "Invalid JWT — rejecting $connect "
                "for %s: %s",
                connection_id,
                str(e),
            )

            return {
                "statusCode": 401,
                "body": f"Unauthorized: {str(e)}",
            }

        except Exception as e:

            logger.error(
                "JWT verification error for %s: %s",
                connection_id,
                str(e),
            )

            return {
                "statusCode": 401,
                "body": (
                    "Unauthorized: "
                    "token verification failed"
                ),
            }


        # ─────────────────────────────────────────────────────────────────────
        # Extract Cognito claims
        # ─────────────────────────────────────────────────────────────────────

        user_id = claims.get(
            "sub",
            "unknown",
        )

        email = claims.get(
            "email",
            "",
        )

        tenant_id = claims.get(
            "custom:tenant_id",
            "",
        )

        restaurant_id = claims.get(
            "custom:restaurant_id",
            "",
        )

        groups = claims.get(
            "cognito:groups",
            [],
        )

        if isinstance(groups, str):
            groups = [groups]

        role = _resolve_role(groups)


        logger.info(
            "JWT valid — connectionId=%s "
            "userId=%s email=%s groups=%s",
            connection_id,
            user_id,
            email,
            groups,
        )


        # ─────────────────────────────────────────────────────────────────────
        # Store authenticated connection
        # ─────────────────────────────────────────────────────────────────────

        ttl = int(time.time()) + 14400  

        item = {
            "connectionId": connection_id,
            "connectionType": "user",
            "userId": user_id,
            "email": email,
            "groups": groups,
            "role": role,
            "connectedAt": int(time.time()),
            "ttl": ttl,
        }

        # tenantId is a GSI key (tenantId-index) — DynamoDB rejects empty
        # strings for indexed key attributes, so omit it entirely for
        # platform admins (whose JWT has no tenant_id claim) rather than
        # writing "". Their connection is scoped later via the "subscribe"
        # action instead, once they pick a tenant/branch in the console.
        if tenant_id:
            item["tenantId"] = tenant_id

        # restaurantId is ALSO a GSI key (restaurantId-index) — same rule
        # applies here. A tenant OWNER's JWT has no restaurant_id claim at
        # all (they oversee every branch, not just one), so writing ""
        # used to throw a DynamoDB ValidationException on every owner
        # connect — silently failing the entire $connect handshake, so the
        # owner's dashboard never got a working WebSocket connection and
        # never received ORDER_CREATED/ORDER_UPDATE broadcasts. Omitting
        # the attribute for owners is correct: _broadcast()'s branch
        # filter already treats "no restaurantId on the connection" as
        # "sees every branch under this tenant" — exactly right for an
        # owner watching the whole company.
        if restaurant_id:
            item["restaurantId"] = restaurant_id

        try:
            table.put_item(Item=item)
        except Exception as e:
            logger.error(
                "Failed to persist connection record for %s "
                "(userId=%s, tenantId=%s, restaurantId=%s): %s",
                connection_id, user_id, tenant_id or "-", restaurant_id or "-", e,
            )
            return {
                "statusCode": 500,
                "body": "Failed to establish connection",
            }


        # Redis
        if REDIS_AVAILABLE and redis_client:

            try:

                redis_client.hset(
                    "connections",
                    connection_id,
                    user_id,
                )

            except Exception as e:

                logger.warning(
                    "Redis HSET failed "
                    "(non-critical): %s",
                    e,
                )


        logger.info(
            "Connected USER: "
            "connectionId=%s "
            "userId=%s "
            "tenantId=%s "
            "restaurantId=%s "
            "role=%s",
            connection_id,
            user_id,
            tenant_id,
            restaurant_id or "-",
            role,
        )

        return {
            "statusCode": 200,
            "body": "Connected",
        }


    # ─────────────────────────────────────────────────────────────────────────
    # 3. Guest connection
    # ─────────────────────────────────────────────────────────────────────────

    if guest_session_id:

        logger.info(
            "Guest WebSocket connection: "
            "connectionId=%s guestSessionId=%s",
            connection_id,
            guest_session_id,
        )


        # ─────────────────────────────────────────────────────────────────────
        # IMPORTANT
        #
        # Guest session is currently generated by:
        #
        # POST /guest/session
        #
        # which returns randomUUID().
        #
        # We associate that ID with this WebSocket connection.
        #
        # Restaurant/tenant will be resolved later from the order/session
        # flow rather than trusting a tenantId supplied by the browser.
        # ─────────────────────────────────────────────────────────────────────

        ttl = int(time.time()) + 14400  

        table.put_item(
          Item={
            "connectionId": connection_id,
            "connectionType": "guest",
            "guestSessionId": guest_session_id,
            "email": "",
            "groups": [],
            "role": "guest",
            "connectedAt": int(time.time()),
            "ttl": ttl,
          }
       )


        # Redis
        if REDIS_AVAILABLE and redis_client:

            try:

                redis_client.hset(
                    "connections",
                    connection_id,
                    f"guest:{guest_session_id}",
                )

            except Exception as e:

                logger.warning(
                    "Redis HSET for guest failed "
                    "(non-critical): %s",
                    e,
                )


        logger.info(
            "Connected GUEST: "
            "connectionId=%s "
            "guestSessionId=%s",
            connection_id,
            guest_session_id,
        )

        return {
            "statusCode": 200,
            "body": "Connected",
        }


    # ─────────────────────────────────────────────────────────────────────────
    # 4. Nothing provided
    # ─────────────────────────────────────────────────────────────────────────

    logger.info(
        "No authentication or guestSessionId — "
        "rejecting $connect for %s",
        connection_id,
    )

    return {
        "statusCode": 401,
        "body": (
            "Unauthorized: "
            "token or guestSessionId required"
        ),
    }