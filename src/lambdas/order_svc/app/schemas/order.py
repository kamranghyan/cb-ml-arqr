"""
app.schemas.order
================
FastAPI-native request/response models for the orders API.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


OrderType = Literal["dine_in", "pickup", "delivery"]


class LineItemBody(BaseModel):
    itemId: str
    name: str
    quantity: int = Field(..., gt=0)
    unitPriceMinorUnits: int = Field(..., gt=0)
    totalPriceMinorUnits: int = Field(..., gt=0)

    @field_validator("totalPriceMinorUnits")
    @classmethod
    def validate_total(cls, v, info):
        data = info.data
        qty = data.get("quantity")
        unit = data.get("unitPriceMinorUnits")

        if qty and unit and v != qty * unit:
            raise ValueError(
                f"totalPriceMinorUnits {v} != quantity({qty}) * unitPrice({unit})"
            )

        return v


class CreateOrderBody(BaseModel):
    restaurantId: str
    currencyCode: str

    lineItems: list[LineItemBody] = Field(..., min_length=1)

    totalAmountMinorUnits: int = Field(..., gt=0)

    guestConnectionId: Optional[str] = None

    # dine_in | pickup | delivery
    orderType: OrderType = "dine_in"

    # Required only for dine-in
    tableId: str = ""

    # Customer information
    customerName: Optional[str] = None
    contactPhone: Optional[str] = None

    # Pickup
    pickupTime: Optional[str] = None

    # Delivery
    deliveryAddress: Optional[str] = None
    deliveryFeeMinorUnits: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_order_type(self):

        # ── DINE-IN ─────────────────────────────────────────────
        if self.orderType == "dine_in":
            if not self.tableId.strip():
                raise ValueError(
                    "tableId is required for a dine-in order"
                )

        # ── PICKUP ──────────────────────────────────────────────
        elif self.orderType == "pickup":
            if not (self.customerName or "").strip():
                raise ValueError(
                    "customerName is required for a pickup order"
                )

            if not (self.contactPhone or "").strip():
                raise ValueError(
                    "contactPhone is required for a pickup order"
                )

            if not (self.pickupTime or "").strip():
                raise ValueError(
                    "pickupTime is required for a pickup order"
                )

        # ── DELIVERY ────────────────────────────────────────────
        elif self.orderType == "delivery":
            if not (self.deliveryAddress or "").strip():
                raise ValueError(
                    "deliveryAddress is required for a delivery order"
                )

            if not (self.contactPhone or "").strip():
                raise ValueError(
                    "contactPhone is required for a delivery order"
                )

        return self

    @model_validator(mode="after")
    def validate_total_amount(self):
        """
        Customer total must include delivery fee.

        Example:
        items = 1000
        delivery fee = 200
        total = 1200
        """

        items_total = sum(
            item.totalPriceMinorUnits
            for item in self.lineItems
        )

        expected_total = (
            items_total + self.deliveryFeeMinorUnits
        )

        if self.totalAmountMinorUnits != expected_total:
            raise ValueError(
                f"totalAmountMinorUnits {self.totalAmountMinorUnits} "
                f"!= items total({items_total}) "
                f"+ delivery fee({self.deliveryFeeMinorUnits})"
            )

        return self


class UpdateOrderBody(BaseModel):
    kitchenAccepted: bool = False
    foodReady: bool = False
    delivered: bool = False
    cancelled: bool = False