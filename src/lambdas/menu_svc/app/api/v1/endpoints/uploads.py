"""
app.api.v1.endpoints.uploads
============================
POST /menus/presigned-url                                   → admin/tenant
POST /menus/upload/restaurants/{rid}/categories/{cid}/image → admin/tenant
POST /menus/upload/restaurants/{rid}/items/{iid}/assets     → admin/tenant

Every upload returns `{s3Key, url}`. The caller then saves that key onto the
record with a PUT — uploading and attaching are deliberately two steps, so a
half-finished upload never leaves a dangling reference on the entity.

The repository methods need the tenant as well as the restaurant, because S3
keys are namespaced per tenant. That is why each handler resolves the scope
first rather than passing the path parameters straight through.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError

from app.core.dependencies import (
    get_s3_repo,
    get_s3_service,
    require_restaurant_manager,
    resolve_write_tenant,
    restaurant_write_scope,
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


def _result(s3_key, url, message: str) -> dict:
    """
    Uniform response for every upload.

    The repository returns a (key, url) pair; when no file was present in the
    request both are None, which is a 400 rather than a silent success — a
    caller that meant to upload something deserves to hear that nothing was.
    """
    if not s3_key:
        raise BadRequestError("No file found in the request.")
    return {"s3Key": s3_key, "url": url, "message": message}


# ══════════════════════════════════════════════════════════════════════════════
# Presigned URL
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/presigned-url", summary="Generate a presigned S3 upload URL")
async def presigned_url(
    request: Request,
    user:    Annotated[UserContext, Depends(require_restaurant_manager)],
    svc:     Annotated[S3Service,   Depends(get_s3_service)],
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-Id")] = None,
):
    """
    No restaurant in the path, so the restaurant-scoped guard does not apply
    here — the role check plus the caller's own tenant is what governs it.
    """
    resolve_write_tenant(user, x_tenant_id)   # raises if the tenant is wrong
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
    "/upload/restaurants/{restaurantId}/categories/{categoryId}/image",
    summary="Upload category image",
)
async def upload_category_image(
    restaurantId: str,
    categoryId:   str,
    request:      Request,
    scope:        Annotated[tuple[UserContext, str], Depends(restaurant_write_scope)],
    s3_repo:      Annotated[S3Repository, Depends(get_s3_repo)],
):
    _, tenant_id = scope
    raw_event = await _gateway_event(request)
    try:
        s3_key, url = s3_repo.upload_category_image(
            raw_event, restaurantId, categoryId, tenant_id
        )
        return _result(s3_key, url, "Image uploaded. Save s3Key to the category via PUT.")
    except _UPLOAD_ERRORS as exc:
        raise BadRequestError(str(exc)) from exc


@router.post(
    "/upload/restaurants/{restaurantId}/items/{itemId}/assets",
    summary="Upload item image and/or AR model",
)
async def upload_item_assets(
    restaurantId: str,
    itemId:       str,
    request:      Request,
    scope:        Annotated[tuple[UserContext, str], Depends(restaurant_write_scope)],
    s3_repo:      Annotated[S3Repository, Depends(get_s3_repo)],
):
    """
    One request can carry both an image (form field `file`) and an AR model
    (field `arFile`) — the menu editor sends them together, so splitting them
    into two endpoints would mean two round trips for one save.
    """
    _, tenant_id = scope
    raw_event = await _gateway_event(request)
    try:
        result = s3_repo.upload_item_assets(raw_event, restaurantId, itemId, tenant_id)
        if not result:
            raise BadRequestError("No file found in the request.")
        return {**result, "message": "Uploaded. Save the keys to the item via PUT."}
    except _UPLOAD_ERRORS as exc:
        raise BadRequestError(str(exc)) from exc