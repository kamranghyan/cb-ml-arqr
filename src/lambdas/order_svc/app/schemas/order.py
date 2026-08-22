"""
app.schemas.order
================
FastAPI-native request/response models for the orders API.
"""
from __future__ import annotations

from typing import Literal, Optional, List

from pydantic import BaseModel, Field, field_validator, model_validator


OrderType = Literal["dine_in", "pickup", "delivery"]


# ✅ NEW: AddOn Schema
class AddOnBody(BaseModel):
    addOnId: str
    name: str
    quantity: int = Field(..., gt=0)
    priceMinorUnits: int = Field(..., gt=0)


# ✅ UPDATE: LineItemBody mein addOns fields add karein
class LineItemBody(BaseModel):
    itemId: str
    name: str
    quantity: int = Field(..., gt=0)
    unitPriceMinorUnits: int = Field(..., gt=0)
    totalPriceMinorUnits: int = Field(..., gt=0)
    addOns: List[AddOnBody] = []  
    addOnsTotalMinorUnits: int = 0

    @field_validator("totalPriceMinorUnits")
    @classmethod
    def validate_total(cls, v, info):
        data = info.data
        qty = data.get("quantity")
        unit = data.get("unitPriceMinorUnits")
        addons_total = data.get("addOnsTotalMinorUnits", 0)
        
        if qty and unit:
            expected = (unit + addons_total) * qty
            if v != expected:
                raise ValueError(
                    f"totalPriceMinorUnits {v} != (unitPrice({unit}) + addOns({addons_total})) * quantity({qty}) = {expected}"
                )
        return v


class CreateOrderBody(BaseModel):
    restaurantId: str
    currencyCode: str
    lineItems: list[LineItemBody] = Field(..., min_length=1)
    totalAmountMinorUnits: int = Field(..., gt=0)
    guestConnectionId: Optional[str] = None
    orderType: OrderType = "dine_in"
    tableId: str = ""
    customerName: Optional[str] = None
    contactPhone: Optional[str] = None
    pickupTime: Optional[str] = None
    deliveryAddress: Optional[str] = None
    deliveryFeeMinorUnits: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_order_type(self):
        # ... existing validation (no change)
        if self.orderType == "dine_in":
            if not self.tableId.strip():
                raise ValueError("tableId is required for a dine-in order")
        elif self.orderType == "pickup":
            if not (self.customerName or "").strip():
                raise ValueError("customerName is required for a pickup order")
            if not (self.contactPhone or "").strip():
                raise ValueError("contactPhone is required for a pickup order")
            if not (self.pickupTime or "").strip():
                raise ValueError("pickupTime is required for a pickup order")
        elif self.orderType == "delivery":
            if not (self.deliveryAddress or "").strip():
                raise ValueError("deliveryAddress is required for a delivery order")
            if not (self.contactPhone or "").strip():
                raise ValueError("contactPhone is required for a delivery order")
        return self

    @model_validator(mode="after")
    def validate_total_amount(self):
        items_total = sum(
            item.totalPriceMinorUnits
            for item in self.lineItems
        )
        expected_total = items_total + self.deliveryFeeMinorUnits
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