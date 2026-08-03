"""
app.core.dependencies
=====================
All FastAPI dependency-injection factories in one place:

* Auth        — Cognito bearer-token validation + role enforcement
* Tenant      — X-Tenant-Id header (public reads) / token claim (writes)
* Services    — module-level singletons reused across warm invocations
"""
from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.aws_clients import get_dynamodb_resource
from shared.cognito_auth import CognitoAuth, UserContext
from shared.exceptions import (
    BadRequestError,
    ForbiddenError,
    ResourceNotFoundError,
    TokenMissingError,
)

from app.core.config import get_settings
from app.repositories.s3_repository import S3Repository
from app.services.cache_service import CacheService
from app.services.category_service import CategoryService
from app.services.menu_item_service import MenuItemService
from app.services.restaurant_service import RestaurantService
from app.services.tenant_limits import TenantLimits
from app.services.s3_service import S3Service
from app.services.table_service import TableService

_settings = get_settings()

_auth = CognitoAuth()
_bearer = HTTPBearer(auto_error=False)

MUTATE_ROLES = ["menulay_admin", "menulay_tenant"]
# Anyone who may touch a restaurant's content (menu, categories, tables, QR).
# The tenant owner manages every branch it owns; a platform admin acts only as
# a support override and must name the tenant it is acting for.
MANAGE_ROLES = ["menulay_admin", "menulay_tenant"]

# ── Module-level singletons (warm invocation reuse) ───────────────────────────
_cache = CacheService()
_s3_svc = S3Service()
_s3_repo = S3Repository()
_tenant_limits = TenantLimits()
_restaurant_service = RestaurantService(cache=_cache, s3_svc=_s3_svc)


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


async def optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
) -> UserContext | None:
    """Returns the user when a valid token is present, else None."""
    if not credentials:
        return None
    try:
        fake_event = {"headers": {"Authorization": f"Bearer {credentials.credentials}"}}
        return _auth.get_user_from_event(fake_event)
    except Exception:  # noqa: BLE001
        return None


