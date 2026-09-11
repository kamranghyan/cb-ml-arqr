"""
app.api.v1.endpoints.items
==========================

GET    /menus/restaurants/{rid}/items
GET    /menus/restaurants/{rid}/items/{iid}
POST   /menus/restaurants/{rid}/items
PUT    /menus/restaurants/{rid}/items/{iid}
DELETE /menus/restaurants/{rid}/items/{iid}

Supports:
- Normal JSON item updates
- Multipart item updates
- Main image
- Gallery slides 1-6
- AR model
- Category name refresh
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
    get_rating_service,
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
from app.services.rating_service import RatingService

from app.utils.request_helpers import (
    build_gateway_event,
    coerce_bool,
    coerce_int,
    parse_body,
)


log = get_logger("api.items")

router = APIRouter()


# ============================================================================
# GET LIST
# ============================================================================

@router.get(
    "/restaurants/{restaurantId}/items",
    summary="List menu items",
)
async def list_items(
    restaurantId: str,
    tenant_id: Annotated[
        str,
        Depends(get_menu_tenant),
    ],
    svc: Annotated[
        MenuItemService,
        Depends(get_item_service),
    ],
    rating_svc: Annotated[
        RatingService,
        Depends(get_rating_service),
    ],
    cursor: Optional[str] = Query(None),
    categoryId: Optional[str] = Query(None),
):
    items, next_cursor = svc.list(
        tenant_id,
        restaurantId,
        encoded_lek=cursor,
        category_id=categoryId,
    )

    ratings_by_item = rating_svc.get_item_ratings(restaurantId)

    item_dicts = []
    for item in items:
        item_dict = item.to_dict()
        rating_info = ratings_by_item.get(item_dict.get("itemId"))
        item_dict["averageRating"] = (
            rating_info["averageRating"] if rating_info else None
        )
        item_dict["maxRating"] = (
            rating_info["maxRating"] if rating_info else None
        )
        item_dict["ratingCount"] = (
            rating_info["ratingCount"] if rating_info else 0
        )
        item_dicts.append(item_dict)

    return PaginatedResponse(
        items=item_dicts,
        count=len(items),
        lastEvaluatedKey=next_cursor,
    ).to_dict()



# ============================================================================
# GET SINGLE ITEM
# ============================================================================

@router.get(
    "/restaurants/{restaurantId}/items/{itemId}",
    summary="Get a menu item",
)
async def get_item(
    restaurantId: str,
    itemId: str,
    tenant_id: Annotated[
        str,
        Depends(get_menu_tenant),
    ],
    svc: Annotated[
        MenuItemService,
        Depends(get_item_service),
    ],
):
    try:
        item = svc.get(
            tenant_id,
            restaurantId,
            itemId,
        )

        return item.to_dict()

    except MenuItemNotFoundError as exc:
        raise ResourceNotFoundError(
            "MenuItem",
            itemId,
        ) from exc


# ============================================================================
# CREATE ITEM
# ============================================================================

@router.post(
    "/restaurants/{restaurantId}/items",
    status_code=201,
    summary="Create a menu item",
)
async def create_item(
    restaurantId: str,
    request: Request,
    scope: Annotated[
        tuple[UserContext, str],
        Depends(restaurant_write_scope),
    ],
    svc: Annotated[
        MenuItemService,
        Depends(get_item_service),
    ],
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

    # ------------------------------------------------------------------------
    # Normalize primitive values
    # ------------------------------------------------------------------------

    coerce_bool(
        body,
        "isActive",
    )

    coerce_int(
        body,
        "priceMinorUnits",
    )

    coerce_int(
        body,
        "prepTime",
    )

    coerce_int(
        body,
        "calories",
    )

    # ------------------------------------------------------------------------
    # Normalize allergens
    # ------------------------------------------------------------------------

    if (
        "allergens" in body
        and isinstance(body["allergens"], str)
    ):
        raw = body["allergens"].strip()

        body["allergens"] = (
            [
                value.strip().upper()
                for value in raw.split(",")
                if value.strip()
            ]
            if raw
            else []
        )

    try:

        # --------------------------------------------------------------------
        # Category
        # --------------------------------------------------------------------

        category = category_svc.get(
            tenant_id,
            restaurantId,
            body["categoryId"],
        )

        body["categoryName"] = category.name

        # --------------------------------------------------------------------
        # Create DB item
        # --------------------------------------------------------------------

        item = svc.create(
            tenant_id,
            restaurantId,
            body,
        )

        # --------------------------------------------------------------------
        # Upload assets if multipart
        # --------------------------------------------------------------------

        content_type = request.headers.get(
            "content-type",
            "",
        )

        if "multipart/form-data" in content_type:

            try:

                request_body = await request.body()

                raw_event = build_gateway_event(
                    request_body,
                    content_type,
                )

                assets = s3_repo.upload_item_assets(
                    raw_event,
                    restaurantId,
                    item.itemId,
                    tenant_id,
                )

                updates: dict = {}

                # Main image
                if assets.get("imageKey"):

                    updates["imageKey"] = (
                        assets["imageKey"]
                    )

                    item.imageUrl = (
                        assets.get("imageUrl")
                    )

                # AR model
                if assets.get("arModelKey"):

                    updates["arModelKey"] = (
                        assets["arModelKey"]
                    )

                    item.arModelUrl = (
                        assets.get("arModelUrl")
                    )

                # Gallery slides
                if assets.get("slides"):

                    updates["slides"] = [
                        {
                            "position": slide["position"],
                            "imageKey": slide["imageKey"],
                        }
                        for slide in assets["slides"]
                    ]

                # ------------------------------------------------------------
                # Save asset information
                # ------------------------------------------------------------

                if updates:

                    updates["version"] = (
                        item.version
                    )

                    item = svc.update(
                        tenant_id,
                        restaurantId,
                        item.itemId,
                        updates,
                    )

                    if assets.get("imageUrl"):
                        item.imageUrl = (
                            assets["imageUrl"]
                        )

                    if assets.get("arModelUrl"):
                        item.arModelUrl = (
                            assets["arModelUrl"]
                        )

            except Exception as exc:

                log.warning(
                    "item.assets.upload.failed",
                    item_id=item.itemId,
                    exc=str(exc),
                )

        return item.to_dict()

    except ValidationError as exc:

        raise BadRequestError(
            str(exc.errors)
        ) from exc


# ============================================================================
# UPDATE ITEM
# ============================================================================

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
    svc: Annotated[
        MenuItemService,
        Depends(get_item_service),
    ],
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

    # =========================================================================
    # IMPORTANT
    # =========================================================================
    #
    # parse_body() must be called only once.
    #
    # For JSON:
    #     body = normal JSON object
    #
    # For multipart:
    #     body = text fields + JSON fields
    #
    # Asset files are handled separately below.
    # =========================================================================

    body = await parse_body(request)

    # -------------------------------------------------------------------------
    # Normalize primitive values
    # -------------------------------------------------------------------------

    coerce_int(
        body,
        "priceMinorUnits",
    )

    coerce_int(
        body,
        "prepTime",
    )

    coerce_int(
        body,
        "calories",
    )

    coerce_bool(
        body,
        "isActive",
    )

    # -------------------------------------------------------------------------
    # Normalize allergens
    # -------------------------------------------------------------------------

    if (
        "allergens" in body
        and isinstance(body["allergens"], str)
    ):

        raw = body["allergens"].strip()

        body["allergens"] = (
            [
                value.strip().upper()
                for value in raw.split(",")
                if value.strip()
            ]
            if raw
            else []
        )

    # -------------------------------------------------------------------------
    # Normalize slides
    #
    # If frontend sends:
    #
    # "slides": [...]
    #
    # keep it in body so svc.update() persists it.
    #
    # If slides arrive as a JSON string from multipart,
    # decode them.
    # -------------------------------------------------------------------------

    if "slides" in body:

        slides_value = body["slides"]

        if isinstance(
            slides_value,
            str,
        ):

            import json

            try:

                parsed_slides = json.loads(
                    slides_value
                )

                if isinstance(
                    parsed_slides,
                    list,
                ):
                    body["slides"] = parsed_slides

            except Exception:

                log.warning(
                    "item.slides.invalid_json",
                    item_id=itemId,
                )

    try:

        # =====================================================================
        # CATEGORY
        # =====================================================================

        if "categoryId" in body:

            category = category_svc.get(
                tenant_id,
                restaurantId,
                body["categoryId"],
            )

            body["categoryName"] = category.name

        # =====================================================================
        # FIRST: NORMAL DATABASE UPDATE
        # =====================================================================
        #
        # This is important.
        #
        # If the request is normal JSON and contains:
        #
        #     slides: [...]
        #
        # svc.update() now receives those slides.
        #
        # =====================================================================

        item = svc.update(
            tenant_id,
            restaurantId,
            itemId,
            body,
        )

        # =====================================================================
        # MULTIPART ASSETS
        # =====================================================================

        content_type = request.headers.get(
            "content-type",
            "",
        )

        if "multipart/form-data" in content_type:

            try:

                # -------------------------------------------------------------
                # IMPORTANT:
                #
                # request.body() is safe here because parse_body()
                # has already consumed/cached the body in Starlette.
                # -------------------------------------------------------------

                request_body = await request.body()

                raw_event = build_gateway_event(
                    request_body,
                    content_type,
                )

                assets = s3_repo.upload_item_assets(
                    raw_event,
                    restaurantId,
                    itemId,
                    tenant_id,
                )

                asset_updates: dict = {}

                # -------------------------------------------------------------
                # Main image
                # -------------------------------------------------------------

                if assets.get("imageKey"):

                    asset_updates["imageKey"] = (
                        assets["imageKey"]
                    )

                # -------------------------------------------------------------
                # AR model
                # -------------------------------------------------------------

                if assets.get("arModelKey"):

                    asset_updates["arModelKey"] = (
                        assets["arModelKey"]
                    )

                # -------------------------------------------------------------
                # Gallery slides
                # -------------------------------------------------------------

                if assets.get("slides"):

                    asset_updates["slides"] = [
                        {
                            "position": slide["position"],
                            "imageKey": slide["imageKey"],
                        }
                        for slide in assets["slides"]
                    ]

                # -------------------------------------------------------------
                # Save uploaded assets
                # -------------------------------------------------------------

                if asset_updates:

                    # Current version returned by first update
                    # is used for optimistic locking.
                    asset_updates["version"] = (
                        item.version
                    )

                    item = svc.update(
                        tenant_id,
                        restaurantId,
                        itemId,
                        asset_updates,
                    )

                # -------------------------------------------------------------
                # Inject presigned URLs
                # -------------------------------------------------------------

                if assets.get("imageUrl"):

                    item.imageUrl = (
                        assets["imageUrl"]
                    )

                if assets.get("arModelUrl"):

                    item.arModelUrl = (
                        assets["arModelUrl"]
                    )

                # -------------------------------------------------------------
                # IMPORTANT:
                #
                # upload_item_assets() returns slides with imageUrl.
                #
                # svc.update() stores only imageKey.
                #
                # Therefore inject the generated URLs back into response.
                # -------------------------------------------------------------

                if assets.get("slides"):

                    from app.models.menu_item import MenuItemSlide

                    item.slides = [
                        MenuItemSlide(
                            position=slide["position"],
                            imageKey=slide["imageKey"],
                            imageUrl=slide.get(
                                "imageUrl"
                            ),
                        )
                        for slide in assets["slides"]
                    ]

            except Exception as exc:

                log.warning(
                    "item.assets.upload.failed",
                    item_id=itemId,
                    exc=str(exc),
                )

        # =====================================================================
        # RETURN UPDATED ITEM
        # =====================================================================

        return item.to_dict()

    # =========================================================================
    # ERRORS
    # =========================================================================

    except MenuItemNotFoundError as exc:

        raise ResourceNotFoundError(
            "MenuItem",
            itemId,
        ) from exc

    except MenuItemConflictError as exc:

        raise BadRequestError(
            str(exc)
        ) from exc

    except ValidationError as exc:

        raise BadRequestError(
            str(exc.errors)
        ) from exc


# ============================================================================
# DELETE ITEM
# ============================================================================

@router.delete(
    "/restaurants/{restaurantId}/items/{itemId}",
    summary="Delete a menu item",
)
async def delete_item(
    restaurantId: str,
    itemId: str,
    scope: Annotated[
        tuple[UserContext, str],
        Depends(restaurant_write_scope),
    ],
    svc: Annotated[
        MenuItemService,
        Depends(get_item_service),
    ],
):
    user, tenant_id = scope

    try:

        svc.delete(
            tenant_id,
            restaurantId,
            itemId,
        )

        return {
            "message": "Item deleted"
        }

    except MenuItemNotFoundError as exc:

        raise ResourceNotFoundError(
            "MenuItem",
            itemId,
        ) from exc