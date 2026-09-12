"""
app.services.dining_table_lookup
=================================
Best-effort lookup of a dining table's human-readable details
(tableNumber, zone) from its tableId, at order-creation time.

Reads DiningTable-dev directly (menu_svc's table), read-only. Order
creation must never fail just because this lookup has a hiccup — any
error is logged and swallowed, and the order is written without these
fields (same as before this feature existed).
"""
from __future__ import annotations

from typing import Optional, TypedDict

from shared.aws_clients import get_dynamodb_resource
from shared.structured_logger import get_logger

from app.core.config import get_settings

log = get_logger("orders.dining_table_lookup")


class TableInfo(TypedDict, total=False):
    tableNumber: str
    zone: str


def get_table_info(table_id: str) -> Optional[TableInfo]:
    if not table_id:
        return None

    settings = get_settings()

    try:
        resource = get_dynamodb_resource()
        table = resource.Table(settings.dining_table)
        resp = table.get_item(Key={"tableId": table_id})
        item = resp.get("Item")

        if not item:
            return None

        return TableInfo(
            tableNumber=item.get("tableNumber"),
            zone=item.get("zone"),
        )

    except Exception as exc:  # noqa: BLE001
        log.warning(
            "dining_table.lookup.failed",
            table_id=table_id,
            error=str(exc),
        )
        return None