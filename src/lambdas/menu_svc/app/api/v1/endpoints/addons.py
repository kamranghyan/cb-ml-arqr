"""
AddOn API endpoints.

Public:
GET /restaurants/{restaurantId}/items/{itemId}/addons
GET /restaurants/{restaurantId}/items/{itemId}/addons/  {addOnId}

Admin/Tenant:
POST   /restaurants/{restaurantId}/items/{itemId}/addons
PUT    /restaurants/{restaurantId}/items/{itemId}/addons/{addOnId}
DELETE /restaurants/{restaurantId}/items/{itemId}/addons/{addOnId}
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ResourceNotFoundError
from shared.structured_logger import get_logger

from app.core.dependencies import (
    get_addon_service,
    get_menu_tenant,
    restaurant_write_scope,
    get_item_service,
)

from app.services.menu_item_service import (
    MenuItemNotFoundError,
    MenuItemService,
)

from app.models.base import ValidationError
from app.schemas.common import PaginatedResponse
from app.services.addon_service import (
    AddOnNotFoundError,
    AddOnService,
)

from app.utils.request_helpers import (
    coerce_bool,
    coerce_int,
    parse_body,
)

log = get_logger("api.addons")

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────
# PUBLIC
# ─────────────────────────────────────────────────────────────────────

@router.get(
    "/restaurants/{restaurantId}/items/{itemId}/addons",
    summary="List add-ons for a menu item",
)
async def list_addons(
    restaurantId: str,
    itemId: str,
    tenant_id: Annotated[str, Depends(get_menu_tenant)],
    svc: Annotated[AddOnService, Depends(get_addon_service)],
    cursor: Optional[str] = Query(None),
):
    try:
        addons, next_cursor = svc.list(
            tenant_id,
            restaurantId,
            itemId,
            encoded_lek=cursor,
        )

        return PaginatedResponse(
            items=[addon.to_dict() for addon in addons],
            count=len(addons),
            lastEvaluatedKey=next_cursor,
        ).to_dict()

    except AddOnNotFoundError as exc:
        raise ResourceNotFoundError("AddOn", itemId) from exc


@router.get(
    "/restaurants/{restaurantId}/items/{itemId}/addons/{addOnId}",
    summary="Get a menu item add-on",
)
async def get_addon(
    restaurantId: str,
    itemId: str,
    addOnId: str,
    tenant_id: Annotated[str, Depends(get_menu_tenant)],
    svc: Annotated[AddOnService, Depends(get_addon_service)],
):
    try:
        addon = svc.get(
            tenant_id,
            restaurantId,
            itemId,
            addOnId,
        )
        return addon.to_dict()

    except AddOnNotFoundError as exc:
        raise ResourceNotFoundError("AddOn", addOnId) from exc


# ─────────────────────────────────────────────────────────────────────
# ADMIN / TENANT
# ─────────────────────────────────────────────────────────────────────

@router.post(
    "/restaurants/{restaurantId}/items/{itemId}/addons",
    status_code=201,
    summary="Create an add-on for a menu item",
)
async def create_addon(
    restaurantId: str,
    itemId: str,
    request: Request,
    scope: Annotated[
        tuple[UserContext, str],
        Depends(restaurant_write_scope),
    ],
    svc: Annotated[AddOnService, Depends(get_addon_service)],
    item_svc: Annotated[
        MenuItemService,
        Depends(get_item_service),
    ],
):
    user, tenant_id = scope
    body = await parse_body(request)
    coerce_bool(body, "isActive")
    coerce_int(body, "priceMinorUnits")
    coerce_int(body, "sortOrder")

    # The relationship comes from the URL, not from the request body.
    body["menuItemId"] = itemId

    try:
        # 1. Fetch the menu item to verify it exists and get its category ID
        menu_item = item_svc.get(
            tenant_id,
            restaurantId,
            itemId,
        )
        
        category_id = menu_item.categoryId

        # 2. Create the AddOn using the category ID
        addon = svc.create(
            tenant_id,
            restaurantId,
            body,
            category_id,
        )
        
        return addon.to_dict()

    except MenuItemNotFoundError as exc:
        # Handle the exception when the parent item does not exist
        raise ResourceNotFoundError("MenuItem", itemId) from exc
    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc



@router.put(
    "/restaurants/{restaurantId}/items/{itemId}/addons/{addOnId}",
    summary="Update a menu item add-on",
)
async def update_addon(
    restaurantId: str,
    itemId: str,
    addOnId: str,
    request: Request,
    scope: Annotated[
        tuple[UserContext, str],
        Depends(restaurant_write_scope),
    ],
    svc: Annotated[AddOnService, Depends(get_addon_service)],
):
    user, tenant_id = scope

    body = await parse_body(request)

    coerce_bool(body, "isActive")
    coerce_int(body, "priceMinorUnits")
    coerce_int(body, "sortOrder")

    try:
        addon = svc.update(
            tenant_id,
            restaurantId,
            itemId,
            addOnId,
            body,
        )

        return addon.to_dict()

    except AddOnNotFoundError as exc:
        raise ResourceNotFoundError("AddOn", addOnId) from exc

    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc


@router.delete(
    "/restaurants/{restaurantId}/items/{itemId}/addons/{addOnId}",
    summary="Delete a menu item add-on",
)
async def delete_addon(
    restaurantId: str,
    itemId: str,
    addOnId: str,
    scope: Annotated[
        tuple[UserContext, str],
        Depends(restaurant_write_scope),
    ],
    svc: Annotated[AddOnService, Depends(get_addon_service)],
):
    user, tenant_id = scope

    try:
        svc.delete(
            tenant_id,
            restaurantId,
            itemId,
            addOnId,
        )

        return {"message": "AddOn deleted"}

    except AddOnNotFoundError as exc:
        raise ResourceNotFoundError("AddOn", addOnId) from exc