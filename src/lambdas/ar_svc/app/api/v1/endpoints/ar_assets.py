"""
app.api.v1.endpoints.ar_assets
=============================
GET    /ar/{restaurantId}/{itemId}  → public (X-Tenant-Id required)
PUT    /ar/{restaurantId}/{itemId}  → admin or tenant only
DELETE /ar/{restaurantId}/{itemId}  → admin or tenant only
"""
from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends

from shared.cognito_auth import UserContext
from shared.structured_logger import get_logger

from app.core.dependencies import (
    get_ar_service,
    get_tenant_id,
    require_admin_or_tenant,
)
from app.schemas.ar_asset import ArUpdateBody
from app.services.ar_assets_service import ArAssetsService

log = get_logger("api.ar-assets")
router = APIRouter()


# ── GET — Public ──────────────────────────────────────────────────────────────

@router.get("/{restaurantId}/{itemId}", summary="Get AR asset presigned URL")
async def get_ar_asset(
    restaurantId: str,
    itemId:       str,
    tenant_id:    Annotated[str,            Depends(get_tenant_id)],
    service:      Annotated[ArAssetsService, Depends(get_ar_service)],
):
    log.info("ar.get", restaurant_id=restaurantId, item_id=itemId, tenant_id=tenant_id)
    return service.get_ar_asset(tenant_id, restaurantId, itemId)


# ── PUT — Admin/Tenant ────────────────────────────────────────────────────────

@router.put("/{restaurantId}/{itemId}", summary="Update AR asset metadata")
async def update_ar_asset(
    restaurantId: str,
    itemId:       str,
    body:         ArUpdateBody,
    user:         Annotated[UserContext,     Depends(require_admin_or_tenant)],
    service:      Annotated[ArAssetsService, Depends(get_ar_service)],
):
    log.info("ar.put", restaurant_id=restaurantId, item_id=itemId, tenant_id=user.tenant_id)
    raw = json.dumps(body.model_dump(exclude_none=True))
    return service.update_ar_asset(user.tenant_id, restaurantId, itemId, raw)


# ── DELETE — Admin/Tenant ─────────────────────────────────────────────────────

@router.delete("/{restaurantId}/{itemId}", summary="Delete AR asset metadata")
async def delete_ar_asset(
    restaurantId: str,
    itemId:       str,
    user:         Annotated[UserContext,     Depends(require_admin_or_tenant)],
    service:      Annotated[ArAssetsService, Depends(get_ar_service)],
):
    log.info("ar.delete", restaurant_id=restaurantId, item_id=itemId, tenant_id=user.tenant_id)
    return service.delete_ar_asset(user.tenant_id, restaurantId, itemId)
