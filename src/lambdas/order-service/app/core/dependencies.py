"""
app.core.dependencies
=====================
All FastAPI dependency-injection factories in one place:

* Auth   — Cognito bearer-token validation + role enforcement
* Tenant — X-Tenant-Id header / query param
* Repos  — OrderRepository, StepFunctionsService

Role model (orders are never public):
    create           → admin / tenant
    list/get/update  → admin / tenant / kitchen_staff
"""
from __future__ import annotations

from typing import Annotated

import boto3
from fastapi import Depends, Header, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.aws_clients import get_dynamodb_client, get_dynamodb_resource
from shared.cognito_auth import CognitoAuth, UserContext
from shared.exceptions import BadRequestError, TokenMissingError

from app.core.config import get_settings
from app.repositories.order_repository import OrderRepository
from app.services.channels.sfn_service import StepFunctionsService

_settings = get_settings()

_auth = CognitoAuth()
_bearer = HTTPBearer(auto_error=False)

MUTATE_ROLES = ["menulay_admin", "menulay_tenant"]
ANY_STAFF_ROLES = ["menulay_admin", "menulay_tenant", "menulay_kitchen_staff"]


# ══════════════════════════════════════════════════════════════════════════════
# Auth
# ══════════════════════════════════════════════════════════════════════════════

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
) -> UserContext:
    if not credentials:
        raise TokenMissingError()
    fake_event = {"headers": {"Authorization": f"Bearer {credentials.credentials}"}}
    return _auth.get_user_from_event(fake_event)


async def require_admin_or_tenant(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    _auth.require_roles(user, MUTATE_ROLES)
    return user


async def require_any_auth(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    """Any authenticated staff user (admin / tenant / kitchen)."""
    return user


# ══════════════════════════════════════════════════════════════════════════════
# Tenant resolution
# ══════════════════════════════════════════════════════════════════════════════

async def get_tenant_id(
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-Id")] = None,
    tenantId: Annotated[str | None, Query()] = None,
) -> str:
    tid = x_tenant_id or tenantId
    if not tid:
        raise BadRequestError("X-Tenant-Id header or tenantId query parameter is required.")
    return tid


# ══════════════════════════════════════════════════════════════════════════════
# Repository / service factories
# ══════════════════════════════════════════════════════════════════════════════

def get_order_repo() -> OrderRepository:
    return OrderRepository(
        dynamodb_resource=get_dynamodb_resource(),
        dynamodb_client=get_dynamodb_client(),
        table_name=_settings.order_table,
    )


def get_sfn_service() -> StepFunctionsService:
    return StepFunctionsService(
        sfn_client=boto3.client("stepfunctions"),
        state_machine_arn=_settings.step_arn,
    )
