"""
app.api.v1.endpoints.tenants
============================
Tenant (company) management — platform admin only, except /tenants/me
which a tenant owner uses to read its own record.

GET    /auth/tenants        list all tenants                 [admin]
GET    /auth/tenants/me     my own tenant                    [tenant]
GET    /auth/tenants/{id}   one tenant                       [admin]
PATCH  /auth/tenants/{id}   suspend / activate               [admin]
DELETE /auth/tenants/{id}   delete tenant + its owner user   [admin]

GET    /auth/users          users of my tenant | all         [tenant|admin]
DELETE /auth/users/{username}  delete a user                 [tenant|admin]
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ForbiddenError
from shared.structured_logger import get_logger

from app.core.dependencies import (
    get_cognito_service,
    get_current_user,
    get_tenant_service,
    require_admin_or_tenant,
    require_platform_admin,
)
from app.models.schemas import TenantUpdateBody
from app.services.cognito_service import CognitoService
from app.services.tenant_service import TenantService

router = APIRouter()
log = get_logger("auth.tenants")


# ── Tenants ───────────────────────────────────────────────────────────

@router.get("/tenants", summary="List all tenants")
async def list_tenants(
    _: Annotated[UserContext, Depends(require_platform_admin)],
    tenants: Annotated[TenantService, Depends(get_tenant_service)],
):
    items = tenants.list_all()
    return {"tenants": items, "count": len(items)}


@router.get("/tenants/me", summary="My own tenant record")
async def my_tenant(
    user: Annotated[UserContext, Depends(get_current_user)],
    tenants: Annotated[TenantService, Depends(get_tenant_service)],
):
    if not user.tenant_id:
        raise BadRequestError("This account is not linked to a tenant.")
    return tenants.get(user.tenant_id)


@router.get("/tenants/{tenantId}", summary="Get a tenant")
async def get_tenant(
    tenantId: str,
    _: Annotated[UserContext, Depends(require_platform_admin)],
    tenants: Annotated[TenantService, Depends(get_tenant_service)],
):
    return tenants.get(tenantId)


@router.patch("/tenants/{tenantId}", summary="Update a tenant (suspend / activate)")
async def update_tenant(
    tenantId: str,
    body: TenantUpdateBody,
    admin: Annotated[UserContext, Depends(require_platform_admin)],
    tenants: Annotated[TenantService, Depends(get_tenant_service)],
    cognito: Annotated[CognitoService, Depends(get_cognito_service)],
):
    updated = tenants.update(tenantId, body.model_dump(exclude_none=True))

    # Suspending a tenant should also lock its owner out.
    if body.isActive is not None:
        owner_email = updated.get("email", "")
        if owner_email:
            try:
                cognito.set_user_enabled(owner_email, bool(body.isActive))
            except Exception:  # noqa: BLE001
                log.warning("tenant.owner.toggle_failed",
                            tenant_id=tenantId, enabled=body.isActive)

    log.info("tenant.updated.by_admin", tenant_id=tenantId, admin=admin.email)
    return updated


@router.delete("/tenants/{tenantId}", summary="Delete a tenant")
async def delete_tenant(
    tenantId: str,
    admin: Annotated[UserContext, Depends(require_platform_admin)],
    tenants: Annotated[TenantService, Depends(get_tenant_service)],
    cognito: Annotated[CognitoService, Depends(get_cognito_service)],
):
    tenant = tenants.get(tenantId)

    if int(tenant.get("restaurantCount", 0)) > 0:
        raise BadRequestError(
            f"Tenant still owns {tenant['restaurantCount']} restaurant(s). "
            f"Delete them first."
        )

    owner_email = tenant.get("email", "")
    if owner_email:
        try:
            cognito.delete_user(owner_email)
        except Exception:  # noqa: BLE001
            log.warning("tenant.owner.delete_failed", tenant_id=tenantId)

    tenants.delete(tenantId)
    log.info("tenant.deleted.by_admin", tenant_id=tenantId, admin=admin.email)
    return {"tenantId": tenantId, "deleted": True}


# ── Users ─────────────────────────────────────────────────────────────

@router.get("/users", summary="List users (own tenant, or all for admin)")
async def list_users(
    user: Annotated[UserContext, Depends(require_admin_or_tenant)],
    cognito: Annotated[CognitoService, Depends(get_cognito_service)],
):
    scope = "" if user.is_admin() else user.tenant_id
    users = cognito.list_users(tenant_id=scope)
    return {"users": users, "count": len(users)}


@router.delete("/users/{username}", summary="Delete a user")
async def delete_user(
    username: str,
    user: Annotated[UserContext, Depends(require_admin_or_tenant)],
    cognito: Annotated[CognitoService, Depends(get_cognito_service)],
):
    if not user.is_admin():
        target = next(
            (u for u in cognito.list_users(tenant_id=user.tenant_id)
             if u["username"] == username or u["email"] == username),
            None,
        )
        if target is None:
            raise ForbiddenError("You may only delete users in your own tenant.")

    cognito.delete_user(username)
    log.info("user.deleted", username=username, by=user.email)
    return {"username": username, "deleted": True}