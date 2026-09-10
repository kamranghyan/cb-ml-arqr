"""app/models/order.py"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class AddOn(BaseModel):
    addOnId: str
    name: str
    quantity: int = Field(..., gt=0)
    priceMinorUnits: int = Field(..., gt=0)


class LineItem(BaseModel):
    itemId: str
    name: str
    quantity: int = Field(..., gt=0)
    unitPriceMinorUnits: int = Field(..., gt=0)
    totalPriceMinorUnits: int = Field(..., gt=0)
    addOns: List[AddOn] = []  
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


class OrderRequest(BaseModel):
    tenantId: str
    restaurantId: str
    tableId: str = ""
    currencyCode: str
    lineItems: List[LineItem] = Field(..., min_length=1)
    totalAmountMinorUnits: int = Field(..., gt=0)
    guestConnectionId: Optional[str] = None
    guestSessionId: Optional[str] = None  # Added as requested
    orderType: str = "dine_in"
    deliveryAddress: Optional[str] = None
    contactPhone: Optional[str] = None
    customerName: Optional[str] = None
    pickupTime: Optional[str] = None
    deliveryFeeMinorUnits: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_total_amount(self):
        items_total = sum(item.totalPriceMinorUnits for item in self.lineItems)
        expected_total = items_total + self.deliveryFeeMinorUnits
        if self.totalAmountMinorUnits != expected_total:
            raise ValueError(
                f"totalAmountMinorUnits {self.totalAmountMinorUnits} "
                f"!= items total({items_total}) + delivery fee({self.deliveryFeeMinorUnits})"
            )
        return self


class OrderStatusUpdate(BaseModel):
    tenantId: str
    kitchenAccepted: bool = False
    foodReady: bool = False
    delivered: bool = False
    cancelled: bool = False

    @property
    def derived_status(self) -> str:
        if self.cancelled:       return "CANCELLED"
        if self.delivered:       return "DELIVERED"
        if self.foodReady:       return "READY"
        if self.kitchenAccepted: return "PREPARING"
        return "RECEIVED"


class OrderRecord(BaseModel):
    PK: str
    SK: str
    orderId: str
    tenantId: str
    restaurantId: str
    tableId: str
    status: str
    lineItems: List[dict]
    totalAmountMinorUnits: int
    currencyCode: str
    stepFunctionsExecutionArn: str
    guestConnectionId: Optional[str] = None
    guestSessionId: Optional[str] = None  # Added as requested
    orderType: str = "dine_in"
    deliveryAddress: Optional[str] = None
    contactPhone: Optional[str] = None
    customerName: Optional[str] = None
    pickupTime: Optional[str] = None
    deliveryFeeMinorUnits: int = 0
    placedAt: str
    updatedAt: str
    ttl: int

    @classmethod
    def build(cls, request: OrderRequest, order_id: str, execution_arn: str, now: datetime) -> "OrderRecord":
        placed_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        ttl = int((now + timedelta(days=90)).timestamp())
        
        line_items_dict = []

        for item in request.lineItems:
           item_dict = {
             "itemId": item.itemId,
             "name": item.name,
             "quantity": item.quantity,
             "unitPriceMinorUnits": item.unitPriceMinorUnits,
             "totalPriceMinorUnits": item.totalPriceMinorUnits,
             "addOns": [addon.model_dump() for addon in item.addOns] if item.addOns else [],
             "addOnsTotalMinorUnits": item.addOnsTotalMinorUnits or 0,
          }
           line_items_dict.append(item_dict)
        
        return cls(
            PK=f"TENANT#{request.tenantId}#ORDER#{order_id}",
            SK=f"STATUS#{placed_at}",
            orderId=order_id,
            tenantId=request.tenantId,
            restaurantId=request.restaurantId,
            tableId=request.tableId,
            customerName=request.customerName,
            pickupTime=request.pickupTime,
            status="RECEIVED",
            lineItems=line_items_dict,
            totalAmountMinorUnits=request.totalAmountMinorUnits,
            deliveryFeeMinorUnits=request.deliveryFeeMinorUnits,
            currencyCode=request.currencyCode,
            stepFunctionsExecutionArn=execution_arn,
            guestConnectionId=request.guestConnectionId,
            guestSessionId=request.guestSessionId,  # Passed through from request
            orderType=request.orderType,
            deliveryAddress=request.deliveryAddress,
            contactPhone=request.contactPhone,
            placedAt=placed_at,
            updatedAt=placed_at,
            ttl=ttl,
        )

    def to_dynamo_item(self) -> dict:
        return {k: v for k, v in self.model_dump().items() if v is not None}


def clean_decimals(obj):
    if isinstance(obj, list):
        return [clean_decimals(i) for i in obj]
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            if k == "lineItems" and isinstance(v, list):
                result[k] = clean_line_items(v)
            else:
                result[k] = clean_decimals(v)
        return result
    if isinstance(obj, Decimal):
        return int(obj)
    return obj


def clean_line_items(items):
    """Clean line items and preserve add-ons structure."""
    cleaned = []
    for item in items:
        cleaned_item = clean_decimals(item)
        if isinstance(cleaned_item, dict):
            if "addOns" not in cleaned_item:
                cleaned_item["addOns"] = []
            if "addOnsTotalMinorUnits" not in cleaned_item:
                cleaned_item["addOnsTotalMinorUnits"] = 0
        cleaned.append(cleaned_item)
    return cleaned


def to_dynamo_types(obj: dict) -> dict:
    result = {}
    for k, v in obj.items():
        if isinstance(v, float):
            result[k] = Decimal(str(v))
        elif isinstance(v, list):
            # ✅ Ensure list items are also converted
            result[k] = [to_dynamo_types(i) if isinstance(i, dict) else i for i in v]
        elif isinstance(v, dict):
            result[k] = to_dynamo_types(v)
        else:
            result[k] = v
    return result