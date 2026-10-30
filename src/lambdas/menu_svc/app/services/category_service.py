"""
CategoryService — DynamoDB CRUD on the dedicated CategoryTable.

Migrated from single-table (MenuTable, PK/SK) to:
    CategoryTable-dev
    PK  = categoryId
    GSI = restaurantId-index (PK restaurantId, SK displayOrder)
          → all categories for a restaurant, ordered by displayOrder
"""
from __future__ import annotations

import os
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from app.models.category import MenuCategory
from app.services.cache_service import CacheService
from app.services.s3_service import S3Service
from app.utils.dynamo_helpers import decimal_to_python, build_update_expression, encode_lek, decode_lek
from app.utils.ids import new_id, utc_now
from app.utils.logger import get_logger
from app.utils.retry import retry

log = get_logger(__name__)

_TABLE_NAME = os.environ.get("CATEGORY_TABLE", "CategoryTable-dev")
_PAGE_LIMIT = 50


class CategoryNotFoundError(Exception):
    pass


class CategoryService:
    def __init__(
        self,
        table=None,
        cache: Optional[CacheService] = None,
        s3_svc: Optional[S3Service] = None,
    ) -> None:
        self._table = table or boto3.resource("dynamodb").Table(_TABLE_NAME)
        self._cache = cache or CacheService()
        self._s3 = s3_svc or S3Service()

    # ── Private helpers (single-key: categoryId) ──────────────────────────

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_get(self, category_id: str) -> Optional[dict]:
        resp = self._table.get_item(Key={"categoryId": category_id})
        item = resp.get("Item")
        return decimal_to_python(item) if item else None

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_put(self, item: dict) -> None:
        self._table.put_item(Item=item)

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_update(self, category_id: str, updates: dict) -> dict:
        expr, names, values = build_update_expression(updates)
        resp = self._table.update_item(
            Key={"categoryId": category_id},
            UpdateExpression=expr,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
        return decimal_to_python(resp.get("Attributes", {}))

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_delete(self, category_id: str) -> None:
        self._table.delete_item(Key={"categoryId": category_id})

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
        items = [decimal_to_python(i) for i in resp.get("Items", [])]
        lek = resp.get("LastEvaluatedKey")
        return items, lek

    def _to_item(self, category: MenuCategory) -> dict:
        item = category.to_dict(exclude_none=True)
        item.pop("imageUrl", None)
        item.pop("PK", None)
        item.pop("SK", None)
        return item

    # ── Public API ────────────────────────────────────────────────────────

    def create(self, tenant_id: str, restaurant_id: str, body: dict) -> MenuCategory:
        category_id = new_id()

        category = MenuCategory(
            categoryId=category_id,
            tenantId=tenant_id,
            restaurantId=restaurant_id,
            name=body.get("name", ""),
            displayOrder=int(body.get("displayOrder", 0)),
            isActive=bool(body.get("isActive", True)),
            imageKey=body.get("imageKey"),
        )
        category.validate()

        self._ddb_put(self._to_item(category))

        self._cache.set(
            CacheService.category_key(tenant_id, restaurant_id, category_id),
            category.to_dict(),
        )
        self._cache.delete(CacheService.categories_list_key(tenant_id, restaurant_id))

        log.info("Category created", extra={
            "tenantId": tenant_id, "restaurantId": restaurant_id, "categoryId": category_id,
        })
        return category

    def get(self, tenant_id: str, restaurant_id: str, category_id: str) -> MenuCategory:
        cache_key = CacheService.category_key(tenant_id, restaurant_id, category_id)
        raw = self._cache.get_or_load(
            cache_key,
            loader=lambda: self._ddb_get(category_id),
        )
        if raw is None:
            raise CategoryNotFoundError(f"Category {category_id} not found")
        cat = MenuCategory.from_dict(raw)
        cat.imageUrl = self._s3.generate_read_url(cat.imageKey)
        return cat

    def list(
        self,
        tenant_id: str,
        restaurant_id: str,
        encoded_lek = None,
    ) -> tuple[list[MenuCategory], Optional[str]]:
        """List all categories for a restaurant via GSI, ordered by displayOrder."""
        cache_key = CacheService.categories_list_key(tenant_id, restaurant_id)
        exclusive_start = decode_lek(encoded_lek)

        if exclusive_start is None:
            cached = self._cache.get(cache_key)
            if cached is not None:
                cats = [MenuCategory.from_dict(c) for c in cached.get("items", [])]
                return cats, cached.get("lek")

        items, lek = self._ddb_list_by_restaurant(restaurant_id, exclusive_start)
        categories = [MenuCategory.from_dict(i) for i in items]
        for c in categories:
            c.imageUrl = self._s3.generate_read_url(c.imageKey)

        if exclusive_start is None and lek is None:
            self._cache.set(cache_key, {
                "items": [c.to_dict() for c in categories],
                "lek": None,
            })

        return categories, encode_lek(lek)

    def update(
        self, tenant_id: str, restaurant_id: str, category_id: str, body: dict
    ) -> MenuCategory:
        self.get(tenant_id, restaurant_id, category_id)  # 404 guard

        mutable = {"name", "displayOrder", "isActive", "imageKey"}
        updates = {k: v for k, v in body.items() if k in mutable}
        updates["updatedAt"] = utc_now()

        attrs = self._ddb_update(category_id, updates)

        self._cache.delete(
            CacheService.category_key(tenant_id, restaurant_id, category_id),
            CacheService.categories_list_key(tenant_id, restaurant_id),
        )

        log.info("Category updated", extra={
            "tenantId": tenant_id, "restaurantId": restaurant_id, "categoryId": category_id,
        })
        return MenuCategory.from_dict(attrs)

    def delete(self, tenant_id: str, restaurant_id: str, category_id: str) -> None:
        self.get(tenant_id, restaurant_id, category_id)  # 404 guard

        self._ddb_delete(category_id)

        self._cache.delete(
            CacheService.category_key(tenant_id, restaurant_id, category_id),
            CacheService.categories_list_key(tenant_id, restaurant_id),
        )
        log.info("Category deleted", extra={
            "tenantId": tenant_id, "restaurantId": restaurant_id, "categoryId": category_id,
        })