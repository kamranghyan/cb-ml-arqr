"""
app/services/channels/sfn_service.py
=======================================
StepFunctionsService — starts and manages order workflow executions.
"""
from __future__ import annotations

import json
from typing import Any

from botocore.exceptions import ClientError

from app.models.order import OrderRequest, OrderStatusUpdate, clean_decimals
from shared.structured_logger import get_logger

_log = get_logger("orders.sfn")


class StepFunctionsService:
    def __init__(self, sfn_client: Any, state_machine_arn: str):
        self._sfn = sfn_client
        self._arn = state_machine_arn

    def start_new_order(self, order_id: str, request: OrderRequest) -> str:
        payload = {
            "orderId": order_id,
            "tenantId": request.tenantId,
            "restaurantId": request.restaurantId,
            "tableId": request.tableId,
            "orderType": request.orderType,
            "customerName": request.customerName,
            "contactPhone": request.contactPhone,
            "pickupTime": request.pickupTime,
            "deliveryAddress": request.deliveryAddress,
            "deliveryFeeMinorUnits": request.deliveryFeeMinorUnits,
            "totalAmountMinorUnits": request.totalAmountMinorUnits,
            "currencyCode": request.currencyCode,
            "lineItems": [
                {
                    **item.model_dump(),
                    "addOns": [addon.model_dump() for addon in item.addOns],  # ✅ NEW
                    "addOnsTotalMinorUnits": item.addOnsTotalMinorUnits,      # ✅ NEW
                }
                for item in request.lineItems
            ],
            "guestConnectionId": request.guestConnectionId,
            "guestSessionId": request.guestSessionId,
            "kitchenAccepted": False,
            "foodReady": False,
            "delivered": False,
            "cancelled": False,
        }

        resp = self._sfn.start_execution(
            stateMachineArn=self._arn,
            name=order_id,
            input=json.dumps(payload),
        )
        execution_arn = resp["executionArn"]
        _log.info(
            "sfn.execution.started",
            order_id=order_id,
            execution_arn=execution_arn,
        )
        return execution_arn

    def start_status_update(
        self,
        order_id: str,
        order: dict,
        update: OrderStatusUpdate,
        exec_name: str,
    ) -> str:
        # ✅ Add-ons in SFN payload for status update
        line_items = clean_decimals(order.get("lineItems", []))
        
        sfn_input = {
            "orderId": order_id,
            "tenantId": update.tenantId,
            "restaurantId": order.get("restaurantId", ""),
            "tableId": order.get("tableId", ""),
            "totalAmountMinorUnits": int(order.get("totalAmountMinorUnits", 0)),
            "currencyCode": order.get("currencyCode", "PKR"),
            "lineItems": [
                {
                    **item,
                    "addOns": item.get("addOns", []),           # ✅ NEW
                    "addOnsTotalMinorUnits": item.get("addOnsTotalMinorUnits", 0),  # ✅ NEW
                }
                for item in line_items
            ],
            "guestConnectionId": order.get("guestConnectionId"),
            "guestSessionId": order.get("guestSessionId"),
            "kitchenAccepted": update.kitchenAccepted,
            "foodReady": update.foodReady,
            "delivered": update.delivered,
            "cancelled": update.cancelled,
            "orderType": order.get("orderType", "dine_in"),
            "customerName": order.get("customerName"),
            "pickupTime": order.get("pickupTime"),
            "deliveryAddress": order.get("deliveryAddress"),
            "contactPhone": order.get("contactPhone"),
            "deliveryFeeMinorUnits": int(order.get("deliveryFeeMinorUnits", 0)),
        }

        try:
            resp = self._sfn.start_execution(
                stateMachineArn=self._arn,
                name=exec_name,
                input=json.dumps(sfn_input),
            )
            execution_arn = resp["executionArn"]
            _log.info(
                "sfn.status_update.started",
                order_id=order_id,
                execution_arn=execution_arn,
            )
            return execution_arn
        except ClientError as exc:
            _log.warning(
                "sfn.status_update.failed",
                order_id=order_id,
                error_code=exc.response["Error"]["Code"],
                exc_message=str(exc),
            )
            return ""