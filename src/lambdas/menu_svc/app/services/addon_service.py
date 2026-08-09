"""
AddOnService — DynamoDB CRUD on the dedicated AddOnTable.

DynamoDB:
    AddOnTable-dev
    PK  = addOnId
    GSI = menuItemId-index
          → all add-ons belonging to one menu item

Ownership:
    tenantId
    restaurantId
    categoryId
    menuItemId

An add-on belongs to a menu item. categoryId is derived from the
menu item rather than trusted from the client request.
"""

from __future__ import annotations

import os
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from app.models.addon import AddOn
from app.services.cache_service import CacheService
from app.utils.dynamo_helpers import (
    decimal_to_python,
    encode_lek,
    decode_lek,
    build_update_expression,
)
from app.utils.ids import new_id, utc_now
from app.utils.logger import get_logger
from app.utils.retry import retry

log = get_logger(__name__)

_TABLE_NAME = os.environ.get("ADDON_TABLE", "AddOnTable-dev")
_PAGE_LIMIT = 50


class AddOnNotFoundError(Exception):
    pass


class AddOnService:

    def __init__(
        self,
        table=None,
        cache: Optional[CacheService] = None,
    ) -> None:
        self._table = table or boto3.resource("dynamodb").Table(_TABLE_NAME)
        self._cache = cache or CacheService()

    # ─────────────────────────────────────────────────────────────────
    # DynamoDB helpers
    # ─────────────────────────────────────────────────────────────────

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_get(self, add_on_id: str) -> Optional[dict]:
        resp = self._table.get_item(
            Key={"addOnId": add_on_id}
        )

        item = resp.get("Item")
        return decimal_to_python(item) if item else None

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_put(self, item: dict) -> None:
        self._table.put_item(Item=item)

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_update(
        self,
        add_on_id: str,
        updates: dict,
    ) -> dict:
        expr, names, values = build_update_expression(updates)

        resp = self._table.update_item(
            Key={"addOnId": add_on_id},
            UpdateExpression=expr,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )

        return decimal_to_python(
            resp.get("Attributes", {})
        )

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_delete(self, add_on_id: str) -> None:
        self._table.delete_item(
            Key={"addOnId": add_on_id}
        )

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_list_by_menu_item(
        self,
        menu_item_id: str,
        exclusive_start_key: Optional[dict] = None,
    ) -> tuple[list[dict], Optional[dict]]:

        kwargs: dict = {
            "IndexName": "menuItemId-index",
            "KeyConditionExpression": Key(
                "menuItemId"
            ).eq(menu_item_id),
            "Limit": _PAGE_LIMIT,
        }

        if exclusive_start_key:
            kwargs["ExclusiveStartKey"] = exclusive_start_key

        resp = self._table.query(**kwargs)

        items = [
            decimal_to_python(item)
            for item in resp.get("Items", [])
        ]

        return items, resp.get("LastEvaluatedKey")

    # ─────────────────────────────────────────────────────────────────
    # Serialization
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _to_item(add_on: AddOn) -> dict:
        return add_on.to_dynamo_item()

    # ─────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────

    def create(
        self,
        tenant_id: str,
        restaurant_id: str,
        body: dict,
        category_id: str,
    ) -> AddOn:

        add_on_id = new_id()
        now = utc_now()

        add_on = AddOn(
            addOnId=add_on_id,
            tenantId=tenant_id,
            restaurantId=restaurant_id,
            categoryId=category_id,
            menuItemId=body.get("menuItemId", ""),
            name=body.get("name", ""),
            description=body.get("description"),
            priceMinorUnits=int(body.get("priceMinorUnits", 0)),
            isActive=bool(body.get("isActive", True)),
            sortOrder=int(body.get("sortOrder", 0)),
            createdAt=now,
            updatedAt=now,
        )

        add_on.validate()

        self._ddb_put(
            self._to_item(add_on)
        )

        self._cache.set(
            CacheService.addon_key(
                tenant_id,
                restaurant_id,
                add_on_id,
            ),
            add_on.to_dict(),
        )

        self._cache.delete(
            CacheService.addons_list_key(
                tenant_id,
                restaurant_id,
                add_on.menuItemId,
            )
        )

        log.info(
            "AddOn created",
            extra={
                "tenantId": tenant_id,
                "restaurantId": restaurant_id,
                "menuItemId": add_on.menuItemId,
                "addOnId": add_on_id,
            },
        )

        return add_on

    def get(
        self,
        tenant_id: str,
        restaurant_id: str,
        menu_item_id: str,
        add_on_id: str,
    ) -> AddOn:

        cache_key = CacheService.addon_key(
            tenant_id,
            restaurant_id,
            add_on_id,
        )

        raw = self._cache.get_or_load(
            cache_key,
            loader=lambda: self._ddb_get(add_on_id),
        )

        if raw is None:
            raise AddOnNotFoundError(
                f"AddOn {add_on_id} not found"
            )

        # Make sure the AddOn actually belongs to the requested
        # restaurant/menu item.
        if (
            raw.get("tenantId") != tenant_id
            or raw.get("restaurantId") != restaurant_id
            or raw.get("menuItemId") != menu_item_id
        ):
            raise AddOnNotFoundError(
                f"AddOn {add_on_id} not found"
            )

        return AddOn.from_dict(raw)

    def list(
        self,
        tenant_id: str,
        restaurant_id: str,
        menu_item_id: str,
        encoded_lek: Optional[str] = None,
    ) -> tuple[list[AddOn], Optional[str]]:

        exclusive_start = decode_lek(encoded_lek)

        # Cache only the first page.
        if exclusive_start is None:
            cache_key = CacheService.addons_list_key(
                tenant_id,
                restaurant_id,
                menu_item_id,
            )

            cached = self._cache.get(cache_key)

            if cached is not None:
                addons = [
                    AddOn.from_dict(item)
                    for item in cached.get("items", [])
                ]

                return addons, cached.get("lek")

        raw_items, lek = self._ddb_list_by_menu_item(
            menu_item_id,
            exclusive_start,
        )

        # Enforce tenant + restaurant ownership.
        raw_items = [
            item
            for item in raw_items
            if item.get("tenantId") == tenant_id
            and item.get("restaurantId") == restaurant_id
        ]

        addons = [
            AddOn.from_dict(item)
            for item in raw_items
        ]

        if exclusive_start is None and lek is None:
            self._cache.set(
                CacheService.addons_list_key(
                    tenant_id,
                    restaurant_id,
                    menu_item_id,
                ),
                {
                    "items": [
                        addon.to_dict()
                        for addon in addons
                    ],
                    "lek": None,
                },
            )

        return addons, encode_lek(lek)

    def update(
        self,
        tenant_id: str,
        restaurant_id: str,
        menu_item_id: str,
        add_on_id: str,
        body: dict,
    ) -> AddOn:

        # 404 + ownership guard.
        self.get(
            tenant_id,
            restaurant_id,
            menu_item_id,
            add_on_id,
        )

        mutable = {
            "name",
            "description",
            "priceMinorUnits",
            "isActive",
            "sortOrder",
        }

        updates = {
            key: value
            for key, value in body.items()
            if key in mutable
        }

        updates["updatedAt"] = utc_now()

        attrs = self._ddb_update(
            add_on_id,
            updates,
        )

        self._cache.delete(
            CacheService.addon_key(
                tenant_id,
                restaurant_id,
                add_on_id,
            ),
            CacheService.addons_list_key(
                tenant_id,
                restaurant_id,
                menu_item_id,
            ),
        )

        log.info(
            "AddOn updated",
            extra={
                "tenantId": tenant_id,
                "restaurantId": restaurant_id,
                "menuItemId": menu_item_id,
                "addOnId": add_on_id,
            },
        )

        return AddOn.from_dict(attrs)

    def delete(
        self,
        tenant_id: str,
        restaurant_id: str,
        menu_item_id: str,
        add_on_id: str,
    ) -> None:

        # 404 + ownership guard.
        self.get(
            tenant_id,
            restaurant_id,
            menu_item_id,
            add_on_id,
        )

        self._ddb_delete(add_on_id)

        self._cache.delete(
            CacheService.addon_key(
                tenant_id,
                restaurant_id,
                add_on_id,
            ),
            CacheService.addons_list_key(
                tenant_id,
                restaurant_id,
                menu_item_id,
            ),
        )

        log.info(
            "AddOn deleted",
            extra={
                "tenantId": tenant_id,
                "restaurantId": restaurant_id,
                "menuItemId": menu_item_id,
                "addOnId": add_on_id,
            },
        )