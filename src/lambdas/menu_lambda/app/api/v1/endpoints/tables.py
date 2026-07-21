"""
app.api.v1.endpoints.tables
===========================
GET    /menus/restaurants/{rid}/tables            → public
POST   /menus/restaurants/{rid}/tables            → admin/tenant
PUT    /menus/restaurants/{rid}/tables/{tid}      → admin/tenant
DELETE /menus/restaurants/{rid}/tables/{tid}      → admin/tenant

Calls ``app.services.table_service.TableService`` directly — the legacy
handler-bridging (fake RequestContext + Lambda response unwrapping) is gone.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from shared.cognito_auth import UserContext

from app.core.dependencies import (
    get_menu_tenant,
    get_table_service,
    require_admin_or_tenant,
)
from app.services.table_service import TableService
from app.utils.request_helpers import parse_body

router = APIRouter()


@router.get("/restaurants/{restaurantId}/tables", summary="List restaurant tables")
async def list_tables(
    restaurantId: str,
    tenant_id:    Annotated[str,          Depends(get_menu_tenant)],
    svc:          Annotated[TableService, Depends(get_table_service)],
):
    return svc.list(tenant_id, restaurantId)


@router.post(
    "/restaurants/{restaurantId}/tables",
    status_code=201,
    summary="Create a table",
)
async def create_table(
    restaurantId: str,
    request:      Request,
    user:         Annotated[UserContext,  Depends(require_admin_or_tenant)],
    svc:          Annotated[TableService, Depends(get_table_service)],
):
    body = await parse_body(request)
    return svc.create(user.tenant_id, restaurantId, body)


@router.put(
    "/restaurants/{restaurantId}/tables/{tableId}",
    summary="Update a table",
)
async def update_table(
    restaurantId: str,
    tableId:      str,
    request:      Request,
    user:         Annotated[UserContext,  Depends(require_admin_or_tenant)],
    svc:          Annotated[TableService, Depends(get_table_service)],
):
    body = await parse_body(request)
    return svc.update(user.tenant_id, restaurantId, tableId, body)


@router.delete(
    "/restaurants/{restaurantId}/tables/{tableId}",
    summary="Delete a table",
)
async def delete_table(
    restaurantId: str,
    tableId:      str,
    user:         Annotated[UserContext,  Depends(require_admin_or_tenant)],
    svc:          Annotated[TableService, Depends(get_table_service)],
):
    return svc.delete(user.tenant_id, restaurantId, tableId)
