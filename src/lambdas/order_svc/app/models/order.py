"""
app/models/order.py
=========================
Pydantic v2 domain models for the Orders service.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator, field_validator


class LineItem(BaseModel):
    itemId:               str
    name:                 str
    quantity:             int = Field(..., gt=0)
    unitPriceMinorUnits:  int = Field(..., gt=0)
    totalPriceMinorUnits: int = Field(..., gt=0)

    @field_validator("totalPriceMinorUnits")
    @classmethod
    def validate_total(cls, v, info):
        data = info.data
        qty  = data.get("quantity")
        unit = data.get("unitPriceMinorUnits")
        if qty and unit and v != qty * unit:
            raise ValueError(f"totalPriceMinorUnits {v} != quantity({qty}) * unitPrice({unit})")
        return v


class OrderRequest(BaseModel):
    tenantId:              str
    restaurantId:          str
    tableId:               str
    currencyCode:          str
    lineItems:             List[LineItem] = Field(..., min_length=1)
    totalAmountMinorUnits: int = Field(..., gt=0)
    guestConnectionId:     Optional[str] = None

    @model_validator(mode="after")
    def validate_total_amount(self):
        computed = sum(i.totalPriceMinorUnits for i in self.lineItems)
        if self.totalAmountMinorUnits != computed:
            raise ValueError(
                f"totalAmountMinorUnits {self.totalAmountMinorUnits} != sum of line items {computed}"
            )
        return self


class OrderStatusUpdate(BaseModel):
    tenantId:        str
    kitchenAccepted: bool = False
    foodReady:       bool = False
    delivered:       bool = False
    cancelled:       bool = False

    @property
    def derived_status(self) -> str:
        if self.cancelled:       return "CANCELLED"
        if self.delivered:       return "DELIVERED"
        if self.foodReady:       return "READY"
        if self.kitchenAccepted: return "PREPARING"
        return "RECEIVED"


class OrderRecord(BaseModel):
    PK:                        str
    SK:                        str
    orderId:                   str
    tenantId:                  str
    restaurantId:              str
    tableId:                   str
    status:                    str
    lineItems:                 List[dict]
    totalAmountMinorUnits:     int
    currencyCode:              str
    stepFunctionsExecutionArn: str
    guestConnectionId:         Optional[str] = None
    placedAt:                  str
    updatedAt:                 str
    ttl:                       int

    @classmethod
    def build(cls, request: OrderRequest, order_id: str, execution_arn: str, now: datetime) -> "OrderRecord":
        placed_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        ttl       = int((now + timedelta(days=90)).timestamp())
        return cls(
            PK=f"TENANT#{request.tenantId}#ORDER#{order_id}",
            SK=f"STATUS#{placed_at}",
            orderId=order_id,
            tenantId=request.tenantId,
            restaurantId=request.restaurantId,
            tableId=request.tableId,
            status="RECEIVED",
            lineItems=[item.model_dump() for item in request.lineItems],
            totalAmountMinorUnits=request.totalAmountMinorUnits,
            currencyCode=request.currencyCode,
            stepFunctionsExecutionArn=execution_arn,
            guestConnectionId=request.guestConnectionId,
            placedAt=placed_at,
            updatedAt=placed_at,
            ttl=ttl,
        )

    def to_dynamo_item(self) -> dict:
        return {k: v for k, v in self.model_dump().items() if v is not None}


def clean_decimals(obj):
    if isinstance(obj, list):    return [clean_decimals(i) for i in obj]
    if isinstance(obj, dict):    return {k: clean_decimals(v) for k, v in obj.items()}
    if isinstance(obj, Decimal): return int(obj)
    return obj


def to_dynamo_types(obj: dict) -> dict:
    result = {}
    for k, v in obj.items():
        if isinstance(v, float):
            result[k] = Decimal(str(v))
        elif isinstance(v, list):
            result[k] = [to_dynamo_types(i) if isinstance(i, dict) else i for i in v]
        elif isinstance(v, dict):
            result[k] = to_dynamo_types(v)
        else:
            result[k] = v
    return result
