"""
app.api.v1.endpoints.orders
===========================
POST   /orders             → create order (auth: admin/tenant)
GET    /orders             → list orders  (auth: admin/tenant/kitchen)
GET    /orders/{orderId}   → get order    (auth: admin/tenant/kitchen)
PATCH  /orders/{orderId}   → update order (auth: admin/tenant/kitchen)

All order routes require authentication — no public access.
SKIP_MENU env var bypasses menu validation (dev/test only).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from shared.aws_clients import get_dynamodb_client
from shared.cognito_auth import UserContext
from shared.exceptions import BadRequestError, ResourceNotFoundError
from shared.structured_logger import get_logger

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
    LineItem,
    OrderRecord,
    OrderRequest,
    OrderStatusUpdate,
    clean_decimals,
)
from app.repositories.order_repository import DuplicateOrderError, OrderRepository
from app.schemas.order import CreateOrderBody, UpdateOrderBody
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
    tenant_id: Annotated[str,               Depends(get_tenant_id)],
    repo: Annotated[OrderRepository,        Depends(get_order_repo)],
    sfn:  Annotated[StepFunctionsService,   Depends(get_sfn_service)],
    user: Annotated[UserContext | None,     Depends(optional_user)] = None,
):
    order_id = str(uuid.uuid4())
    # tenant comes from X-Tenant-Id (guest has no token); a logged-in
    # staff token, if present, may override with its own tenant claim.
    if user is not None and getattr(user, "tenant_id", None):
        tenant_id = user.tenant_id

    # Build the domain OrderRequest from the wire body + tenant from JWT
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
            )
            for item in body.lineItems
        ],
        totalAmountMinorUnits=body.totalAmountMinorUnits,
        guestConnectionId=body.guestConnectionId,
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

    # Write to DynamoDB
    now = datetime.now(timezone.utc)
    record = OrderRecord.build(request, order_id, execution_arn="PENDING", now=now)

    try:
        repo.write_order(record)
    except DuplicateOrderError:
        raise BadRequestError("Order already exists.")

    # Clear Redis cart (best-effort)
    CartService().clear_cart(tenant_id, body.tableId)

    # Start Step Functions
    try:
        execution_arn = sfn.start_new_order(order_id, request)
    except Exception as exc:  # noqa: BLE001
        repo.rollback_order(record)
        log.error("sfn.start.failed", order_id=order_id, exc_message=str(exc))
        raise BadRequestError(f"Step Functions unavailable: {exc}") from exc

    log.info(
        "order.placed",
        order_id=order_id, tenant_id=tenant_id, restaurant_id=body.restaurantId,
    )

    return {
        "orderId":                   order_id,
        "status":                    "RECEIVED",
        "stepFunctionsExecutionArn": execution_arn,
    }


# ── GET /orders ───────────────────────────────────────────────────────────────

@router.get("", summary="List recent orders for a restaurant")
async def list_orders(
    restaurantId: Annotated[str, Query()],
    tenant_id:    Annotated[str, Depends(get_tenant_id)],
    repo:         Annotated[OrderRepository, Depends(get_order_repo)],
    hours:        Annotated[int, Query(ge=1, le=24)] = 4,
):
    orders = repo.list_orders(restaurantId, tenant_id, hours=hours)
    return {"orders": clean_decimals(orders), "count": len(orders)}


# ── GET /orders/{orderId} ─────────────────────────────────────────────────────

@router.get("/{orderId}", summary="Get a single order by ID")
async def get_order(
    orderId:   str,
    tenant_id: Annotated[str, Depends(get_tenant_id)],
    repo:      Annotated[OrderRepository, Depends(get_order_repo)],
):
    order = repo.get_order(orderId, tenant_id)
    if not order:
        raise ResourceNotFoundError(resource="Order", identifier=orderId)
    return {"order": clean_decimals(dict(order)), "sfnStatus": None}


# ── PATCH /orders/{orderId} ───────────────────────────────────────────────────

@router.patch("/{orderId}", summary="Update order status flags")
async def update_order(
    orderId: str,
    body:    UpdateOrderBody,
    user:    Annotated[UserContext,          Depends(require_kitchen_or_admin)],
    tenant_id: Annotated[str,                Depends(get_tenant_id)],
    repo:    Annotated[OrderRepository,      Depends(get_order_repo)],
    sfn:     Annotated[StepFunctionsService, Depends(get_sfn_service)],
):
    order = repo.get_order(orderId, tenant_id)
    if not order:
        raise ResourceNotFoundError(resource="Order", identifier=orderId)

    update = OrderStatusUpdate(
        tenantId=tenant_id,
        kitchenAccepted=body.kitchenAccepted,
        foodReady=body.foodReady,
        delivered=body.delivered,
        cancelled=body.cancelled,
    )
    new_status = update.derived_status

    # Update DynamoDB (critical)
    try:
        repo.update_status(orderId, tenant_id, new_status)
        log.info("order.status.updated", order_id=orderId, status=new_status)
    except Exception as exc:  # noqa: BLE001
        log.warning("order.status.update.failed", order_id=orderId, exc_message=str(exc))

    # Start SFN for notifications (non-fatal)
    exec_name = f"{orderId}-{int(datetime.now(timezone.utc).timestamp())}"
    execution_arn = sfn.start_status_update(orderId, order, update, exec_name)

    data = {
        "orderId": orderId,
        "status":  new_status,
        "flags": {
            "kitchenAccepted": body.kitchenAccepted,
            "foodReady":       body.foodReady,
            "delivered":       body.delivered,
            "cancelled":       body.cancelled,
        },
    }
    if execution_arn:
        data["executionArn"] = execution_arn

    return data