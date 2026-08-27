"""
app.repositories.tenant_repository
===================================
TenantRepository — DynamoDB CRUD operations on TenantTable.
"""

import boto3
from typing import Optional, List, Union
from datetime import datetime

from app.core.config import settings
from app.models.tenant import Tenant


class TenantRepository:
    def __init__(self):
        self.table = boto3.resource("dynamodb").Table(
            settings.TENANT_TABLE
        )

    @staticmethod
    def _to_iso_str(
        value: Optional[Union[datetime, str]]
    ) -> Optional[str]:
        """Safely return ISO string for datetime, string, or None."""
        if isinstance(value, datetime):
            return value.isoformat()

        return value

    # ─────────────────────────────────────────────────────────────
    # Get Tenant
    # ─────────────────────────────────────────────────────────────

    def get_tenant(
        self,
        tenant_id: str,
    ) -> Optional[Tenant]:

        try:
            response = self.table.get_item(
                Key={"tenantId": tenant_id}
            )

            item = response.get("Item")

            if not item:
                return None

            # Debug missing fields instead of crashing with KeyError
            print(
                "========== TENANT REPOSITORY DEBUG =========="
            )
            print("Tenant ID:", tenant_id)
            print("Tenant item:", item)
            print("==============================================")

            now = datetime.utcnow().isoformat()

            return Tenant(
                tenant_id=item.get("tenantId", tenant_id),

                # IMPORTANT:
                # Do not use item["email"]
                # because old DynamoDB records may not have email.
                email=item.get("email", ""),

                name=(
                    item.get("name")
                    or item.get("tenant_name")
                    or item.get("companyName")
                    or "Unknown Tenant"
                ),

                # Do not use item["companyName"]
                # because it may be missing.
                company_name=(
                    item.get("companyName")
                    or item.get("company_name")
                    or ""
                ),

                role=item.get(
                    "role",
                    "tenant"
                ),

                subscription_status=item.get(
                    "subscriptionStatus",
                    "INACTIVE"
                ),

                current_plan_id=item.get(
                    "currentPlanId"
                ),

                subscription_start_date=item.get(
                    "subscriptionStartDate"
                ),

                subscription_end_date=item.get(
                    "subscriptionEndDate"
                ),

                subscription_is_active=item.get(
                    "subscriptionIsActive",
                    False
                ),

                created_at=item.get(
                    "createdAt",
                    now
                ),

                updated_at=item.get(
                    "updatedAt",
                    now
                ),
            )

        except Exception as e:
            print(
                f"❌ Error getting tenant "
                f"{tenant_id}: {repr(e)}"
            )
            raise

    # ─────────────────────────────────────────────────────────────
    # Update Tenant Subscription
    # ─────────────────────────────────────────────────────────────

    def update_tenant_subscription(
        self,
        tenant_id: str,
        subscription_data: dict,
    ):
        """Update tenant subscription information."""

        update_expression = (
            "SET #status = :status, "
            "#planId = :planId, "
            "#startDate = :startDate, "
            "#endDate = :endDate, "
            "#isActive = :isActive, "
            "#updatedAt = :updatedAt"
        )

        expression_attrs = {
            "#status": "subscriptionStatus",
            "#planId": "currentPlanId",
            "#startDate": "subscriptionStartDate",
            "#endDate": "subscriptionEndDate",
            "#isActive": "subscriptionIsActive",
            "#updatedAt": "updatedAt",
        }

        expression_vals = {
            ":status": subscription_data.get(
                "status",
                "INACTIVE"
            ),

            ":planId": subscription_data.get(
                "plan_id"
            ),

            ":startDate": self._to_iso_str(
                subscription_data.get("start_date")
            ),

            ":endDate": self._to_iso_str(
                subscription_data.get("end_date")
            ),

            ":isActive": subscription_data.get(
                "is_active",
                False
            ),

            ":updatedAt": datetime.utcnow().isoformat(),
        }

        self.table.update_item(
            Key={"tenantId": tenant_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attrs,
            ExpressionAttributeValues=expression_vals,
        )

    # ─────────────────────────────────────────────────────────────
    # Update Subscription Status
    # ─────────────────────────────────────────────────────────────

    def update_subscription_status(
        self,
        tenant_id: str,
        status: str,
        is_active: bool,
    ):
        """Quickly update tenant subscription status."""

        self.table.update_item(
            Key={"tenantId": tenant_id},
            UpdateExpression=(
                "SET #status = :status, "
                "#isActive = :isActive, "
                "#updatedAt = :updatedAt"
            ),
            ExpressionAttributeNames={
                "#status": "subscriptionStatus",
                "#isActive": "subscriptionIsActive",
                "#updatedAt": "updatedAt",
            },
            ExpressionAttributeValues={
                ":status": status,
                ":isActive": is_active,
                ":updatedAt": datetime.utcnow().isoformat(),
            },
        )

    # ─────────────────────────────────────────────────────────────
    # Expiring Subscriptions
    # ─────────────────────────────────────────────────────────────

    def get_tenants_with_expiring_subscriptions(
        self,
    ) -> List[dict]:
        """Get tenants whose subscriptions have expired."""

        try:
            response = self.table.scan(
                FilterExpression=(
                    "subscriptionIsActive = :active "
                    "AND subscriptionEndDate < :now"
                ),
                ExpressionAttributeValues={
                    ":active": True,
                    ":now": datetime.utcnow().isoformat(),
                },
            )

            return response.get("Items", [])

        except Exception as e:
            print(
                f"❌ Error scanning tenants: {repr(e)}"
            )
            return []

    # ─────────────────────────────────────────────────────────────
    # Create Tenant
    # ─────────────────────────────────────────────────────────────

    def create_tenant(
        self,
        tenant: Tenant,
    ) -> Tenant:
        """Create a new tenant."""

        now = datetime.utcnow().isoformat()

        item = {
            "tenantId": tenant.tenant_id,
            "email": tenant.email or "",
            "name": tenant.name or "Unknown Tenant",
            "companyName": tenant.company_name or "",
            "role": tenant.role or "tenant",

            "subscriptionStatus": (
                tenant.subscription_status
                or "INACTIVE"
            ),

            "currentPlanId": tenant.current_plan_id,

            "subscriptionStartDate": self._to_iso_str(
                tenant.subscription_start_date
            ),

            "subscriptionEndDate": self._to_iso_str(
                tenant.subscription_end_date
            ),

            "subscriptionIsActive": (
                tenant.subscription_is_active
                or False
            ),

            "createdAt": (
                self._to_iso_str(tenant.created_at)
                or now
            ),

            "updatedAt": (
                self._to_iso_str(tenant.updated_at)
                or now
            ),
        }

        self.table.put_item(Item=item)

        return tenant

    # ─────────────────────────────────────────────────────────────
    # Update Tenant
    # ─────────────────────────────────────────────────────────────

    def update_tenant(
        self,
        tenant_id: str,
        updates: dict,
    ) -> bool:
        """Update tenant details."""

        if not updates:
            return False

        update_expressions = []
        expression_attrs = {}
        expression_vals = {}

        for key, value in updates.items():

            update_expressions.append(
                f"#{key} = :{key}"
            )

            expression_attrs[f"#{key}"] = key

            expression_vals[f":{key}"] = (
                self._to_iso_str(value)
            )

        update_expressions.append(
            "#updatedAt = :updatedAt"
        )

        expression_attrs["#updatedAt"] = "updatedAt"

        expression_vals[
            ":updatedAt"
        ] = datetime.utcnow().isoformat()

        update_expression = (
            "SET "
            + ", ".join(update_expressions)
        )

        self.table.update_item(
            Key={"tenantId": tenant_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attrs,
            ExpressionAttributeValues=expression_vals,
        )

        return True

    # ─────────────────────────────────────────────────────────────
    # Delete Tenant
    # ─────────────────────────────────────────────────────────────

    def delete_tenant(
        self,
        tenant_id: str,
    ) -> bool:
        """Soft delete tenant."""

        return self.update_tenant(
            tenant_id,
            {"isActive": False},
        )