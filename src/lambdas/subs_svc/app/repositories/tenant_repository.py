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
        self.table = boto3.resource('dynamodb').Table(settings.TENANT_TABLE)

    @staticmethod
    def _to_iso_str(value: Optional[Union[datetime, str]]) -> Optional[str]:
        """Safely returns ISO string whether value is datetime, str, or None."""
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        response = self.table.get_item(Key={"tenantId": tenant_id})
        item = response.get("Item")
        if not item:
            return None
        
        return Tenant(
            tenant_id=item["tenantId"],
            email=item["email"],
            name=item.get("name") or item.get("tenant_name") or "Unknown Tenant",
            company_name=item["companyName"],
            role=item.get("role", "tenant"),
            subscription_status=item.get("subscriptionStatus", "INACTIVE"),
            current_plan_id=item.get("currentPlanId"),
            subscription_start_date=item.get("subscriptionStartDate"),
            subscription_end_date=item.get("subscriptionEndDate"),
            subscription_is_active=item.get("subscriptionIsActive", False),
            created_at=item.get("createdAt", datetime.utcnow().isoformat()),
            updated_at=item.get("updatedAt", datetime.utcnow().isoformat())
        )

    def update_tenant_subscription(self, tenant_id: str, subscription_data: dict):
        """Update tenant with subscription info"""
        update_expression = (
            "SET #status = :status, #planId = :planId, "
            "#startDate = :startDate, #endDate = :endDate, "
            "#isActive = :isActive, #updatedAt = :updatedAt"
        )
        
        expression_attrs = {
            "#status": "subscriptionStatus",
            "#planId": "currentPlanId",
            "#startDate": "subscriptionStartDate",
            "#endDate": "subscriptionEndDate",
            "#isActive": "subscriptionIsActive",
            "#updatedAt": "updatedAt"
        }
        
        expression_vals = {
            ":status": subscription_data["status"],
            ":planId": subscription_data.get("plan_id"),
            ":startDate": self._to_iso_str(subscription_data.get("start_date")),
            ":endDate": self._to_iso_str(subscription_data.get("end_date")),
            ":isActive": subscription_data.get("is_active", False),
            ":updatedAt": datetime.utcnow().isoformat()
        }
        
        self.table.update_item(
            Key={"tenantId": tenant_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attrs,
            ExpressionAttributeValues=expression_vals
        )

    def update_subscription_status(self, tenant_id: str, status: str, is_active: bool):
        """Quick update for subscription status"""
        self.table.update_item(
            Key={"tenantId": tenant_id},
            UpdateExpression="SET #status = :status, #isActive = :isActive, #updatedAt = :updatedAt",
            ExpressionAttributeNames={
                "#status": "subscriptionStatus",
                "#isActive": "subscriptionIsActive",
                "#updatedAt": "updatedAt"
            },
            ExpressionAttributeValues={
                ":status": status,
                ":isActive": is_active,
                ":updatedAt": datetime.utcnow().isoformat()
            }
        )

    def get_tenants_with_expiring_subscriptions(self) -> List[dict]:
        """Get tenants whose subscriptions are expiring (for scheduled job)"""
        try:
            response = self.table.scan(
                FilterExpression="subscriptionIsActive = :active AND subscriptionEndDate < :now",
                ExpressionAttributeValues={
                    ":active": True,
                    ":now": datetime.utcnow().isoformat()
                }
            )
            return response.get("Items", [])
        except Exception as e:
            print(f"Error scanning tenants: {str(e)}")
            return []

    def create_tenant(self, tenant: Tenant) -> Tenant:
        """Create a new tenant"""
        item = {
            "tenantId": tenant.tenant_id,
            "email": tenant.email,
            "name": tenant.name,
            "companyName": tenant.company_name,
            "role": tenant.role,
            "subscriptionStatus": tenant.subscription_status,
            "currentPlanId": tenant.current_plan_id,
            "subscriptionStartDate": self._to_iso_str(tenant.subscription_start_date),
            "subscriptionEndDate": self._to_iso_str(tenant.subscription_end_date),
            "subscriptionIsActive": tenant.subscription_is_active,
            "createdAt": self._to_iso_str(tenant.created_at) or datetime.utcnow().isoformat(),
            "updatedAt": self._to_iso_str(tenant.updated_at) or datetime.utcnow().isoformat()
        }
        self.table.put_item(Item=item)
        return tenant

    def update_tenant(self, tenant_id: str, updates: dict) -> bool:
        """Update tenant details"""
        if not updates:
            return False

        update_expressions = []
        expression_attrs = {}
        expression_vals = {}

        for key, value in updates.items():
            update_expressions.append(f"#{key} = :{key}")
            expression_attrs[f"#{key}"] = key
            expression_vals[f":{key}"] = self._to_iso_str(value)

        update_expressions.append("#updatedAt = :updatedAt")
        expression_attrs["#updatedAt"] = "updatedAt"
        expression_vals[":updatedAt"] = datetime.utcnow().isoformat()

        update_expression = "SET " + ", ".join(update_expressions)

        self.table.update_item(
            Key={"tenantId": tenant_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attrs,
            ExpressionAttributeValues=expression_vals
        )
        return True

    def delete_tenant(self, tenant_id: str) -> bool:
        """Soft delete tenant (set inactive)"""
        return self.update_tenant(tenant_id, {"isActive": False})