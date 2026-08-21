"""
app/services/menu_validator.py
=================================
Validates order line items AND their add-ons against ItemTable in DynamoDB.
"""
from __future__ import annotations

from typing import List

from boto3.dynamodb.types import TypeDeserializer

# from app.models.order import LineItem
from app.models.order import AddOn, LineItem, OrderRecord
from shared.exceptions import ValidationError
from shared.structured_logger import get_logger

_log = get_logger("orders.menu-validator")
_deserializer = TypeDeserializer()


class MenuValidationError(ValidationError):
    error_code = "MENU_VALIDATION_FAILED"
    http_status = 422


def _deserialize(raw: dict) -> dict:
    return {k: _deserializer.deserialize(v) for k, v in raw.items()}


def validate_menu_items(
    dynamodb_client,
    item_table: str,
    tenant_id: str,
    restaurant_id: str,
    line_items: List[LineItem],
) -> None:
    """
    Validate all line items AND their add-ons against ItemTable.
    """
    if not line_items:
        return

    # ── Validate main items ──
    unique_ids = list({item.itemId for item in line_items})
    keys = [{"itemId": {"S": item_id}} for item_id in unique_ids]

    response = dynamodb_client.batch_get_item(
        RequestItems={item_table: {"Keys": keys}}
    )

    fetched = {}
    for raw in response.get("Responses", {}).get(item_table, []):
        record = _deserialize(raw)
        fetched[record["itemId"]] = record

    errors: list[str] = []

    for item in line_items:
        menu_item = fetched.get(item.itemId)

        if not menu_item:
            errors.append(f"Item {item.itemId!r} not found in menu")
            continue

        if menu_item.get("restaurantId") != restaurant_id:
            errors.append(f"Item {item.itemId!r} does not belong to this restaurant")
            continue

        if not menu_item.get("isActive", False):
            errors.append(f"Item {item.itemId!r} is currently unavailable")
            continue

        menu_price = int(menu_item.get("priceMinorUnits", 0))
        if menu_price != item.unitPriceMinorUnits:
            errors.append(
                f"Item {item.itemId!r} price mismatch: expected {menu_price}, got {item.unitPriceMinorUnits}"
            )

        # ✅ Validate add-ons
        if item.addOns:
            addon_ids = [a.addOnId for a in item.addOns]
            addon_keys = [{"itemId": {"S": addon_id}} for addon_id in addon_ids]
            
            addon_response = dynamodb_client.batch_get_item(
                RequestItems={item_table: {"Keys": addon_keys}}
            )
            
            addon_fetched = {}
            for raw in addon_response.get("Responses", {}).get(item_table, []):
                record = _deserialize(raw)
                addon_fetched[record["itemId"]] = record
            
            expected_addons_total = 0
            
            for addon in item.addOns:
                addon_item = addon_fetched.get(addon.addOnId)
                
                if not addon_item:
                    errors.append(f"Add-on {addon.addOnId!r} not found in menu")
                    continue
                
                if addon_item.get("restaurantId") != restaurant_id:
                    errors.append(f"Add-on {addon.addOnId!r} does not belong to this restaurant")
                    continue
                
                if not addon_item.get("isActive", False):
                    errors.append(f"Add-on {addon.addOnId!r} is currently unavailable")
                    continue
                
                addon_price = int(addon_item.get("priceMinorUnits", 0))
                if addon_price != addon.priceMinorUnits:
                    errors.append(
                        f"Add-on {addon.addOnId!r} price mismatch: "
                        f"expected {addon_price}, got {addon.priceMinorUnits}"
                    )
                
                expected_addons_total += addon_price * addon.quantity
            
            # ✅ Verify add-ons total
            if item.addOnsTotalMinorUnits != expected_addons_total:
                errors.append(
                    f"Item {item.itemId!r} add-ons total mismatch: "
                    f"expected {expected_addons_total}, got {item.addOnsTotalMinorUnits}"
                )

    if errors:
        _log.warning("menu.validation.failed", restaurant_id=restaurant_id, errors=errors)
        raise MenuValidationError("; ".join(errors))

    _log.info("menu.validation.passed", restaurant_id=restaurant_id, item_count=len(line_items))