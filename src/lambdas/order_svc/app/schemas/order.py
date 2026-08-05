"""
app.schemas.order
================
FastAPI-native request/response models for the orders API.

These are the *wire* contracts (validation at the edge). They are distinct
from the domain models in ``app.models.order`` (OrderRequest / OrderRecord /
LineItem) which model the DynamoDB shape and the Step Functions payload.
"""
from __future__ import annotations

from typing import Optional

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# How the guest wants the food. Dine-in is the QR-scan case and stays the
# default, so existing clients that send nothing keep working.
OrderType = Literal["dine_in", "pickup", "delivery"]


class LineItemBody(BaseModel):
    itemId:               str
    name:                 str
    quantity:             int = Field(..., gt=0)
    unitPriceMinorUnits:  int = Field(..., gt=0)
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
    restaurantId:          str
    currencyCode:          str
    lineItems:             list[LineItemBody] = Field(..., min_length=1)
    totalAmountMinorUnits: int = Field(..., gt=0)
    guestConnectionId:     Optional[str] = None

    orderType:             OrderType = "dine_in"

    # Only dine-in has a table. Pickup and delivery leave it empty, so it can
    # no longer be required for every order.
    tableId:               str = ""

    # Delivery needs somewhere to go and a way to call the guest.
    deliveryAddress:       Optional[str] = None
    contactPhone:          Optional[str] = None

    @model_validator(mode="after")
    def validate_order_type(self):
        if self.orderType == "dine_in" and not self.tableId.strip():
            raise ValueError("tableId is required for a dine-in order")

        if self.orderType == "delivery":
            if not (self.deliveryAddress or "").strip():
                raise ValueError("deliveryAddress is required for a delivery order")
            if not (self.contactPhone or "").strip():
                raise ValueError("contactPhone is required for a delivery order")

        return self

    @model_validator(mode="after")
    def validate_total_amount(self):
        computed = sum(i.totalPriceMinorUnits for i in self.lineItems)
        if computed and self.totalAmountMinorUnits != computed:
            raise ValueError(
                f"totalAmountMinorUnits {self.totalAmountMinorUnits} "
                f"!= sum of line items {computed}"
            )
        return self


class UpdateOrderBody(BaseModel):
    kitchenAccepted: bool = False
    foodReady:       bool = False
    delivered:       bool = False
    cancelled:       bool = False