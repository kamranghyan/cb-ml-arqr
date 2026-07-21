"""
app.services.table_service
==========================
Restaurant Table/Floor CRUD — proper service layer.

Ported from the legacy ``menu/handlers/table_handler.py``:
instead of returning API Gateway response dicts, this service returns
plain data and raises ``shared.exceptions`` errors, which the global
FastAPI exception handlers translate to HTTP responses.

DynamoDB schema:
  PK: TENANT#{tenantId}#RESTAURANT#{restaurantId}
  SK: TABLE#{tableId}
"""
from __future__ import annotations

import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from shared.exceptions import BadRequestError, ResourceNotFoundError, StorageError

from app.utils.dynamo_helpers import decimal_to_python, build_update_expression
from app.utils.ids import new_id, utc_now
from app.utils.logger import get_logger

log = get_logger(__name__)

_ALLOWED_UPDATE_FIELDS = {"tableNumber", "zone", "outlet", "capacity", "isActive"}


class TableService:
    """CRUD for restaurant tables. One instance per Lambda container."""

    def __init__(self, table_name: str | None = None, dynamodb=None):
        self._table_name = table_name or os.environ.get(
            "TABLE_RESTAURANT_TABLES", "RestaurantTables-dev"
        )
        ddb = dynamodb or boto3.resource("dynamodb")
        self._table = ddb.Table(self._table_name)

    # ── Queries ───────────────────────────────────────────────────────────

    def list(self, tenant_id: str, restaurant_id: str) -> dict[str, Any]:
        try:
            res = self._table.query(
                KeyConditionExpression=(
                    Key("PK").eq(self._pk(tenant_id, restaurant_id))
                    & Key("SK").begins_with("TABLE#")
                ),
            )
        except ClientError as exc:
            log.error("table.list.failed", extra={
                "restaurant_id": restaurant_id,
                "error": exc.response["Error"]["Code"],
            })
            raise StorageError("Failed to list tables") from exc

        items = [self._strip_keys(decimal_to_python(i)) for i in res.get("Items", [])]
        log.info("table.list.success", extra={
            "restaurant_id": restaurant_id, "count": len(items),
        })
        return {"tables": items, "count": len(items)}

    # ── Mutations ─────────────────────────────────────────────────────────

    def create(self, tenant_id: str, restaurant_id: str, body: dict) -> dict[str, Any]:
        table_number = str(body.get("tableNumber", "")).strip()
        zone = str(body.get("zone", "Main Hall")).strip()
        outlet = str(body.get("outlet", zone)).strip()

        if not table_number:
            raise BadRequestError("tableNumber is required")

        try:
            capacity = int(body.get("capacity", 4))
        except (ValueError, TypeError):
            raise BadRequestError("capacity must be an integer")

        table_id = new_id()
        now = utc_now()

        item = {
            "PK":           self._pk(tenant_id, restaurant_id),
            "SK":           self._sk(table_id),
            "tableId":      table_id,
            "tableNumber":  table_number,
            "zone":         zone,
            "outlet":       outlet,
            "capacity":     capacity,
            "isActive":     True,
            "tenantId":     tenant_id,
            "restaurantId": restaurant_id,
            "createdAt":    now,
            "updatedAt":    now,
        }

        try:
            self._table.put_item(Item=item)
        except ClientError as exc:
            log.error("table.create.failed", extra={
                "restaurant_id": restaurant_id,
                "error": exc.response["Error"]["Code"],
            })
            raise StorageError("Failed to create table") from exc

        log.info("table.create.success", extra={
            "table_id": table_id, "table_number": table_number,
            "zone": zone, "restaurant_id": restaurant_id,
        })
        return self._strip_keys(item)

    def update(
        self, tenant_id: str, restaurant_id: str, table_id: str, body: dict,
    ) -> dict[str, Any]:
        updates = {k: v for k, v in body.items() if k in _ALLOWED_UPDATE_FIELDS}
        if not updates:
            raise BadRequestError(
                f"No valid fields to update. Allowed: {sorted(_ALLOWED_UPDATE_FIELDS)}"
            )

        updates["updatedAt"] = utc_now()
        expr, names, values = build_update_expression(updates)

        try:
            self._table.update_item(
                Key={"PK": self._pk(tenant_id, restaurant_id), "SK": self._sk(table_id)},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
                ConditionExpression="attribute_exists(PK)",
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "ConditionalCheckFailedException":
                raise ResourceNotFoundError("Table", table_id) from exc
            log.error("table.update.failed", extra={"table_id": table_id, "error": code})
            raise StorageError("Failed to update table") from exc

        log.info("table.update.success", extra={
            "table_id": table_id, "updated_fields": list(updates.keys()),
        })
        return {"tableId": table_id, "updated": list(updates.keys())}

    def delete(self, tenant_id: str, restaurant_id: str, table_id: str) -> dict[str, Any]:
        try:
            self._table.delete_item(
                Key={"PK": self._pk(tenant_id, restaurant_id), "SK": self._sk(table_id)},
                ConditionExpression="attribute_exists(PK)",
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "ConditionalCheckFailedException":
                raise ResourceNotFoundError("Table", table_id) from exc
            log.error("table.delete.failed", extra={"table_id": table_id, "error": code})
            raise StorageError("Failed to delete table") from exc

        log.info("table.delete.success", extra={
            "table_id": table_id, "restaurant_id": restaurant_id,
        })
        return {"tableId": table_id, "deleted": True}

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _pk(tenant_id: str, restaurant_id: str) -> str:
        return f"TENANT#{tenant_id}#RESTAURANT#{restaurant_id}"

    @staticmethod
    def _sk(table_id: str) -> str:
        return f"TABLE#{table_id}"

    @staticmethod
    def _strip_keys(item: dict) -> dict:
        """Remove DynamoDB-internal PK/SK keys from API response."""
        return {k: v for k, v in item.items() if k not in ("PK", "SK")}
