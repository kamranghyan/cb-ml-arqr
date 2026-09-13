"""
app.api.v1.endpoints.restaurants
================================
Who may do what
---------------
GET    /menus/restaurants        public read (guest menu) — X-Tenant-Id header
                                 logged in: scoped to the caller's role
GET    /menus/restaurants/{id}   public read
POST   /menus/restaurants        tenant owner (own tenant, plan limit applies)
                                 platform admin may act for a tenant by passing
                                 tenantId in the body (support override)
PUT    /menus/restaurants/{id}   tenant owner | restaurant admin (own branch)
DELETE /menus/restaurants/{id}   tenant owner only (admin as support override)
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request

from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ForbiddenError, ResourceNotFoundError
from shared.structured_logger import get_logger

from app.core.dependencies import (
    assert_restaurant_scope,
    get_menu_tenant,
    get_menu_tenant_optional,
    get_restaurant_service,
    get_s3_repo,
    get_tenant_limits,
    optional_user,
    require_restaurant_manager,
    require_tenant_owner,
    resolve_write_tenant,
)
from app.models.base import ValidationError
from app.repositories.s3_repository import S3Repository
from app.schemas.common import PaginatedResponse
from app.services.restaurant_service import RestaurantNotFoundError, RestaurantService
from app.services.tenant_limits import TenantLimits
from app.utils.request_helpers import build_gateway_event, parse_body

log = get_logger("api.restaurants")
router = APIRouter()

# Instead of having the same upload logic copied into: create_restaurant() and update_restaurant() we will use this helper function to handle the multipart request and update the restaurant with the uploaded images.

async def _attach_images(
    request: Request,
    restaurant_id: str,
    tenant_id: str,
    svc: RestaurantService,
    s3_repo: S3Repository,
):
    """
    Upload logo/banner from a multipart request and update the restaurant.
    """
    ct = request.headers.get("content-type", "")
    if "multipart/form-data" not in ct:
        return None

    raw_event = build_gateway_event(await request.body(), ct)

    images = s3_repo.upload_restaurant_images(
        raw_event,
        restaurant_id,
        tenant_id,
    )

    if not images:
        return None

    update_body = {}

    if images.get("logoKey"):
        update_body["logoKey"] = images["logoKey"]

    if images.get("bannerKey"):
        update_body["bannerKey"] = images["bannerKey"]

    if not update_body:
        return None

    restaurant = svc.update(
        tenant_id,
        restaurant_id,
        update_body,
    )

    restaurant.logoUrl = images.get("logoUrl")
    restaurant.bannerUrl = images.get("bannerUrl")

    return restaurant

# ── Reads ─────────────────────────────────────────────────────────────

@router.get("/restaurants", summary="List restaurants visible to the caller")
async def list_restaurants(
    tenant_id: Annotated[str,               Depends(get_menu_tenant)],
    svc:       Annotated[RestaurantService, Depends(get_restaurant_service)],
    user:      Annotated[Optional[UserContext], Depends(optional_user)] = None,
    cursor:    Optional[str] = Query(None),
):
    """
    platform admin   → every restaurant
    tenant owner     → all restaurants of its tenant
    restaurant admin
    kitchen staff    → only the branch it is bound to
    guest (no token) → the tenant in the X-Tenant-Id header
    """
    if user and user.is_admin():
        restaurants, next_cursor = svc.list_all("", encoded_lek=cursor)
    else:
        scope = user.tenant_id if (user and user.tenant_id) else tenant_id
        restaurants, next_cursor = svc.list_all(scope, encoded_lek=cursor)

        # Branch-bound users see only their own restaurant.
        if user and user.is_staff() and user.restaurant_id:
            restaurants = [
                r for r in restaurants if r.restaurantId == user.restaurant_id
            ]

    return PaginatedResponse(
        items=[r.to_dict() for r in restaurants],
        count=len(restaurants),
        lastEvaluatedKey=next_cursor,
    ).to_dict()


@router.get(
    "/public/restaurants/{restaurantId}",
    summary="Public restaurant lookup (used by the guest QR flow)",
)
async def public_restaurant(
    restaurantId: str,
    svc: Annotated[RestaurantService, Depends(get_restaurant_service)],
):
    """
    Open endpoint — no token, no X-Tenant-Id.

    A guest scans a QR code that carries only ?rid=…&tid=…, so the app needs a
    way to turn that id into the branch and the tenant it belongs to. Returns
    just enough to render a menu; nothing private.
    """
    try:
        restaurant = svc.get("", restaurantId)
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc

    if not restaurant.isActive:
        raise ResourceNotFoundError("Restaurant", restaurantId)

    return {
        "restaurantId": restaurant.restaurantId,
        "tenantId":     restaurant.tenantId,
        "name":         restaurant.name,
        "currencyCode": restaurant.currencyCode,
        "timezone":     restaurant.timezone,
        "logoUrl":      restaurant.logoUrl,
        "address":      restaurant.address.to_dict() if restaurant.address else None,
    }


@router.get("/restaurants/{restaurantId}", summary="Get a single restaurant")
async def get_restaurant(
    restaurantId: str,
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
    tenant_id:    Annotated[str, Depends(get_menu_tenant_optional)] = "",
):
    """
    Public. A guest scanning a QR code has only the restaurant id, so the
    tenant header is optional here — the response tells them which tenant the
    branch belongs to, which the rest of the guest flow then sends along.
    """
    try:
        return svc.get(tenant_id, restaurantId).to_dict()
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc


# ── Writes ────────────────────────────────────────────────────────────

@router.post("/restaurants", status_code=201, summary="Create a restaurant")
async def create_restaurant(
    request: Request,
    user:    Annotated[UserContext,       Depends(require_tenant_owner)],
    svc:     Annotated[RestaurantService, Depends(get_restaurant_service)],
    limits:  Annotated[TenantLimits,      Depends(get_tenant_limits)],
    s3_repo: Annotated[S3Repository,      Depends(get_s3_repo)],
):
    body = await parse_body(request)

    # Whose restaurant is this? (admin must say; a tenant gets its own)
    tenant_id = resolve_write_tenant(user, body.get("tenantId"))

    # Subscription check before anything is written.
    limits.assert_can_add_restaurant(tenant_id)

    try:
        restaurant = svc.create(tenant_id, body)
    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc

    limits.adjust_count(tenant_id, +1)

    restaurant = (
        await _attach_images(
            request,
            restaurant.restaurantId,
            tenant_id,
            svc,
            s3_repo,
        )
        or restaurant
    )

    if user.is_admin():
        log.info("restaurant.created.by_admin",
                 admin=user.email, tenant_id=tenant_id,
                 restaurant_id=restaurant.restaurantId)

    return restaurant.to_dict()


@router.put("/restaurants/{restaurantId}", summary="Update a restaurant")
async def update_restaurant(
    restaurantId: str,
    request:      Request,
    user:         Annotated[UserContext,       Depends(require_restaurant_manager)],
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
    s3_repo:      Annotated[S3Repository,      Depends(get_s3_repo)],
):
    body = await parse_body(request)
    tenant_id = resolve_write_tenant(user, body.get("tenantId"))

    # A restaurant admin may only touch its own branch.
    assert_restaurant_scope(user, restaurantId)

    # And the restaurant must actually belong to that tenant.
    try:
        existing = svc.get(tenant_id, restaurantId)
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc

    if existing.tenantId and existing.tenantId != tenant_id:
        raise ForbiddenError("This restaurant belongs to another tenant.")

    try:
        restaurant = svc.update(tenant_id, restaurantId, body)

        restaurant = (
            await _attach_images(
                request,
                restaurant.restaurantId,
                tenant_id,
                svc,
                s3_repo,
            )
            or restaurant
        )

        return restaurant.to_dict() 
    
    except ValidationError as exc:
        raise BadRequestError(str(exc.errors)) from exc


@router.delete("/restaurants/{restaurantId}", summary="Delete a restaurant")
async def delete_restaurant(
    restaurantId: str,
    user:         Annotated[UserContext,       Depends(require_tenant_owner)],
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
    limits:       Annotated[TenantLimits,      Depends(get_tenant_limits)],
    tenantId:     Optional[str] = Query(None),
):
    tenant_id = resolve_write_tenant(user, tenantId)

    try:
        existing = svc.get(tenant_id, restaurantId)
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc

    if existing.tenantId and existing.tenantId != tenant_id:
        raise ForbiddenError("This restaurant belongs to another tenant.")

    svc.delete(tenant_id, restaurantId)
    limits.adjust_count(tenant_id, -1)

    if user.is_admin():
        log.info("restaurant.deleted.by_admin",
                 admin=user.email, tenant_id=tenant_id, restaurant_id=restaurantId)

    return {"message": "Restaurant deleted"}

@router.post(
    "/restaurants/{restaurantId}/zones",
    status_code=201,
    summary="Create a dining-table zone (e.g. 'Main Hall', 'Rooftop')",
)
async def create_zone(
    restaurantId: str,
    request:      Request,
    user:         Annotated[UserContext,       Depends(require_restaurant_manager)],
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
):
    body = await parse_body(request)
    tenant_id = resolve_write_tenant(user, body.get("tenantId"))
    assert_restaurant_scope(user, restaurantId)

    try:
        existing = svc.get(tenant_id, restaurantId)
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc

    if existing.tenantId and existing.tenantId != tenant_id:
        raise ForbiddenError("This restaurant belongs to another tenant.")

    restaurant = svc.add_zone(tenant_id, restaurantId, body)
    return restaurant.to_dict()


@router.put(
    "/restaurants/{restaurantId}/zones/{zoneId}",
    summary="Rename a zone or change its outlet",
)
async def update_zone(
    restaurantId: str,
    zoneId:       str,
    request:      Request,
    user:         Annotated[UserContext,       Depends(require_restaurant_manager)],
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
):
    body = await parse_body(request)
    tenant_id = resolve_write_tenant(user, body.get("tenantId"))
    assert_restaurant_scope(user, restaurantId)

    try:
        existing = svc.get(tenant_id, restaurantId)
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc

    if existing.tenantId and existing.tenantId != tenant_id:
        raise ForbiddenError("This restaurant belongs to another tenant.")

    restaurant = svc.update_zone(tenant_id, restaurantId, zoneId, body)
    return restaurant.to_dict()


@router.delete(
    "/restaurants/{restaurantId}/zones/{zoneId}",
    summary="Delete a zone",
)
async def delete_zone(
    restaurantId: str,
    zoneId:       str,
    user:         Annotated[UserContext,       Depends(require_restaurant_manager)],
    svc:          Annotated[RestaurantService, Depends(get_restaurant_service)],
    tenantId:     Optional[str] = Query(None),
):
    tenant_id = resolve_write_tenant(user, tenantId)
    assert_restaurant_scope(user, restaurantId)

    try:
        existing = svc.get(tenant_id, restaurantId)
    except RestaurantNotFoundError as exc:
        raise ResourceNotFoundError("Restaurant", restaurantId) from exc

    if existing.tenantId and existing.tenantId != tenant_id:
        raise ForbiddenError("This restaurant belongs to another tenant.")

    restaurant = svc.delete_zone(tenant_id, restaurantId, zoneId)
    return restaurant.to_dict()