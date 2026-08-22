"""
app/services/menu_validator.py
=================================
Validates order line items against ItemTable in DynamoDB.

Migrated from the single-table layout (MenuTable, PK/SK) to the normalized
ItemTable, whose key is just `itemId`.

Because itemId is now a global key (no restaurant in the key), each fetched
item is additionally checked to belong to the requested restaurant — this
prevents ordering an item from a different restaurant by guessing its id.

Uses BatchGetItem — one request for all items in the order.
"""

from __future__ import annotations

from typing import List

from boto3.dynamodb.types import TypeDeserializer

from app.models.order import LineItem
from shared.exceptions import ValidationError
from shared.structured_logger import get_logger

_log          = get_logger("orders.menu-validator")
_deserializer = TypeDeserializer()


class MenuValidationError(ValidationError):
    """Raised when one or more line items fail menu validation."""
    error_code  = "MENU_VALIDATION_FAILED"
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
    if not line_items:
        return

    # 1. Base item IDs AUR Add-on IDs dono ko collect karein
    unique_ids = set()
    for item in line_items:
        unique_ids.add(item.itemId)
        # Agar LineItem model me addons ki list hai:
        if hasattr(item, "addons") and item.addons:
            for addon in item.addons:
                # Assuming addon object has addonId / itemId
                addon_id = getattr(addon, "itemId", getattr(addon, "addonId", None))
                if addon_id:
                    unique_ids.add(addon_id)

    keys = [{"itemId": {"S": item_id}} for item_id in unique_ids]

    response = dynamodb_client.batch_get_item(
        RequestItems={item_table: {"Keys": keys}}
    )

    fetched = {}
    for raw in response.get("Responses", {}).get(item_table, []):
        record = _deserialize(raw)
        fetched[record["itemId"]] = record

    errors: list[str] = []

    # 2. Main Items AUR unke Add-ons dono ko validate karein
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
                f"Item {item.itemId!r} price mismatch: "
                f"expected {menu_price}, got {item.unitPriceMinorUnits}"
            )

        # 3. Add-ons ki validation loop
        if hasattr(item, "addons") and item.addons:
            for addon in item.addons:
                addon_id = getattr(addon, "itemId", getattr(addon, "addonId", None))
                addon_item = fetched.get(addon_id)
                if not addon_item:
                    errors.append(f"Addon {addon_id!r} not found in menu")
                elif addon_item.get("restaurantId") != restaurant_id:
                    errors.append(f"Addon {addon_id!r} does not belong to this restaurant")
                elif not addon_item.get("isActive", False):
                    errors.append(f"Addon {addon_id!r} is currently unavailable")

    if errors:
        _log.warning(
            "menu.validation.failed",
            restaurant_id=restaurant_id,
            errors=errors,
        )
        raise MenuValidationError("; ".join(errors))

    _log.info(
        "menu.validation.passed",
        restaurant_id=restaurant_id,
        item_count=len(line_items),
    )