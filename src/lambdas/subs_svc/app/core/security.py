"""
app.core.security
=================
Cognito authentication and authorization utilities.

Purpose
-------
• Validate JWT tokens from Cognito
• Extract tenant_id and role from token claims
• Provide role-based access control
• Support platform admins viewing any tenant

Claims Used
-----------
• sub: User ID
• custom:tenant_id: Tenant ID
• cognito:groups: ['menulay_admin', 'admin', 'tenant', 'kitchen']
• email: User email
"""

import jwt
import json
import logging
import requests
from typing import Dict, List
from functools import wraps
from fastapi import HTTPException, Request

from app.core.config import settings


logger = logging.getLogger(__name__)


# Groups that are considered platform administrators.
ALLOWED_ADMIN_GROUPS = {
    "admin",
    "platform_admin",
    "menulay_admin",
}


class CognitoAuth:
    """Cognito authentication handler."""

    @staticmethod
    def get_public_keys():
        """Get Cognito public keys for JWT verification."""
        try:
            url = (
                f"https://cognito-idp."
                f"{settings.COGNITO_REGION}.amazonaws.com/"
                f"{settings.COGNITO_USER_POOL_ID}"
                f"/.well-known/jwks.json"
            )

            response = requests.get(url, timeout=10)
            response.raise_for_status()

            return response.json()["keys"]

        except Exception as e:
            logger.error(
                f"Failed to fetch Cognito public keys: {str(e)}"
            )

            raise HTTPException(
                status_code=500,
                detail="Authentication service unavailable",
            )

    @staticmethod
    def decode_token(token: str) -> Dict:
        """
        Decode and verify Cognito JWT token.

        Supports both:
        - ID tokens
        - Access tokens
        """

        try:
            if token.startswith("Bearer "):
                token = token[7:]

            keys = CognitoAuth.get_public_keys()

            for key in keys:
                try:
                    public_key = (
                        jwt.algorithms.RSAAlgorithm.from_jwk(
                            json.dumps(key)
                        )
                    )

                    decoded = jwt.decode(
                        token,
                        public_key,
                        algorithms=["RS256"],
                        options={
                            "verify_aud": False,
                        },
                        issuer=(
                            f"https://cognito-idp."
                            f"{settings.COGNITO_REGION}."
                            f"amazonaws.com/"
                            f"{settings.COGNITO_USER_POOL_ID}"
                        ),
                    )

                    # ID token -> aud
                    # Access token -> client_id
                    token_client_id = (
                        decoded.get("client_id")
                        or decoded.get("aud")
                    )

                    if (
                        token_client_id
                        != settings.COGNITO_CLIENT_ID
                    ):
                        logger.warning(
                            "Token client_id mismatch: %s",
                            token_client_id,
                        )

                        raise jwt.InvalidTokenError(
                            "Token was not issued for this client ID"
                        )

                    return decoded

                except jwt.InvalidTokenError:
                    continue

            raise jwt.InvalidTokenError(
                "No valid key found for signature verification"
            )

        except jwt.InvalidTokenError as e:
            logger.error(
                f"Token validation failed: {str(e)}"
            )

            raise HTTPException(
                status_code=401,
                detail=(
                    f"Invalid authentication token: {str(e)}"
                ),
            )

        except Exception as e:
            logger.error(
                f"Unexpected error decoding token: {str(e)}"
            )

            raise HTTPException(
                status_code=401,
                detail="Authentication failed",
            )

    @staticmethod
    def get_tenant_id_from_token(token: str) -> str:
        """Extract tenant ID from JWT token."""

        decoded = CognitoAuth.decode_token(token)

        tenant_id = (
            decoded.get("custom:tenant_id")
            or decoded.get("sub")
        )

        if not tenant_id:
            raise HTTPException(
                status_code=401,
                detail="Tenant ID not found in token",
            )

        return tenant_id

    @staticmethod
    def get_user_roles_from_token(
        token: str,
    ) -> List[str]:
        """Extract Cognito groups/roles from JWT token."""

        decoded = CognitoAuth.decode_token(token)

        groups = decoded.get(
            "cognito:groups",
            [],
        )

        if isinstance(groups, str):
            groups = [groups]

        return [
            str(group).lower()
            for group in groups
        ]


# ─────────────────────────────────────────────────────────────
# FastAPI Dependency
# ─────────────────────────────────────────────────────────────

async def get_current_tenant(
    request: Request,
) -> Dict:
    """
    Get current authenticated user.

    IMPORTANT:
    If the user belongs to ANY admin group, their role is
    explicitly set to 'admin'.

    This prevents groups[0] from incorrectly making an admin
    user appear as a normal tenant.
    """

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        raise HTTPException(
            status_code=401,
            detail="Authorization header required",
        )

    token = auth_header

    if token.lower().startswith("bearer "):
        token = token[7:]

    decoded = CognitoAuth.decode_token(token)

    # Get all Cognito groups.
    groups = decoded.get(
        "cognito:groups",
        [],
    )

    if isinstance(groups, str):
        groups = [groups]

    groups = [
        str(group).lower()
        for group in groups
    ]

    # ─────────────────────────────────────────────────────────
    # FIX:
    # Check ALL groups instead of groups[0].
    # ─────────────────────────────────────────────────────────

    is_admin = any(
        group in ALLOWED_ADMIN_GROUPS
        for group in groups
    )

    if is_admin:
        role = "admin"
    elif "kitchen" in groups:
        role = "kitchen"
    elif "tenant" in groups:
        role = "tenant"
    else:
        role = groups[0] if groups else "tenant"

    tenant_id = (
        decoded.get("custom:tenant_id")
        or decoded.get("sub")
    )

    if not tenant_id:
        raise HTTPException(
            status_code=401,
            detail="Tenant ID not found in token",
        )

    result = {
        "tenant_id": tenant_id,
        "email": decoded.get("email"),
        "role": role,
        "roles": groups,
    }

    # Debug logging
    logger.info(
        "Authenticated user: tenant_id=%s role=%s roles=%s",
        tenant_id,
        role,
        groups,
    )

    return result


# ─────────────────────────────────────────────────────────────
# Admin decorator
# ─────────────────────────────────────────────────────────────

def admin_required(func):
    """Decorator to ensure user has admin permissions."""

    @wraps(func)
    async def wrapper(*args, **kwargs):

        request = kwargs.get("request")

        if not request:
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

        if not request:
            raise HTTPException(
                status_code=400,
                detail="Request object required",
            )

        auth_header = request.headers.get(
            "Authorization"
        )

        if not auth_header:
            raise HTTPException(
                status_code=401,
                detail="Authorization header required",
            )

        token = auth_header

        if token.lower().startswith("bearer "):
            token = token[7:]

        user_roles = (
            CognitoAuth.get_user_roles_from_token(token)
        )

        # Any admin group is enough.
        if not any(
            role in ALLOWED_ADMIN_GROUPS
            for role in user_roles
        ):
            raise HTTPException(
                status_code=403,
                detail="Admin privileges required",
            )

        return await func(*args, **kwargs)

    return wrapper