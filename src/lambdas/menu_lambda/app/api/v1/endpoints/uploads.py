"""
app.api.v1.endpoints.uploads
============================
POST /menus/presigned-url                                          → admin/tenant
POST /menus/upload/restaurants/{rid}/logo                          → admin/tenant
POST /menus/upload/restaurants/{rid}/categories/{cid}/image        → admin/tenant
POST /menus/upload/restaurants/{rid}/items/{iid}/image             → admin/tenant
POST /menus/upload/restaurants/{rid}/items/{iid}/ar-model          → admin/tenant
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError

from app.core.dependencies import (
    get_s3_repo,
    get_s3_service,
    require_admin_or_tenant,
)
from app.models.base import ValidationError
from app.repositories.s3_repository import (
    FileTooLargeError,
    InvalidContentTypeError,
    MissingFieldError,
    MissingFileError,
    S3Repository,
)
from app.schemas.common import PresignedUrlRequest
from app.services.s3_service import S3Service
from app.utils.request_helpers import build_gateway_event, parse_body

router = APIRouter()

_UPLOAD_ERRORS = (
    MissingFileError, MissingFieldError, InvalidContentTypeError, FileTooLargeError,
)


# ══════════════════════════════════════════════════════════════════════════════
# Presigned URL
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/presigned-url", summary="Generate a presigned S3 upload URL")
async def presigned_url(
    request: Request,
    user:    Annotated[UserContext, Depends(require_admin_or_tenant)],
    svc:     Annotated[S3Service,   Depends(get_s3_service)],
):
    body = await parse_body(request)
    try:
        req = PresignedUrlRequest.from_dict(body)
        return svc.generate_presigned_url(req)
    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc


# ══════════════════════════════════════════════════════════════════════════════
# Direct multipart uploads
# ══════════════════════════════════════════════════════════════════════════════

async def _gateway_event(request: Request) -> dict:
    return build_gateway_event(
        await request.body(), request.headers.get("content-type", "")
    )


@router.post(
    "/upload/restaurants/{restaurantId}/logo",
    summary="Upload restaurant logo",
)
async def upload_logo(
    restaurantId: str,
    request:      Request,
    user:         Annotated[UserContext,  Depends(require_admin_or_tenant)],
    s3_repo:      Annotated[S3Repository, Depends(get_s3_repo)],
):
    raw_event = await _gateway_event(request)
    try:
        result = s3_repo.upload_restaurant_logo(raw_event, restaurantId)
        return {**result, "message": "Logo uploaded. Save s3Key to restaurant via PUT."}
    except _UPLOAD_ERRORS as exc:
        raise BadRequestError(str(exc)) from exc


@router.post(
    "/upload/restaurants/{restaurantId}/categories/{categoryId}/image",
    summary="Upload category image",
)
async def upload_category_image(
    restaurantId: str,
    categoryId:   str,
    request:      Request,
    user:         Annotated[UserContext,  Depends(require_admin_or_tenant)],
    s3_repo:      Annotated[S3Repository, Depends(get_s3_repo)],
):
    raw_event = await _gateway_event(request)
    try:
        result = s3_repo.upload_category_image(raw_event, restaurantId, categoryId)
        return {**result, "message": "Image uploaded. Save s3Key to category via PUT."}
    except _UPLOAD_ERRORS as exc:
        raise BadRequestError(str(exc)) from exc


@router.post(
    "/upload/restaurants/{restaurantId}/items/{itemId}/image",
    summary="Upload item image",
)
async def upload_item_image(
    restaurantId: str,
    itemId:       str,
    request:      Request,
    user:         Annotated[UserContext,  Depends(require_admin_or_tenant)],
    s3_repo:      Annotated[S3Repository, Depends(get_s3_repo)],
):
    raw_event = await _gateway_event(request)
    try:
        result = s3_repo.upload_item_image(raw_event, restaurantId, itemId)
        return {**result, "message": "Image uploaded. Save s3Key to item via PUT."}
    except _UPLOAD_ERRORS as exc:
        raise BadRequestError(str(exc)) from exc


@router.post(
    "/upload/restaurants/{restaurantId}/items/{itemId}/ar-model",
    summary="Upload item AR model",
)
async def upload_item_ar_model(
    restaurantId: str,
    itemId:       str,
    request:      Request,
    user:         Annotated[UserContext,  Depends(require_admin_or_tenant)],
    s3_repo:      Annotated[S3Repository, Depends(get_s3_repo)],
):
    raw_event = await _gateway_event(request)
    try:
        result = s3_repo.upload_item_ar_model(raw_event, restaurantId, itemId)
        return {**result, "message": "AR model uploaded. Save s3Key to item via PUT."}
    except _UPLOAD_ERRORS as exc:
        raise BadRequestError(str(exc)) from exc
