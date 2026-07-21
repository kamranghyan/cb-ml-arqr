"""
app.api.v1.endpoints.categories
===============================
GET    /menus/restaurants/{rid}/categories        → public
GET    /menus/restaurants/{rid}/categories/{cid}  → public
POST   /menus/restaurants/{rid}/categories        → admin/tenant
PUT    /menus/restaurants/{rid}/categories/{cid}  → admin/tenant
DELETE /menus/restaurants/{rid}/categories/{cid}  → admin/tenant
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ResourceNotFoundError
from shared.structured_logger import get_logger

from app.core.dependencies import (
    get_category_service,
    get_menu_tenant,
    get_s3_repo,
    require_admin_or_tenant,
)
from app.models.base import ValidationError
from app.repositories.s3_repository import S3Repository
from app.schemas.common import PaginatedResponse
from app.services.category_service import CategoryNotFoundError, CategoryService
from app.utils.request_helpers import (
    build_gateway_event,
    coerce_bool,
    coerce_int,
    parse_body,
)

log = get_logger("api.categories")
router = APIRouter()


@router.get("/restaurants/{restaurantId}/categories", summary="List categories")
async def list_categories(
    restaurantId: str,
    tenant_id:    Annotated[str,             Depends(get_menu_tenant)],
    svc:          Annotated[CategoryService, Depends(get_category_service)],
    cursor:       Optional[str] = Query(None),
):
    cats, next_cursor = svc.list(tenant_id, restaurantId, encoded_lek=cursor)
    return PaginatedResponse(
        items=[c.to_dict() for c in cats],
        count=len(cats),
        lastEvaluatedKey=next_cursor,
    ).to_dict()


@router.get(
    "/restaurants/{restaurantId}/categories/{categoryId}",
    summary="Get a category",
)
async def get_category(
    restaurantId: str,
    categoryId:   str,
    tenant_id:    Annotated[str,             Depends(get_menu_tenant)],
    svc:          Annotated[CategoryService, Depends(get_category_service)],
):
    try:
        return svc.get(tenant_id, restaurantId, categoryId).to_dict()
    except CategoryNotFoundError as exc:
        raise ResourceNotFoundError("Category", categoryId) from exc


@router.post(
    "/restaurants/{restaurantId}/categories",
    status_code=201,
    summary="Create a category",
)
async def create_category(
    restaurantId: str,
    request:      Request,
    user:         Annotated[UserContext,     Depends(require_admin_or_tenant)],
    svc:          Annotated[CategoryService, Depends(get_category_service)],
    s3_repo:      Annotated[S3Repository,    Depends(get_s3_repo)],
):
    body = await parse_body(request)
    coerce_bool(body, "isActive")
    coerce_int(body, "displayOrder")
    try:
        cat = svc.create(user.tenant_id, restaurantId, body)
        ct = request.headers.get("content-type", "")
        if "multipart/form-data" in ct:
            try:
                raw_event = build_gateway_event(await request.body(), ct)
                s3_key, image_url = s3_repo.upload_category_image(
                    raw_event, restaurantId, cat.categoryId, user.tenant_id,
                )
                if s3_key:
                    cat = svc.update(
                        user.tenant_id, restaurantId, cat.categoryId,
                        {"imageKey": s3_key},
                    )
                    cat.imageUrl = image_url
            except Exception as exc:
                log.warning(
                    "category.image.upload.failed",
                    category_id=cat.categoryId, exc=str(exc),
                )
        return cat.to_dict()
    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc


@router.put(
    "/restaurants/{restaurantId}/categories/{categoryId}",
    summary="Update a category",
)
async def update_category(
    restaurantId: str,
    categoryId:   str,
    request:      Request,
    user:         Annotated[UserContext,     Depends(require_admin_or_tenant)],
    svc:          Annotated[CategoryService, Depends(get_category_service)],
):
    body = await parse_body(request)
    try:
        return svc.update(user.tenant_id, restaurantId, categoryId, body).to_dict()
    except CategoryNotFoundError as exc:
        raise ResourceNotFoundError("Category", categoryId) from exc


@router.delete(
    "/restaurants/{restaurantId}/categories/{categoryId}",
    summary="Delete a category",
)
async def delete_category(
    restaurantId: str,
    categoryId:   str,
    user:         Annotated[UserContext,     Depends(require_admin_or_tenant)],
    svc:          Annotated[CategoryService, Depends(get_category_service)],
):
    try:
        svc.delete(user.tenant_id, restaurantId, categoryId)
        return {"message": "Category deleted"}
    except CategoryNotFoundError as exc:
        raise ResourceNotFoundError("Category", categoryId) from exc
