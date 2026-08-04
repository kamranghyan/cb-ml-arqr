"""
app.core.dependencies
=====================
FastAPI dependency-injection factories:

* Auth    — Cognito bearer-token validation + role enforcement
* Tenant  — X-Tenant-Id header / query param (public GET)
* Service — ArAssetsService with injected AWS clients
"""
from __future__ import annotations

from typing import Annotated

import boto3
from fastapi import Depends, Header, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.aws_clients import get_dynamodb_resource, get_s3_client
from shared.cognito_auth import CognitoAuth, UserContext
from shared.exceptions import BadRequestError, TokenMissingError

from app.core.config import get_settings
from app.services.ar_assets_service import ArAssetsService

_settings = get_settings()

_auth = CognitoAuth()
_bearer = HTTPBearer(auto_error=False)

MUTATE_ROLES = ["menulay_admin", "menulay_tenant"]


# ── Auth ──────────────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
) -> UserContext:
    """Verify Bearer JWT → UserContext. Raises 401 on failure."""
    if not credentials:
        raise TokenMissingError()
    fake_event = {"headers": {"Authorization": f"Bearer {credentials.credentials}"}}
    return _auth.get_user_from_event(fake_event)


async def require_admin_or_tenant(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    """Require menulay_admin or menulay_tenant role. Raises 403 on failure."""
    _auth.require_roles(user, MUTATE_ROLES)
    return user


# ── Tenant ID (public GET) ────────────────────────────────────────────────────

async def get_tenant_id(
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-Id")] = None,
    tenantId: Annotated[str | None, Query()] = None,
) -> str:
    """Extract tenantId from header or query param. Raises 400 if missing."""
    tid = x_tenant_id or tenantId
    if not tid:
        raise BadRequestError("X-Tenant-Id header or tenantId query parameter is required.")
    return tid


# ── Service factory ───────────────────────────────────────────────────────────

def get_ar_service() -> ArAssetsService:
    """Provide ArAssetsService with injected AWS clients (cached on warm starts)."""
    return ArAssetsService(
        s3_client=get_s3_client(),
        ddb_table=get_dynamodb_resource().Table(_settings.menu_table),
        cf_client=boto3.client("cloudfront"),
        bucket_name=_settings.asset_bucket_name,
        cf_domain=_settings.cf_domain,
    )