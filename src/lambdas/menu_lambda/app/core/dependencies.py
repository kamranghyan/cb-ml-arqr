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
from shared.exceptions import BadRequestError, TokenMissingError

from app.core.config import get_settings
from app.repositories.s3_repository import S3Repository
from app.services.cache_service import CacheService
from app.services.category_service import CategoryService
from app.services.menu_item_service import MenuItemService
from app.services.restaurant_service import RestaurantService
from app.services.s3_service import S3Service
from app.services.table_service import TableService

_settings = get_settings()

_auth = CognitoAuth()
_bearer = HTTPBearer(auto_error=False)

MUTATE_ROLES = ["menulay_admin", "menulay_tenant"]

# ── Module-level singletons (warm invocation reuse) ───────────────────────────
_cache = CacheService()
_s3_svc = S3Service()
_s3_repo = S3Repository()


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
