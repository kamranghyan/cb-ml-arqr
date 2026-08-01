"""
app.services.tenant_service
===========================
TenantTable CRUD.

A tenant is a company (e.g. "McDonald's Pakistan") that owns 1..N restaurants.
`restaurantCount` is kept on the record so plan limits can be checked without
scanning RestaurantTable on every create.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from shared.exceptions import BadRequestError, ResourceNotFoundError, StorageError
from shared.structured_logger import get_logger

from app.core.config import get_settings
from app.models.schemas import PLAN_LIMITS

log = get_logger("auth.tenant")
_settings = get_settings()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class TenantService:
    def __init__(self, table=None) -> None:
        ddb = boto3.resource("dynamodb", region_name=_settings.cognito_region)
        self._t = table or ddb.Table(_settings.tenant_table)

    # ── Reads ─────────────────────────────────────────────────────────

    def get(self, tenant_id: str) -> dict:
        try:
            resp = self._t.get_item(Key={"tenantId": tenant_id})
        except ClientError as exc:
            raise StorageError("Could not read tenant") from exc
        item = resp.get("Item")
        if not item:
            raise ResourceNotFoundError("Tenant", tenant_id)
        return item

    def list_all(self) -> list[dict]:
        try:
            resp = self._t.scan()
        except ClientError as exc:
            raise StorageError("Could not list tenants") from exc
        return resp.get("Items", [])

    # ── Writes ────────────────────────────────────────────────────────

    def create(
        self,
        company_name: str,
        email: str,
        plan_tier: str = "starter",
    ) -> dict:
        if not company_name:
            raise BadRequestError("companyName is required")

        tenant_id = str(uuid.uuid4())
        now = _now()
        item = {
            "tenantId":        tenant_id,
            "companyName":     company_name,
            "email":           email,
            "isActive":        True,
            "planTier":        plan_tier,
            "maxRestaurants":  PLAN_LIMITS.get(plan_tier, 1),
            "restaurantCount": 0,
            "createdAt":       now,
            "updatedAt":       now,
        }
        try:
            self._t.put_item(Item=item)
        except ClientError as exc:
            raise StorageError("Could not create tenant") from exc

        log.info("tenant.created", tenant_id=tenant_id,
                 company=company_name, plan=plan_tier)
        return item

    def update(self, tenant_id: str, changes: dict) -> dict:
        self.get(tenant_id)  # 404 guard

        allowed = {"companyName", "isActive", "planTier"}
        updates = {k: v for k, v in changes.items() if k in allowed and v is not None}
        if not updates:
            raise BadRequestError("No updatable fields provided")

        # Changing the plan also changes the restaurant allowance.
        if "planTier" in updates:
            updates["maxRestaurants"] = PLAN_LIMITS.get(updates["planTier"], 1)

        updates["updatedAt"] = _now()

        names = {f"#f{i}": k for i, k in enumerate(updates)}
        values = {f":v{i}": v for i, v in enumerate(updates.values())}
        expr = "SET " + ", ".join(f"#f{i} = :v{i}" for i in range(len(updates)))

        try:
            resp = self._t.update_item(
                Key={"tenantId": tenant_id},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
                ReturnValues="ALL_NEW",
            )
        except ClientError as exc:
            raise StorageError("Could not update tenant") from exc

        log.info("tenant.updated", tenant_id=tenant_id, fields=list(updates))
        return resp.get("Attributes", {})

    def delete(self, tenant_id: str) -> None:
        self.get(tenant_id)  # 404 guard
        try:
            self._t.delete_item(Key={"tenantId": tenant_id})
        except ClientError as exc:
            raise StorageError("Could not delete tenant") from exc
        log.info("tenant.deleted", tenant_id=tenant_id)

    # ── Plan limits ───────────────────────────────────────────────────

    def can_add_restaurant(self, tenant_id: str) -> tuple[bool, str]:
        """
        Returns (allowed, reason). Used by menu_svc before creating a restaurant.
        """
        tenant = self.get(tenant_id)
        if not tenant.get("isActive", True):
            return False, "Tenant account is suspended"

        max_r = int(tenant.get("maxRestaurants", 1))
        if max_r == -1:
            return True, ""

        count = int(tenant.get("restaurantCount", 0))
        if count >= max_r:
            return False, (
                f"Plan limit reached ({count}/{max_r} restaurants). "
                f"Upgrade your plan to add more."
            )
        return True, ""

    def adjust_restaurant_count(self, tenant_id: str, delta: int) -> None:
        """Increment/decrement restaurantCount. Never lets it go below zero."""
        try:
            self._t.update_item(
                Key={"tenantId": tenant_id},
                UpdateExpression="SET restaurantCount = if_not_exists(restaurantCount, :z) + :d, updatedAt = :u",
                ExpressionAttributeValues={":d": delta, ":z": 0, ":u": _now()},
            )
        except ClientError as exc:
            log.warning("tenant.count.adjust_failed",
                        tenant_id=tenant_id, delta=delta,
                        error=exc.response["Error"]["Code"])
            return

        # Clamp negatives (a delete racing another delete).
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
