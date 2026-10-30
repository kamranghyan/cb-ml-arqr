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
    restaurant_write_scope,
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
    scope:         Annotated[tuple[UserContext, str],  Depends(restaurant_write_scope)],
    svc:          Annotated[TableService, Depends(get_table_service)],
):
    user, tenant_id = scope
    body = await parse_body(request)
    return svc.create(tenant_id, restaurantId, body)


@router.put(
    "/restaurants/{restaurantId}/tables/{tableId}",
    summary="Update a table",
)
async def update_table(
    restaurantId: str,
    tableId:      str,
    request:      Request,
    scope:         Annotated[tuple[UserContext, str],  Depends(restaurant_write_scope)],
    svc:          Annotated[TableService, Depends(get_table_service)],
):
    user, tenant_id = scope
    body = await parse_body(request)
    return svc.update(tenant_id, restaurantId, tableId, body)


@router.delete(
    "/restaurants/{restaurantId}/tables/{tableId}",
    summary="Delete a table",
)
async def delete_table(
    restaurantId: str,
    tableId:      str,
    scope:         Annotated[tuple[UserContext, str],  Depends(restaurant_write_scope)],
    svc:          Annotated[TableService, Depends(get_table_service)],
):
    user, tenant_id = scope
    return svc.delete(tenant_id, restaurantId, tableId)