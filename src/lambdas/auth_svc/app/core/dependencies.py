"""
app.core.dependencies
=====================
Role guards for auth_svc.

Who may call what
-----------------
platform admin   → tenant management, create admins/tenants
tenant owner     → users inside its own tenant only
everyone else    → /auth/me only

/auth/login and /auth/refresh are public.
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.cognito_auth import CognitoAuth, UserContext
from shared.exceptions import ForbiddenError, TokenMissingError

from app.core.config import get_settings
from app.services.cognito_service import CognitoService
from app.services.tenant_service import TenantService

_settings = get_settings()
_auth = CognitoAuth(
    user_pool_id=_settings.cognito_user_pool_id,
    region=_settings.cognito_region,
    client_id=_settings.cognito_client_id,
)
_bearer = HTTPBearer(auto_error=False)


# ── Service providers ─────────────────────────────────────────────────

def get_cognito_service() -> CognitoService:
    return CognitoService()


def get_tenant_service() -> TenantService:
    return TenantService()


# ── Identity ──────────────────────────────────────────────────────────

async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer)] = None,
) -> UserContext:
    if not credentials:
        raise TokenMissingError()
    event = {"headers": {"Authorization": f"Bearer {credentials.credentials}"}}
    return _auth.get_user_from_event(event)


async def optional_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer)] = None,
) -> Optional[UserContext]:
    if not credentials:
        return None
    try:
        event = {"headers": {"Authorization": f"Bearer {credentials.credentials}"}}
        return _auth.get_user_from_event(event)
    except Exception:
        return None


# ── Guards ────────────────────────────────────────────────────────────

async def require_platform_admin(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    """Platform admin only — tenant/plan/billing operations."""
    if not user.is_admin():
        raise ForbiddenError("Platform administrator access required.")
    return user


async def require_admin_or_tenant(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    """Platform admin or a tenant owner."""
    if not (user.is_admin() or user.is_tenant()):
        raise ForbiddenError("Administrator or tenant owner access required.")
    return user
