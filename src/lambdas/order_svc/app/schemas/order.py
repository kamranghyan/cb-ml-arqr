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

from pydantic import BaseModel, Field, field_validator, model_validator


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
    tableId:               str
    currencyCode:          str
    lineItems:             list[LineItemBody] = Field(..., min_length=1)
    totalAmountMinorUnits: int = Field(..., gt=0)
    guestConnectionId:     Optional[str] = None

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
