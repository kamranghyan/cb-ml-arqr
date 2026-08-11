"""
MenuItemService — DynamoDB CRUD on the dedicated ItemTable.

Migrated from single-table (MenuTable, PK/SK) to:
    ItemTable-dev
    PK  = itemId
    GSI-1 = restaurantId-index  → all items for a restaurant
    GSI-2 = categoryId-index    → items in ONE category (efficient, no in-memory filter)

Optimistic locking preserved: updates use a ConditionExpression on `version`.
"""
from __future__ import annotations

import os
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from app.models.menu_item import MenuItem, MenuItemSize
from app.services.cache_service import CacheService
from app.services.s3_service import S3Service
from app.utils.dynamo_helpers import (
    decimal_to_python, encode_lek, decode_lek,
)
from app.utils.ids import new_id, utc_now
from app.utils.logger import get_logger
from app.utils.retry import retry

log = get_logger(__name__)

_TABLE_NAME = os.environ.get("ITEM_TABLE", "ItemTable-dev")
_PAGE_LIMIT = 50


class MenuItemNotFoundError(Exception):
    pass


class MenuItemConflictError(Exception):
    """Raised when optimistic lock version mismatch is detected."""
    pass


class MenuItemService:
    def __init__(
        self,
        table=None,
        cache: Optional[CacheService] = None,
        s3_svc: Optional[S3Service] = None,
    ) -> None:
        self._table = table or boto3.resource("dynamodb").Table(_TABLE_NAME)
        self._cache = cache or CacheService()
        self._s3 = s3_svc or S3Service()

    def _parse_sizes(self, sizes) -> Optional[list[MenuItemSize]]:
        if sizes is None:
            return None

        return [
            MenuItemSize.from_dict(size)
            for size in sizes
        ]
    # ── Private helpers (single-key: itemId) ──────────────────────────────

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_get(self, item_id: str) -> Optional[dict]:
        resp = self._table.get_item(Key={"itemId": item_id})
        item = resp.get("Item")
        return decimal_to_python(item) if item else None

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_put(self, item: dict) -> None:
        self._table.put_item(Item=item)

    def _ddb_update_with_version(
        self, item_id: str, updates: dict, expected_version: int
    ) -> dict:
        """Update with optimistic locking (ConditionExpression on version)."""
        new_version = expected_version + 1
        attr_names: dict = {"#ver": "version"}
        attr_values: dict = {":newver": new_version, ":oldver": expected_version}
        set_parts: list = ["#ver = :newver"]

        for idx, (field, value) in enumerate(updates.items()):
            nk = f"#f{idx}"
            vk = f":u{idx}"
            attr_names[nk] = field
            attr_values[vk] = value
            set_parts.append(f"{nk} = {vk}")

        update_expr = "SET " + ", ".join(set_parts)
        condition_expr = "#ver = :oldver"

        try:
            resp = self._table.update_item(
                Key={"itemId": item_id},
                UpdateExpression=update_expr,
                ConditionExpression=condition_expr,
                ExpressionAttributeNames=attr_names,
                ExpressionAttributeValues=attr_values,
                ReturnValues="ALL_NEW",
            )
            return decimal_to_python(resp.get("Attributes", {}))
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                raise MenuItemConflictError(
                    f"Version conflict: expected {expected_version}"
                ) from exc
            raise

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_delete(self, item_id: str) -> None:
        self._table.delete_item(Key={"itemId": item_id})

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_list_by_restaurant(
        self, restaurant_id: str, exclusive_start_key: Optional[dict] = None
    ) -> tuple[list[dict], Optional[dict]]:
        kwargs: dict = {
            "IndexName": "restaurantId-index",
            "KeyConditionExpression": Key("restaurantId").eq(restaurant_id),
            "Limit": _PAGE_LIMIT,
        }
        if exclusive_start_key:
            kwargs["ExclusiveStartKey"] = exclusive_start_key
        resp = self._table.query(**kwargs)
        return [decimal_to_python(i) for i in resp.get("Items", [])], resp.get("LastEvaluatedKey")

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_list_by_category(
        self, category_id: str, exclusive_start_key: Optional[dict] = None
    ) -> tuple[list[dict], Optional[dict]]:
        kwargs: dict = {
            "IndexName": "categoryId-index",
            "KeyConditionExpression": Key("categoryId").eq(category_id),
            "Limit": _PAGE_LIMIT,
        }
        if exclusive_start_key:
            kwargs["ExclusiveStartKey"] = exclusive_start_key
        resp = self._table.query(**kwargs)
        return [decimal_to_python(i) for i in resp.get("Items", [])], resp.get("LastEvaluatedKey")

    def _to_item(self, menu_item: MenuItem) -> dict:
        item = menu_item.to_dict(exclude_none=True)
        item.pop("imageUrl", None)
        item.pop("arModelUrl", None)
        item.pop("PK", None)
        item.pop("SK", None)
        return item

    # ── Public API ────────────────────────────────────────────────────────

    def create(self, tenant_id: str, restaurant_id: str, body: dict) -> MenuItem:
        item_id = new_id()
        now = utc_now()

        menu_item = MenuItem(
            itemId=item_id,
            tenantId=tenant_id,
            restaurantId=restaurant_id,
            categoryId=body.get("categoryId", ""),
            categoryName=body.get("categoryName", ""),
            name=body.get("name", ""),
            description=body.get("description", ""),
            priceMinorUnits=int(body.get("priceMinorUnits", 0)),
            isActive=bool(body.get("isActive", True)),
            version=1,
            createdAt=now,
            updatedAt=now,
            imageKey=body.get("imageKey"),
            allergens=list(body.get("allergens") or []),
            arModelKey=body.get("arModelKey"),
            sizes=self._parse_sizes(body.get("sizes")), 
        )
        menu_item.validate()

        self._ddb_put(self._to_item(menu_item))

        self._cache.set(
            CacheService.item_key(tenant_id, restaurant_id, item_id),
            menu_item.to_dict(),
        )
        self._cache.delete(CacheService.items_list_key(tenant_id, restaurant_id))

        log.info("MenuItem created", extra={
            "tenantId": tenant_id, "restaurantId": restaurant_id, "itemId": item_id,
        })
        return menu_item

    def get(self, tenant_id: str, restaurant_id: str, item_id: str) -> MenuItem:
        cache_key = CacheService.item_key(tenant_id, restaurant_id, item_id)
        raw = self._cache.get_or_load(
            cache_key,
            loader=lambda: self._ddb_get(item_id),
        )
        if raw is None:
            raise MenuItemNotFoundError(f"Item {item_id} not found")
        if (
            raw.get("tenantId") != tenant_id
            or raw.get("restaurantId") != restaurant_id
        ):
            raise MenuItemNotFoundError(f"Item {item_id} not found")
        
        item = MenuItem.from_dict(raw)
        item.imageUrl = self._s3.generate_read_url(item.imageKey)
        item.arModelUrl = self._s3.generate_read_url(item.arModelKey)
        return item

    def list(
        self,
        tenant_id: str,
        restaurant_id: str,
        encoded_lek: Optional[str] = None,
        category_id: Optional[str] = None,
    ) -> tuple[list[MenuItem], Optional[str]]:
        """
        List items. If category_id is given, query the categoryId GSI directly
        (efficient — no in-memory filtering). Otherwise query the restaurantId GSI.
        """
        exclusive_start = decode_lek(encoded_lek)

        # Cache only the unfiltered first page
        if exclusive_start is None and category_id is None:
            cache_key = CacheService.items_list_key(tenant_id, restaurant_id)
            cached = self._cache.get(cache_key)
            if cached is not None:
                items = [MenuItem.from_dict(i) for i in cached.get("items", [])]
                return items, cached.get("lek")

        if category_id:
            raw_items, lek = self._ddb_list_by_category(category_id, exclusive_start)
        else:
            raw_items, lek = self._ddb_list_by_restaurant(restaurant_id, exclusive_start)

        menu_items = [MenuItem.from_dict(i) for i in raw_items]
        for mi in menu_items:
            mi.imageUrl = self._s3.generate_read_url(mi.imageKey)
            mi.arModelUrl = self._s3.generate_read_url(mi.arModelKey)

        if exclusive_start is None and category_id is None and lek is None:
            self._cache.set(
                CacheService.items_list_key(tenant_id, restaurant_id),
                {"items": [i.to_dict() for i in menu_items], "lek": None},
            )

        return menu_items, encode_lek(lek)

    def update(
        self, tenant_id: str, restaurant_id: str, item_id: str, body: dict
    ) -> MenuItem:
        """Partial update with optimistic locking (version required)."""
        self.get(tenant_id, restaurant_id, item_id)  # 404 guard

        expected_version = body.get("version")
        if expected_version is None:
            raise ValueError("version is required for update")
        expected_version = int(expected_version)

        mutable = {
            "name",
            "description",
            "priceMinorUnits",
            "isActive",
            "imageKey",
            "allergens",
            "arModelKey",
            "categoryId",
            "categoryName",
            "sizes"
        }

        updates = {k: v for k, v in body.items() if k in mutable}

        if "sizes" in body:
            parsed_sizes = self._parse_sizes(body["sizes"])

            if parsed_sizes is not None:
                seen_sizes = set()

                for size in parsed_sizes:
                    size.validate()

                    if size.name in seen_sizes:
                        raise ValueError(f"duplicate size: {size.name}")

                    seen_sizes.add(size.name)

            updates["sizes"] = (
                [size.to_dict() for size in parsed_sizes]
                if parsed_sizes is not None
                else None
            )

        updates["updatedAt"] = utc_now()

        attrs = self._ddb_update_with_version(item_id, updates, expected_version)

        self._cache.delete(
            CacheService.item_key(tenant_id, restaurant_id, item_id),
            CacheService.items_list_key(tenant_id, restaurant_id),
        )

        log.info("MenuItem updated", extra={
            "tenantId": tenant_id, "restaurantId": restaurant_id,
            "itemId": item_id, "newVersion": expected_version + 1,
        })
        return MenuItem.from_dict(attrs)

    def delete(self, tenant_id: str, restaurant_id: str, item_id: str) -> None:
        self.get(tenant_id, restaurant_id, item_id)  # 404 guard

        self._ddb_delete(item_id)

        self._cache.delete(
            CacheService.item_key(tenant_id, restaurant_id, item_id),
            CacheService.items_list_key(tenant_id, restaurant_id),
        )
        log.info("MenuItem deleted", extra={
            "tenantId": tenant_id, "restaurantId": restaurant_id, "itemId": item_id,
        })