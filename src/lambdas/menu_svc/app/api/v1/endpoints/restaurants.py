"""
app.api.v1.endpoints.restaurants
================================
GET    /menus/restaurants                → public
GET    /menus/restaurants/{id}           → public
POST   /menus/restaurants                → admin/tenant
PUT    /menus/restaurants/{id}           → admin/tenant
DELETE /menus/restaurants/{id}           → admin/tenant
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ResourceNotFoundError
from shared.structured_logger import get_logger

from app.core.dependencies import (
    get_menu_tenant,
    get_restaurant_service,
    get_s3_repo,
    require_admin_or_tenant,
)
from app.models.base import ValidationError
from app.repositories.s3_repository import S3Repository
from app.schemas.common import PaginatedResponse
from app.services.restaurant_service import RestaurantNotFoundError, RestaurantService
from app.utils.request_helpers import build_gateway_event, parse_body

log = get_logger("api.restaurants")
router = APIRouter()


@router.get("/restaurants", summary="List all restaurants for a tenant")
async def list_restaurants(
    tenant_id: Annotated[str,               Depends(get_menu_tenant)],
    svc:       Annotated[RestaurantService, Depends(get_restaurant_service)],
    cursor:    Optional[str] = Query(None),
):
    restaurants, next_cursor = svc.list_all(tenant_id, encoded_lek=cursor)
    return PaginatedResponse(
        items=[r.to_dict() for r in restaurants],
        count=len(restaurants),
        lastEvaluatedKey=next_cursor,
    ).to_dict()


@router.get("/restaurants/{restaurantId}", summary="Get a single restaurant")
async def get_restaurant(
    restaurantId: str,
    tenant_id:    Annotated[str,               Depends(get_menu_tenant)],
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
):
    try:
        return svc.get(tenant_id, restaurantId).to_dict()
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc


@router.post("/restaurants", status_code=201, summary="Create a restaurant")
async def create_restaurant(
    request: Request,
    user:    Annotated[UserContext,       Depends(require_admin_or_tenant)],
    svc:     Annotated[RestaurantService, Depends(get_restaurant_service)],
    s3_repo: Annotated[S3Repository,      Depends(get_s3_repo)],
):
    body = await parse_body(request)
    try:
        restaurant = svc.create(user.tenant_id, body)
        # Handle multipart logo upload
        ct = request.headers.get("content-type", "")
        if "multipart/form-data" in ct:
            try:
                raw_event = build_gateway_event(await request.body(), ct)
                s3_key, logo_url = s3_repo.upload_restaurant_logo(
                    raw_event, restaurant.restaurantId, user.tenant_id,
                )
                if s3_key:
                    restaurant = svc.update(
                        user.tenant_id, restaurant.restaurantId, {"logoKey": s3_key}
                    )
                    restaurant.logoUrl = logo_url
            except Exception as exc:
                log.warning(
                    "logo.upload.failed",
                    restaurant_id=restaurant.restaurantId, exc=str(exc),
                )
        return restaurant.to_dict()
    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc


@router.put("/restaurants/{restaurantId}", summary="Update a restaurant")
async def update_restaurant(
    restaurantId: str,
    request:      Request,
    user:         Annotated[UserContext,       Depends(require_admin_or_tenant)],
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
):
    body = await parse_body(request)
    try:
        return svc.update(user.tenant_id, restaurantId, body).to_dict()
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc
    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc


@router.delete("/restaurants/{restaurantId}", summary="Delete a restaurant")
async def delete_restaurant(
    restaurantId: str,
    user:         Annotated[UserContext,       Depends(require_admin_or_tenant)],
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
):
    try:
        svc.delete(user.tenant_id, restaurantId)
        return {"message": "Restaurant deleted"}
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc
