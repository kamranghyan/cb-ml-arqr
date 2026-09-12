"""
app.api.v1.endpoints.orders
===========================
POST   /orders             → create order (auth: admin/tenant)
GET    /orders             → list orders  (auth: admin/tenant/kitchen)
GET    /orders/{orderId}   → get order    (auth: admin/tenant/kitchen)
PATCH  /orders/{orderId}   → update order (auth: admin/tenant/kitchen)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from app.services.dining_table_lookup import get_table_info
from shared.aws_clients import get_dynamodb_client
from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ResourceNotFoundError
from shared.structured_logger import get_logger
from app.schemas.order import CreateOrderBody, UpdateOrderBody, GuestCancelOrderBody, GuestFeedbackBody
from app.core.config import get_settings
from app.core.dependencies import (
    get_order_repo,
    get_sfn_service,
    require_admin_or_tenant,
    require_kitchen_or_admin,
    optional_user,
    require_any_auth,
    get_tenant_id,
)
from app.models.order import (
    AddOn,
    LineItem,
    OrderRecord,
    OrderRequest,
    OrderStatusUpdate,
    clean_decimals,
)
from app.repositories.order_repository import DuplicateOrderError, OrderRepository
from app.schemas.order import CreateOrderBody, UpdateOrderBody, GuestCancelOrderBody
from app.services.channels.cart_service import CartService
from app.services.channels.sfn_service import StepFunctionsService
from app.services.menu_validator import MenuValidationError, validate_menu_items

log = get_logger("api.orders")
router = APIRouter()

_settings = get_settings()


# ── POST /orders ──────────────────────────────────────────────────────────────

@router.post("", status_code=201, summary="Create a new order")
async def create_order(
    body: CreateOrderBody,
    tenant_id: Annotated[str,              Depends(get_tenant_id)],
    repo: Annotated[OrderRepository,        Depends(get_order_repo)],
    sfn:  Annotated[StepFunctionsService,   Depends(get_sfn_service)],
    user: Annotated[UserContext | None,     Depends(optional_user)] = None,
):
    order_id = str(uuid.uuid4())
    if user is not None and getattr(user, "tenant_id", None):
        tenant_id = user.tenant_id

    request = OrderRequest(
        tenantId=tenant_id,
        restaurantId=body.restaurantId,
        tableId=body.tableId,
        currencyCode=body.currencyCode,
        lineItems=[
            LineItem(
                itemId=item.itemId,
                name=item.name,
                quantity=item.quantity,
                unitPriceMinorUnits=item.unitPriceMinorUnits,
                totalPriceMinorUnits=item.totalPriceMinorUnits,
                addOns=[
                    AddOn(
                        addOnId=addon.addOnId,
                        name=addon.name,
                        quantity=addon.quantity,
                        priceMinorUnits=addon.priceMinorUnits
                    )
                    for addon in (item.addOns or [])
                ],
                addOnsTotalMinorUnits=item.addOnsTotalMinorUnits or 0,
            )
            for item in body.lineItems
        ],
        totalAmountMinorUnits=body.totalAmountMinorUnits,
        guestConnectionId=body.guestConnectionId,
        guestSessionId=body.guestSessionId,
        orderType=body.orderType,
        customerName=body.customerName,
        pickupTime=body.pickupTime,
        deliveryAddress=body.deliveryAddress,
        contactPhone=body.contactPhone,
        deliveryFeeMinorUnits=body.deliveryFeeMinorUnits,
    )

    # Menu validation (skippable in dev/test)
    if not _settings.skip_menu_validation:
        try:
            validate_menu_items(
                get_dynamodb_client(), _settings.item_table,
                tenant_id, request.restaurantId, request.lineItems,
            )
        except MenuValidationError as exc:
            raise BadRequestError(exc.message) from exc

    # Resolve the human-readable table number (e.g. "T-144") and zone
    # once, at creation time, so every later read (GET /orders, KDS,
    # dashboards) gets both for free without a cross-service join.
    # Best-effort — a lookup failure never blocks placing the order.
    table_info = get_table_info(body.tableId) if body.tableId else None
    table_number = table_info.get("tableNumber") if table_info else None
    zone = table_info.get("zone") if table_info else None

    # Write to DynamoDB
    now = datetime.now(timezone.utc)
    record = OrderRecord.build(
        request, order_id, execution_arn="PENDING", now=now,
        table_number=table_number, zone=zone,
    )

    try:
        repo.write_order(record)
    except DuplicateOrderError:
        raise BadRequestError("Order already exists.")

    if body.tableId:
        CartService().clear_cart(tenant_id, body.tableId)

    try:
        execution_arn = sfn.start_new_order(order_id, request)
    except Exception as exc:
        repo.rollback_order(record)
        log.error("sfn.start.failed", order_id=order_id, exc_message=str(exc))
        raise BadRequestError(f"Step Functions unavailable: {exc}") from exc

    log.info(
        "order.placed",
        order_id=order_id, tenant_id=tenant_id, restaurant_id=body.restaurantId,
        order_type=body.orderType,
    )

    return {
        "orderId": order_id,
        "status": "RECEIVED",
        "stepFunctionsExecutionArn": execution_arn,
    }

# ── GET /orders ───────────────────────────────────────────────────────────────

@router.get("", summary="List recent orders for a restaurant")
async def list_orders(
    restaurantId: Annotated[str, Query()],
    tenantId:     Annotated[str, Depends(get_tenant_id)],
    repo:         Annotated[OrderRepository, Depends(get_order_repo)],
    hours:        Annotated[Optional[int], Query(ge=1, le=720)] = None, # ✅ Default None (bina hours filter ke query karega)
):
    orders = repo.list_orders(restaurantId, tenantId, hours=hours)
    
    # ✅ Process each order to ensure add-ons are included properly
    processed_orders = []
    for order in orders:
        processed_order = clean_decimals(order)
        if "lineItems" in processed_order:
            for item in processed_order["lineItems"]:
                if "addOns" not in item:
                    item["addOns"] = []
                if "addOnsTotalMinorUnits" not in item:
                    item["addOnsTotalMinorUnits"] = 0
        processed_orders.append(processed_order)
    
    return {"orders": processed_orders, "count": len(processed_orders)}


# ── GET /{orderId}/guest, for guest notifications ─────────────────────────────────────────────────────

@router.get("/{orderId}/guest", summary="Get a guest's own order")
async def get_guest_order(
    orderId: str,
    guestSessionId: Annotated[str, Query(min_length=1)],
    tenantId: Annotated[str, Depends(get_tenant_id)],
    repo: Annotated[OrderRepository, Depends(get_order_repo)],
):
    order = repo.get_order_for_guest(
        order_id=orderId,
        tenant_id=tenantId,
        guest_session_id=guestSessionId,
    )

    if not order:
        raise ResourceNotFoundError(
            resource="Order",
            identifier=orderId,
        )

    processed_order = clean_decimals(dict(order))

    if "lineItems" in processed_order:
        for item in processed_order["lineItems"]:
            if "addOns" not in item:
                item["addOns"] = []
            if "addOnsTotalMinorUnits" not in item:
                item["addOnsTotalMinorUnits"] = 0

    return {
        "order": processed_order,
        "sfnStatus": None,
    }


# ── PATCH /{orderId}/guest — guest cancels their own order ────────────────────

@router.patch("/{orderId}/guest", summary="Guest cancels their own order")
async def guest_cancel_order(
    orderId: str,
    body: GuestCancelOrderBody,
    tenantId: Annotated[str, Depends(get_tenant_id)],
    repo: Annotated[OrderRepository, Depends(get_order_repo)],
    sfn: Annotated[StepFunctionsService, Depends(get_sfn_service)],
):
    """
    Lets a guest cancel their own order — no Cognito auth, since guests
    never have a staff token. Ownership is proven by guestSessionId
    matching the order (same check used by GET /{orderId}/guest), so a
    guest can never cancel someone else's order. This can only cancel —
    it cannot kitchen-accept, mark ready, or deliver.
    """
    order = repo.get_order_for_guest(
        order_id=orderId,
        tenant_id=tenantId,
        guest_session_id=body.guestSessionId,
    )

    if not order:
        raise ResourceNotFoundError(resource="Order", identifier=orderId)

    current_status = (order.get("status") or "").upper()
    if current_status in {"CANCELLED", "DELIVERED", "COMPLETED"}:
        raise BadRequestError(
            f"Order cannot be cancelled from status {current_status}."
        )

    update = OrderStatusUpdate(
        tenantId=tenantId,
        cancelled=True,
        cancellationReason=body.cancellationReason,
    )
    new_status = update.derived_status  # "CANCELLED"

    repo.update_status(
        orderId,
        tenantId,
        new_status,
        cancellation_reason=body.cancellationReason,
    )
    log.info(
        "order.guest_cancelled",
        order_id=orderId,
        guest_session_id=body.guestSessionId,
    )

    exec_name = f"{orderId}-{int(datetime.now(timezone.utc).timestamp())}"
    execution_arn = sfn.start_status_update(orderId, order, update, exec_name)

    data = {
        "orderId": orderId,
        "status": new_status,
        "cancellationReason": body.cancellationReason,
    }
    if execution_arn:
        data["executionArn"] = execution_arn

    return data
# ── POST /{orderId}/feedback — guest leaves a rating/feedback ────────────────
#
# No staff auth here, same pattern as the guest cancel endpoint. Ownership is
# proven by guestSessionId matching the order record.

@router.post("/{orderId}/feedback", summary="Guest leaves a rating/feedback on their own order")
async def guest_add_feedback(
    orderId: str,
    body: GuestFeedbackBody,
    tenantId: Annotated[str, Depends(get_tenant_id)],
    repo: Annotated[OrderRepository, Depends(get_order_repo)],
):
    order = repo.get_order_for_guest(
        order_id=orderId,
        tenant_id=tenantId,
        guest_session_id=body.guestSessionId,
    )

    if not order:
        raise ResourceNotFoundError(resource="Order", identifier=orderId)

    repo.add_feedback(
        order_id=orderId,
        tenant_id=tenantId,
        rating=body.rating,
        feedback_text=body.feedbackText,
    )

    log.info(
        "order.guest_feedback",
        order_id=orderId,
        guest_session_id=body.guestSessionId,
        rating=body.rating,
    )

    return {
        "orderId": orderId,
        "rating": body.rating,
        "feedbackText": body.feedbackText,
    }


# ── GET /orders/{orderId} ─────────────────────────────────────────────────────

@router.get("/{orderId}", summary="Get a single order by ID")
async def get_order(
    orderId:   str,
    tenantId: Annotated[str, Depends(get_tenant_id)],
    repo:      Annotated[OrderRepository, Depends(get_order_repo)],
):
    order = repo.get_order(orderId, tenantId)
    if not order:
        raise ResourceNotFoundError(resource="Order", identifier=orderId)
    
    processed_order = clean_decimals(dict(order))
    if "lineItems" in processed_order:
        for item in processed_order["lineItems"]:
            if "addOns" not in item:
                item["addOns"] = []
            if "addOnsTotalMinorUnits" not in item:
                item["addOnsTotalMinorUnits"] = 0
    
    return {"order": processed_order, "sfnStatus": None}


# ── PATCH /orders/{orderId} ───────────────────────────────────────────────────

@router.patch("/{orderId}", summary="Update order status flags")
async def update_order(
    orderId: str,
    body:    UpdateOrderBody,
    user:    Annotated[UserContext,          Depends(require_kitchen_or_admin)],
    tenantId: Annotated[str,                 Depends(get_tenant_id)],
    repo:    Annotated[OrderRepository,      Depends(get_order_repo)],
    sfn:     Annotated[StepFunctionsService, Depends(get_sfn_service)],
):
    order = repo.get_order(orderId, tenantId)
    if not order:
        raise ResourceNotFoundError(resource="Order", identifier=orderId)

    update = OrderStatusUpdate(
        tenantId=tenantId,
        kitchenAccepted=body.kitchenAccepted,
        foodReady=body.foodReady,
        delivered=body.delivered,
        cancelled=body.cancelled,
        cancellationReason=body.cancellationReason,
    )
    new_status = update.derived_status

    try:
        repo.update_status(
            orderId,
            tenantId,
            new_status,
            cancellation_reason=update.cancellationReason if update.cancelled else None,
        )
        log.info("order.status.updated", order_id=orderId, status=new_status)
    except Exception as exc:
        log.warning("order.status.update.failed", order_id=orderId, exc_message=str(exc))

    exec_name = f"{orderId}-{int(datetime.now(timezone.utc).timestamp())}"
    execution_arn = sfn.start_status_update(orderId, order, update, exec_name)

    data = {
        "orderId": orderId,
        "status":  new_status,
        "flags": {
            "kitchenAccepted": body.kitchenAccepted,
            "foodReady": body.foodReady,
            "delivered": body.delivered,
            "cancelled": body.cancelled,
        },
    }
    if body.cancelled:
        data["cancellationReason"] = body.cancellationReason
    if execution_arn:
        data["executionArn"] = execution_arn

    return data


# ── PATCH /orders/{orderId}/guest — guest cancels their own order ─────────────
#
# No staff auth here. Ownership is proven by guestSessionId matching the
# order record (same check used by GET /{orderId}/guest). This endpoint can
# ONLY cancel — it cannot accept/ready/deliver, so a guest can never move
# their own order to any state but CANCELLED.

@router.patch("/{orderId}/guest", summary="Guest cancels their own order")
async def guest_cancel_order(
    orderId: str,
    body:    GuestCancelOrderBody,
    tenantId: Annotated[str,                 Depends(get_tenant_id)],
    repo:    Annotated[OrderRepository,      Depends(get_order_repo)],
    sfn:     Annotated[StepFunctionsService, Depends(get_sfn_service)],
):
    order = repo.get_order_for_guest(
        order_id=orderId,
        tenant_id=tenantId,
        guest_session_id=body.guestSessionId,
    )
    if not order:
        raise ResourceNotFoundError(resource="Order", identifier=orderId)

    current_status = (order.get("status") or "").upper()
    if current_status in {"CANCELLED", "DELIVERED", "COMPLETED", "TIMED_OUT"}:
        raise BadRequestError(
            f"Order cannot be cancelled from status {current_status}."
        )

    update = OrderStatusUpdate(
        tenantId=tenantId,
        cancelled=True,
        cancellationReason=body.cancellationReason,
    )
    new_status = update.derived_status

    try:
        repo.update_status(
            orderId,
            tenantId,
            new_status,
            cancellation_reason=body.cancellationReason,
        )
        log.info("order.status.updated", order_id=orderId, status=new_status)
    except Exception as exc:
        log.warning("order.status.update.failed", order_id=orderId, exc_message=str(exc))

    exec_name = f"{orderId}-{int(datetime.now(timezone.utc).timestamp())}"
    execution_arn = sfn.start_status_update(orderId, order, update, exec_name)

    data = {
        "orderId": orderId,
        "status": new_status,
        "cancellationReason": body.cancellationReason,
    }
    if execution_arn:
        data["executionArn"] = execution_arn

    return data