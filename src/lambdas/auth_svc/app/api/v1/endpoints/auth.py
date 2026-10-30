"""
app.api.v1.endpoints.auth
=========================
POST /auth/login      public
POST /auth/refresh    public
POST /auth/register   role-dependent (see below)
GET  /auth/me         any logged-in user

Registration rules
------------------
role=admin   platform admin only  (or the one-off seed script)
role=tenant  platform admin only  → also creates the TenantTable row
role=staff   tenant owner (own tenant) or platform admin
"""
from __future__ import annotations

import base64
import json
from typing import Annotated, Optional

from fastapi import APIRouter, Depends

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ForbiddenError
from shared.structured_logger import get_logger

from app.core.config import get_settings
from app.core.dependencies import (
    get_cognito_service,
    get_current_user,
    get_tenant_service,
    optional_user,
)
from app.models.schemas import (
    LoginBody,
    RefreshBody,
    RegisterBody,
    RegisterResponse,
    UserProfile,
)
from app.services.cognito_service import CognitoService
from app.services.tenant_service import TenantService

router = APIRouter()
log = get_logger("auth.endpoints")
_settings = get_settings()

_GROUP_FOR_ROLE = {
    "admin":  _settings.group_admin,
    "tenant": _settings.group_tenant,
    "staff":  _settings.group_staff,
}

_ROLE_FOR_GROUP = {v: k for k, v in _GROUP_FOR_ROLE.items()}


def _claims_from_id_token(id_token: str) -> dict:
    """Read (not verify) the payload — the token was just issued by Cognito."""
    try:
        payload = id_token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))
    except Exception:  # noqa: BLE001
        return {}


def _profile_from_claims(claims: dict) -> UserProfile:
    groups = claims.get("cognito:groups", []) or []
    role = next((_ROLE_FOR_GROUP[g] for g in groups if g in _ROLE_FOR_GROUP), "")
    return UserProfile(
        sub=claims.get("sub", ""),
        email=claims.get("email", ""),
        name=claims.get("custom:display_name", ""),
        role=role,
        tenantId=claims.get("custom:tenant_id", ""),
        restaurantId=claims.get("custom:restaurant_id", ""),
        groups=groups,
    )


# ── Login / refresh ───────────────────────────────────────────────────

@router.post("/login", summary="Log in with email and password")
async def login(
    body: LoginBody,
    cognito: Annotated[CognitoService, Depends(get_cognito_service)],
):
    result = cognito.login(body.email, body.password)
    claims = _claims_from_id_token(result["IdToken"])
    profile = _profile_from_claims(claims)

    log.info("auth.login.success", email=body.email, role=profile.role)
    return {
        "idToken":      result["IdToken"],
        "accessToken":  result["AccessToken"],
        "refreshToken": result.get("RefreshToken"),
        "expiresIn":    result.get("ExpiresIn", 3600),
        "user":         profile.model_dump(),
    }


@router.post("/refresh", summary="Exchange a refresh token for new tokens")
async def refresh(
    body: RefreshBody,
    cognito: Annotated[CognitoService, Depends(get_cognito_service)],
):
    result = cognito.refresh(body.refreshToken)
    claims = _claims_from_id_token(result["IdToken"])
    return {
        "idToken":     result["IdToken"],
        "accessToken": result["AccessToken"],
        "expiresIn":   result.get("ExpiresIn", 3600),
        "user":        _profile_from_claims(claims).model_dump(),
    }


# ── Who am I ──────────────────────────────────────────────────────────

@router.get("/me", summary="Current user's profile and scope")
async def me(user: Annotated[UserContext, Depends(get_current_user)]):
    role = next(
        (_ROLE_FOR_GROUP[g] for g in user.groups if g in _ROLE_FOR_GROUP), ""
    )
    return {
        "sub":          user.sub,
        "email":        user.email,
        "role":         role,
        "tenantId":     user.tenant_id,
        "restaurantId": user.restaurant_id,
        "groups":       user.groups,
    }


# ── Registration ──────────────────────────────────────────────────────

@router.post("/register", status_code=201, summary="Create a user")
async def register(
    body: RegisterBody,
    cognito: Annotated[CognitoService, Depends(get_cognito_service)],
    tenants: Annotated[TenantService, Depends(get_tenant_service)],
    caller: Annotated[Optional[UserContext], Depends(optional_user)] = None,
):
    role = body.role
    group = _GROUP_FOR_ROLE[role]

    # ── Authorisation ────────────────────────────────────────────────
    if role in ("admin", "tenant"):
        if caller is None or not caller.is_admin():
            raise ForbiddenError(
                "Only a platform administrator may create admin or tenant accounts."
            )
    else:  # staff
        if caller is None:
            raise ForbiddenError("Authentication required.")
        if not (caller.is_admin() or caller.is_tenant()):
            raise ForbiddenError(
                "Only a platform administrator or tenant owner may create staff."
            )
        if caller.is_tenant():
            # A tenant owner may only create users inside its own tenant.
            if body.tenantId and body.tenantId != caller.tenant_id:
                raise ForbiddenError("You may only create users in your own tenant.")
            body.tenantId = caller.tenant_id

    # ── Role-specific requirements ───────────────────────────────────
    tenant_id = body.tenantId or ""
    restaurant_id = body.restaurantId or ""

    if role == "tenant":
        if not body.companyName:
            raise BadRequestError("companyName is required when creating a tenant.")
        tenant = tenants.create(
            company_name=body.companyName,
            email=body.email,
            plan_tier=body.planTier or "starter",
        )
        tenant_id = tenant["tenantId"]
        restaurant_id = ""

    elif role == "staff":
        if not tenant_id:
            raise BadRequestError(f"tenantId is required when creating a {role}.")
        if not restaurant_id:
            raise BadRequestError(f"restaurantId is required when creating a {role}.")
        tenants.get(tenant_id)  # 404 if the tenant does not exist

    else:  # admin — deliberately has neither tenant nor restaurant
        tenant_id = ""
        restaurant_id = ""

    # ── Create the Cognito user ──────────────────────────────────────
    try:
        sub = cognito.create_user(
            email=body.email,
            password=body.password,
            group=group,
            name=body.name,
            tenant_id=tenant_id,
            restaurant_id=restaurant_id,
        )
    except Exception:
        # If the tenant row was just created, remove it so a retry is clean.
        if role == "tenant" and tenant_id:
            try:
                tenants.delete(tenant_id)
            except Exception:  # noqa: BLE001
                log.warning("auth.register.tenant_rollback_failed", tenant_id=tenant_id)
        raise

    log.info("auth.register.success", role=role, email=body.email,
             tenant_id=tenant_id, restaurant_id=restaurant_id)

    return RegisterResponse(
        sub=sub,
        email=body.email,
        role=role,
        tenantId=tenant_id,
        restaurantId=restaurant_id,
    ).model_dump()