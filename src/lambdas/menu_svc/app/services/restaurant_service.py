"""
RestaurantService — DynamoDB CRUD on the dedicated RestaurantTable.

Migrated from single-table (MenuTable, PK/SK) to a normalized table:
    RestaurantTable-dev
    PK = restaurantId
    GSI: tenantId-index (find a tenant's restaurant)

Notes for the new model:
  • A restaurant may be created WITHOUT an owner tenant (tenantId empty);
    admin assigns a tenant later via auth_svc.zz
  • Cache calls are kept but Redis is effectively disabled (skipped) in this
    environment — CacheService swallows connection errors.
"""
from __future__ import annotations

import os
from typing import Optional

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

from app.models.restaurant import Restaurant
from app.models.address import Address
from app.services.cache_service import CacheService
from app.services.s3_service import S3Service
from app.utils.dynamo_helpers import decimal_to_python, build_update_expression
from app.utils.ids import new_id, utc_now
from app.utils.logger import get_logger
from app.utils.retry import retry

log = get_logger(__name__)

_TABLE_NAME = os.environ.get("RESTAURANT_TABLE", "RestaurantTable-dev")


class RestaurantNotFoundError(Exception):
    pass


class RestaurantService:
    def __init__(
        self,
        table=None,
        cache: Optional[CacheService] = None,
        s3_svc: Optional[S3Service] = None,
    ) -> None:
        self._table = table or boto3.resource("dynamodb").Table(_TABLE_NAME)
        self._cache = cache or CacheService()
        self._s3 = s3_svc or S3Service()

    # ── Private helpers (single-key: restaurantId) ────────────────────────

    def _cache_key(self, tenant_id: str, restaurant_id: str) -> str:
        return CacheService.restaurant_key(tenant_id, restaurant_id)

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_get(self, restaurant_id: str) -> Optional[dict]:
        resp = self._table.get_item(Key={"restaurantId": restaurant_id})
        item = resp.get("Item")
        return decimal_to_python(item) if item else None

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_put(self, item: dict) -> None:
        self._table.put_item(Item=item)

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_update(self, restaurant_id: str, updates: dict) -> dict:
        expr, names, values = build_update_expression(updates)
        resp = self._table.update_item(
            Key={"restaurantId": restaurant_id},
            UpdateExpression=expr,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
        return decimal_to_python(resp.get("Attributes", {}))

    @retry(retries=3, base_delay=0.1, exceptions=(ClientError,))
    def _ddb_delete(self, restaurant_id: str) -> None:
        self._table.delete_item(Key={"restaurantId": restaurant_id})

    def _to_item(self, restaurant: Restaurant) -> dict:
        """Serialize without the old PK/SK keys."""
        item = restaurant.to_dict(exclude_none=True)
        item.pop("logoUrl", None)
        item.pop("bannerUrl", None)
        item.pop("PK", None)
        item.pop("SK", None)
        return item

    # ── Public API ────────────────────────────────────────────────────────

    def create(self, tenant_id: str, body: dict) -> Restaurant:
        """
        Create a restaurant. In the new model the admin creates restaurants and
        `tenant_id` may be empty (owner assigned later). If a tenant_id is passed
        (e.g. body.tenantId), it is stored as the owner.
        """
        restaurant_id = new_id()
        now = utc_now()

        owner_tenant = body.get("tenantId") or tenant_id or ""

        addr_raw = body.get("address") or {}
        restaurant = Restaurant(
            restaurantId=restaurant_id,
            tenantId=owner_tenant,
            name=body.get("name", ""),
            address=Address.from_dict(addr_raw),
            timezone=body.get("timezone", ""),
            currencyCode=body.get("currencyCode", ""),
            isActive=bool(body.get("isActive", True)),
            createdAt=now,
            updatedAt=now,
            logoKey=body.get("logoKey"),
            bannerKey=body.get("bannerKey"),
        )
        restaurant.validate()

        self._ddb_put(self._to_item(restaurant))
        self._cache.set(self._cache_key(owner_tenant, restaurant_id), restaurant.to_dict())

        log.info("Restaurant created", extra={
            "tenantId": owner_tenant, "restaurantId": restaurant_id
        })
        return restaurant

    def get(self, tenant_id: str, restaurant_id: str) -> Restaurant:
        """Fetch a restaurant by id. tenant_id kept for cache key + signature compat."""
        cache_key = self._cache_key(tenant_id, restaurant_id)
        raw = self._cache.get_or_load(
            cache_key,
            loader=lambda: self._ddb_get(restaurant_id),
        )
        if raw is None:
            raise RestaurantNotFoundError(
                f"Restaurant {restaurant_id} not found"
            )
        restaurant = Restaurant.from_dict(raw)
        restaurant.logoUrl   = self._s3.generate_read_url(restaurant.logoKey)
        restaurant.bannerUrl = self._s3.generate_read_url(restaurant.bannerKey)
        return restaurant

    def update(self, tenant_id: str, restaurant_id: str, body: dict) -> Restaurant:
        """Partial update — only present fields change."""
        self.get(tenant_id, restaurant_id)  # 404 guard

        mutable = {
            "name", "timezone", "currencyCode", "isActive",
            "logoKey", "bannerKey", "tenantId",
        }
        updates: dict = {k: v for k, v in body.items() if k in mutable}

        if "address" in body:
            updates["address"] = body["address"]

        updates["updatedAt"] = utc_now()

        attrs = self._ddb_update(restaurant_id, updates)
        self._cache.delete(self._cache_key(tenant_id, restaurant_id))

        restaurant = Restaurant.from_dict(attrs)
        log.info("Restaurant updated", extra={
            "tenantId": tenant_id, "restaurantId": restaurant_id
        })
        return restaurant

    def list_all(
        self,
        tenant_id: str,
        encoded_lek: Optional[str] = None,
    ) -> tuple[list[Restaurant], Optional[str]]:
        """
        List restaurants.
          • admin (no tenant scoping): pass tenant_id="" or None → returns ALL restaurants (scan).
          • tenant: pass their tenant_id → returns only their restaurant(s) via tenantId-index.
        Returns (restaurants, next_encoded_lek).
        """
        from app.utils.dynamo_helpers import encode_lek, decode_lek

        exclusive_start = decode_lek(encoded_lek)

        if tenant_id:
            # tenant-scoped: query the GSI
            query_kwargs: dict = {
                "IndexName": "tenantId-index",
                "KeyConditionExpression": Key("tenantId").eq(tenant_id),
                "Limit": 100,
            }
            if exclusive_start:
                query_kwargs["ExclusiveStartKey"] = exclusive_start
            resp = self._table.query(**query_kwargs)
        else:
            # admin: full scan
            scan_kwargs: dict = {"Limit": 100}
            if exclusive_start:
                scan_kwargs["ExclusiveStartKey"] = exclusive_start
            resp = self._table.scan(**scan_kwargs)

        items = [decimal_to_python(i) for i in resp.get("Items", [])]
        lek = resp.get("LastEvaluatedKey")

        restaurants = []
        for raw in items:
            r = Restaurant.from_dict(raw)
            r.logoUrl   = self._s3.generate_read_url(r.logoKey)
            r.bannerUrl = self._s3.generate_read_url(r.bannerKey)
            restaurants.append(r)

        log.info("Restaurants listed", extra={
            "tenantId": tenant_id or "ALL", "count": len(restaurants)
        })
        return restaurants, encode_lek(lek)

    def delete(self, tenant_id: str, restaurant_id: str) -> None:
        """Delete a restaurant."""
        self.get(tenant_id, restaurant_id)  # 404 guard
        self._ddb_delete(restaurant_id)
        self._cache.delete(self._cache_key(tenant_id, restaurant_id))
        log.info("Restaurant deleted", extra={
            "tenantId": tenant_id, "restaurantId": restaurant_id
        })