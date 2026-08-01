"""
app.services.tenant_limits
==========================
Reads TenantTable so menu_svc can enforce subscription limits before it
creates a restaurant, and keeps `restaurantCount` in step afterwards.

auth_svc owns the tenant record; this module only reads it and adjusts the
counter — it never creates or deletes tenants.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from shared.exceptions import ForbiddenError, ResourceNotFoundError
from shared.structured_logger import get_logger

log = get_logger("menu.tenant_limits")

_TABLE_NAME = os.environ.get("TENANT_TABLE", "TenantTable-dev")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class TenantLimits:
    def __init__(self, table=None) -> None:
        self._t = table or boto3.resource("dynamodb").Table(_TABLE_NAME)

    def get(self, tenant_id: str) -> dict:
        try:
            resp = self._t.get_item(Key={"tenantId": tenant_id})
        except ClientError as exc:
            log.warning("tenant.read.failed", tenant_id=tenant_id,
                        error=exc.response["Error"]["Code"])
            return {}
        return resp.get("Item") or {}

    def assert_can_add_restaurant(self, tenant_id: str) -> None:
        """
        Raises ForbiddenError when the tenant is suspended or has used up its
        plan's restaurant allowance.

        If the tenant record is missing we allow the write and log it —
        blocking here would break older tenants created before TenantTable
        existed. auth_svc is the source of truth for real enforcement.
        """
        tenant = self.get(tenant_id)
        if not tenant:
            log.warning("tenant.record.missing", tenant_id=tenant_id)
            return

        if not tenant.get("isActive", True):
            raise ForbiddenError(
                "This tenant account is suspended. Contact support."
            )

        max_r = int(tenant.get("maxRestaurants", -1))
        if max_r == -1:
            return

        count = int(tenant.get("restaurantCount", 0))
        if count >= max_r:
            raise ForbiddenError(
                f"Plan limit reached — {count} of {max_r} restaurants used. "
                f"Upgrade your plan to add more."
            )

    def adjust_count(self, tenant_id: str, delta: int) -> None:
        """Keep restaurantCount in step. Never fails the caller's request."""
        try:
            self._t.update_item(
                Key={"tenantId": tenant_id},
                UpdateExpression=(
                    "SET restaurantCount = if_not_exists(restaurantCount, :z) + :d, "
                    "updatedAt = :u"
                ),
                ExpressionAttributeValues={":d": delta, ":z": 0, ":u": _now()},
            )
        except ClientError as exc:
            log.warning("tenant.count.adjust_failed", tenant_id=tenant_id,
                        delta=delta, error=exc.response["Error"]["Code"])
            return

        if delta < 0:
            # Clamp in case of a double delete.
            try:
                item = self._t.get_item(Key={"tenantId": tenant_id}).get("Item") or {}
                if int(item.get("restaurantCount", 0)) < 0:
                    self._t.update_item(
                        Key={"tenantId": tenant_id},
                        UpdateExpression="SET restaurantCount = :z",
                        ExpressionAttributeValues={":z": 0},
                    )
            except ClientError:
                pass