async def require_admin_or_tenant(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    _auth.require_roles(user, MUTATE_ROLES)
    return user


async def require_tenant_owner(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    """
    Creating and deleting restaurants belongs to the tenant that owns them.
    A platform admin is allowed through as a support override, but must then
    say which tenant it is acting for (see resolve_write_tenant).
    """
    if not (user.is_tenant() or user.is_admin()):
        raise ForbiddenError(
            "Only a tenant owner may create or delete restaurants."
        )
    return user


async def require_restaurant_manager(
    user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    """Tenant owner, or platform admin acting as support."""
    _auth.require_roles(user, MANAGE_ROLES)
    return user


# ══════════════════════════════════════════════════════════════════════════════
# Scope enforcement
# ══════════════════════════════════════════════════════════════════════════════

async def restaurant_write_scope(
    restaurantId: str,
    user: Annotated[UserContext, Depends(require_restaurant_manager)],
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-Id")] = None,
) -> tuple[UserContext, str]:
    """
    Guard for every write under /restaurants/{restaurantId}/… (categories,
    items, tables).

    Returns (user, tenant_id) after checking that:
      • the caller has a role allowed to manage restaurant content
      • a branch-bound user (kitchen) is writing to its OWN branch
      • a platform admin has said which tenant it is acting for
      • THE RESTAURANT ACTUALLY BELONGS TO THAT TENANT — without this a
        tenant could write into another company's restaurant just by
        knowing its id.

    Endpoints use it as:
        scope: Annotated[tuple[UserContext, str], Depends(restaurant_write_scope)]
        user, tenant_id = scope
    """
    tenant_id = resolve_write_tenant(user, x_tenant_id)
    assert_restaurant_scope(user, restaurantId)
    _assert_restaurant_belongs_to_tenant(restaurantId, tenant_id)
    return user, tenant_id


def _assert_restaurant_belongs_to_tenant(restaurant_id: str, tenant_id: str) -> None:
    """
    Look the restaurant up and confirm its tenantId matches.

    A missing restaurant is reported as 404 rather than 403 — the caller has
    no business learning that some other tenant owns that id.
    """
    from app.services.restaurant_service import RestaurantNotFoundError

    try:
        restaurant = _restaurant_service.get(tenant_id, restaurant_id)
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurant_id) from exc

    owner = getattr(restaurant, "tenantId", "")
    if owner and owner != tenant_id:
        raise ResourceNotFoundError("Restaurant", restaurant_id)


def resolve_write_tenant(user: UserContext, body_tenant_id: str | None = None) -> str:
    """
    Which tenant is this write for?

    tenant owner / restaurant admin → their own tenant, always
    platform admin                 → must pass tenantId explicitly (support
                                     override); we never guess on their behalf
    """
    if user.is_admin():
        if not body_tenant_id:
            raise BadRequestError(
                "tenantId is required when a platform administrator "
                "creates data on a tenant's behalf."
            )
        return body_tenant_id

    if not user.tenant_id:
        raise ForbiddenError("This account is not linked to a tenant.")

    # A tenant user may not write into someone else's tenant.
    if body_tenant_id and body_tenant_id != user.tenant_id:
        raise ForbiddenError("You may only manage your own tenant's data.")

    return user.tenant_id


def assert_restaurant_scope(user: UserContext, restaurant_id: str) -> None:
    """
    Kitchen staff are pinned to one branch. Tenant owners span every branch of
    their tenant (the caller is expected to have already matched the
    restaurant's tenantId). Platform admins pass.
    """
    if user.is_admin() or user.is_tenant():
        return
    if not user.restaurant_id:
        raise ForbiddenError("This account is not linked to a restaurant.")
    if user.restaurant_id != restaurant_id:
        raise ForbiddenError("You may only manage your own restaurant.")


# ══════════════════════════════════════════════════════════════════════════════
# Tenant resolution
# ══════════════════════════════════════════════════════════════════════════════

async def get_tenant_id(
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-Id")] = None,
    tenantId: Annotated[str | None, Query()] = None,
) -> str:
    """Tenant from header *or* query param (admin flows)."""
    tid = x_tenant_id or tenantId
    if not tid:
        raise BadRequestError("X-Tenant-Id header or tenantId query parameter is required.")
    return tid


async def get_menu_tenant(
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-Id")] = None,
) -> str:
    """Tenant from header only — used by public menu reads."""
    if not x_tenant_id:
        raise BadRequestError("X-Tenant-Id header is required")
    return x_tenant_id


async def get_menu_tenant_optional(
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-Id")] = None,
) -> str:
    """
    Tenant header, but not required.

    A guest arriving from a QR code knows only the restaurant id — the tenant
    is what they are trying to discover. RestaurantTable is keyed by
    restaurantId alone, so the lookup does not need a tenant; it is used only
    for the cache key. Endpoints using this must not expose anything beyond
    the restaurant's own public details.
    """
    return x_tenant_id or ""


# ══════════════════════════════════════════════════════════════════════════════
# Service factories
# ══════════════════════════════════════════════════════════════════════════════

def get_cache() -> CacheService:
    return _cache


def get_s3_service() -> S3Service:
    return _s3_svc


def get_s3_repo() -> S3Repository:
    return _s3_repo


@lru_cache
def get_tenant_limits() -> TenantLimits:
    return _tenant_limits


def get_restaurant_service() -> RestaurantService:
    return RestaurantService(cache=_cache, s3_svc=_s3_svc)


@lru_cache
def get_category_service() -> CategoryService:
    return CategoryService(cache=_cache, s3_svc=_s3_svc)


@lru_cache
def get_item_service() -> MenuItemService:
    return MenuItemService(cache=_cache, s3_svc=_s3_svc)


@lru_cache
def get_table_service() -> TableService:
    return TableService(table_name=_settings.restaurant_tables_table)