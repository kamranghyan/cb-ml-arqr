"""
app.api.v1.endpoints.items
==========================
GET    /menus/restaurants/{rid}/items         → public
GET    /menus/restaurants/{rid}/items/{iid}   → public
POST   /menus/restaurants/{rid}/items         → admin/tenant
PUT    /menus/restaurants/{rid}/items/{iid}   → admin/tenant
DELETE /menus/restaurants/{rid}/items/{iid}   → admin/tenant
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request
from app.services.category_service import CategoryService

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ResourceNotFoundError
from shared.structured_logger import get_logger

from app.core.dependencies import (
    get_item_service,
    get_category_service,
    get_menu_tenant,
    get_s3_repo,
    restaurant_write_scope,
)
from app.models.base import ValidationError
from app.repositories.s3_repository import S3Repository
from app.schemas.common import PaginatedResponse
from app.services.menu_item_service import (
    MenuItemConflictError,
    MenuItemNotFoundError,
    MenuItemService,
)
from app.utils.request_helpers import (
    build_gateway_event,
    coerce_bool,
    coerce_int,
    parse_body,
)

log = get_logger("api.items")
router = APIRouter()


@router.get("/restaurants/{restaurantId}/items", summary="List menu items")
async def list_items(
    restaurantId: str,
    tenant_id:    Annotated[str,             Depends(get_menu_tenant)],
    svc:          Annotated[MenuItemService, Depends(get_item_service)],
    cursor:       Optional[str] = Query(None),
    categoryId:   Optional[str] = Query(None),
):
    items, next_cursor = svc.list(
        tenant_id, restaurantId, encoded_lek=cursor, category_id=categoryId
    )
    return PaginatedResponse(
        items=[i.to_dict() for i in items],
        count=len(items),
        lastEvaluatedKey=next_cursor,
    ).to_dict()


@router.get("/restaurants/{restaurantId}/items/{itemId}", summary="Get a menu item")
async def get_item(
    restaurantId: str,
    itemId:       str,
    tenant_id:    Annotated[str,             Depends(get_menu_tenant)],
    svc:          Annotated[MenuItemService, Depends(get_item_service)],
):
    try:
        return svc.get(tenant_id, restaurantId, itemId).to_dict()
    except MenuItemNotFoundError as exc:
        raise ResourceNotFoundError("MenuItem", itemId) from exc



@router.post(
    "/restaurants/{restaurantId}/items",
    status_code=201,
    summary="Create a menu item",
)

async def create_item(
    restaurantId: str,
    request: Request,
    scope: Annotated[tuple[UserContext, str], Depends(restaurant_write_scope)],
    svc: Annotated[MenuItemService, Depends(get_item_service)],
    category_svc: Annotated[CategoryService, Depends(get_category_service)],
    s3_repo: Annotated[S3Repository, Depends(get_s3_repo)],
):
    user, tenant_id = scope
    body = await parse_body(request)
    
    coerce_bool(body, "isActive")
    coerce_int(body, "priceMinorUnits")
    coerce_int(body, "prepTime")
    coerce_int(body, "calories")
    if "allergens" in body and isinstance(body["allergens"], str):
        raw = body["allergens"].strip()
        body["allergens"] = (
            [a.strip().upper() for a in raw.split(",") if a.strip()] if raw else []
        )

    try:
        category = category_svc.get(tenant_id, restaurantId, body["categoryId"])
        body["categoryName"] = category.name
        item = svc.create(tenant_id, restaurantId, body)
        ct = request.headers.get("content-type", "")
        if "multipart/form-data" in ct:
            try:
                raw_event = build_gateway_event(await request.body(), ct)
                assets = s3_repo.upload_item_assets(
                    raw_event, restaurantId, item.itemId, tenant_id
                )
                updates = {}
                if assets.get("imageKey"):
                    updates["imageKey"] = assets["imageKey"]
                    item.imageUrl = assets.get("imageUrl")
                if assets.get("arModelKey"):
                    updates["arModelKey"] = assets["arModelKey"]
                    item.arModelUrl = assets.get("arModelUrl")
                if assets.get("slides"):
                    updates["slides"] = [
                        {
                            "position": slide["position"],
                            "imageKey": slide["imageKey"],
                        }
                        for slide in assets["slides"]
                    ]
                if updates:
                    updates["version"] = item.version

                    item = svc.update(
                        tenant_id,
                        restaurantId,
                        item.itemId,
                        updates,
                    )
                    if assets.get("imageUrl"):
                        item.imageUrl = assets["imageUrl"]
                    if assets.get("arModelUrl"):
                        item.arModelUrl = assets["arModelUrl"]
            except Exception as exc:
                log.warning("item.assets.upload.failed", item_id=item.itemId, exc=str(exc))
        return item.to_dict()
    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc


@router.put(
    "/restaurants/{restaurantId}/items/{itemId}",
    summary="Update a menu item",
)
async def update_item(
    restaurantId: str,
    itemId: str,
    request: Request,
    scope: Annotated[
        tuple[UserContext, str],
        Depends(restaurant_write_scope),
    ],
    svc: Annotated[MenuItemService, Depends(get_item_service)],
    category_svc: Annotated[
        CategoryService,
        Depends(get_category_service),
    ],
    s3_repo: Annotated[
        S3Repository,
        Depends(get_s3_repo),
    ],
):
    user, tenant_id = scope

    body = await parse_body(request)

    coerce_int(body, "priceMinorUnits")
    coerce_int(body, "prepTime")
    coerce_int(body, "calories")

    try:
        # Category validation
        if "categoryId" in body:
            category = category_svc.get(
                tenant_id,
                restaurantId,
                body["categoryId"],
            )
            body["categoryName"] = category.name

        # First update normal fields
        item = svc.update(
            tenant_id,
            restaurantId,
            itemId,
            body,
        )

        # Handle multipart assets
        ct = request.headers.get("content-type", "")

        if "multipart/form-data" in ct:
            try:
                raw_event = build_gateway_event(
                    await request.body(),
                    ct,
                )

                assets = s3_repo.upload_item_assets(
                    raw_event,
                    restaurantId,
                    itemId,
                    tenant_id,
                )

                asset_updates = {}

                if assets.get("imageKey"):
                    asset_updates["imageKey"] = assets["imageKey"]

                if assets.get("arModelKey"):
                    asset_updates["arModelKey"] = assets["arModelKey"]

                if assets.get("slides"):
                    asset_updates["slides"] = [
                        {
                            "position": slide["position"],
                            "imageKey": slide["imageKey"],
                        }
                        for slide in assets["slides"]
                    ]

                if asset_updates:
                    asset_updates["version"] = item.version

                    item = svc.update(
                        tenant_id,
                        restaurantId,
                        itemId,
                        asset_updates,
                    )

                # Inject generated URLs
                if assets.get("imageUrl"):
                    item.imageUrl = assets["imageUrl"]

                if assets.get("arModelUrl"):
                    item.arModelUrl = assets["arModelUrl"]

            except Exception as exc:
                log.warning(
                    "item.assets.upload.failed",
                    item_id=itemId,
                    exc=str(exc),
                )

        return item.to_dict()

    except MenuItemNotFoundError as exc:
        raise ResourceNotFoundError(
            "MenuItem",
            itemId,
        ) from exc

    except MenuItemConflictError as exc:
        raise BadRequestError(str(exc)) from exc


@router.delete("/restaurants/{restaurantId}/items/{itemId}", summary="Delete a menu item")
async def delete_item(
    restaurantId: str,
    itemId:       str,
    scope:         Annotated[tuple[UserContext, str],     Depends(restaurant_write_scope)],
    svc:          Annotated[MenuItemService, Depends(get_item_service)],
):
    user, tenant_id = scope
    try:
        svc.delete(tenant_id, restaurantId, itemId)
        return {"message": "Item deleted"}
    except MenuItemNotFoundError as exc:
        raise ResourceNotFoundError("MenuItem", itemId) from exc