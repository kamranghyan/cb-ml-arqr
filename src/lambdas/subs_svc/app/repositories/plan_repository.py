"""
app.repositories.plan_repository
=================================
PlanRepository — DynamoDB CRUD operations on PlanTypesTable.

Migrated from single-table to dedicated PlanTypesTable:
    PlanTypesTable-{Environment}
    PK = PLAN#{planId}
    SK = METADATA

Methods
-------
• create_plan() - Insert a new plan tier
• get_plan() - Retrieve plan by plan_id
• list_plans() - Retrieve all plans (optionally active only)
• update_plan() - Update plan details
• delete_plan() - Soft delete (set isActive=False)

Notes for the new model
-----------------------
• Plan IDs are restricted to predefined values (weekly, monthly, etc.)
• Soft delete preserves plan history for past subscriptions
• Price is stored for Payment SVC integration
"""

import boto3
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
from app.core.config import settings
from app.models.plan import Plan


class PlanRepository:
    def __init__(self):
        self.table = boto3.resource('dynamodb').Table(settings.PLAN_TABLE)
    
    def create_plan(self, plan: Plan) -> Plan:
        item = {
            "PK": f"PLAN#{plan.plan_id}",
            "SK": "METADATA",
            "planId": plan.plan_id,
            "planName": plan.plan_name,
            "durationDays": plan.duration_days,
            "price": Decimal(str(plan.price)),  # Convert float to Decimal for DynamoDB
            "currency": plan.currency,
            "description": plan.description,
            "isActive": plan.is_active,
            "createdAt": plan.created_at.isoformat(),
            "updatedAt": plan.updated_at.isoformat()
        }
        self.table.put_item(Item=item)
        return plan
    
    def get_plan(self, plan_id: str) -> Optional[Plan]:
        response = self.table.get_item(
            Key={"PK": f"PLAN#{plan_id}", "SK": "METADATA"}
        )
        item = response.get("Item")
        if not item:
            return None
        
        return Plan(
            plan_id=item["planId"],
            plan_name=item["planName"],
            duration_days=item["durationDays"],
            price=float(item["price"]),  # Convert Decimal back to float for domain model
            currency=item.get("currency", "USD"),
            description=item.get("description"),
            is_active=item.get("isActive", True),
            created_at=datetime.fromisoformat(item["createdAt"]),
            updated_at=datetime.fromisoformat(item["updatedAt"])
        )
    
    def list_plans(self, active_only: bool = True) -> List[Plan]:
        response = self.table.scan()  # Used scan instead of query on 'PLAN#' prefix without a GSI
        
        items = response.get("Items", [])
        plans = []
        for item in items:
            if active_only and not item.get("isActive", True):
                continue
            plans.append(Plan(
                plan_id=item["planId"],
                plan_name=item["planName"],
                duration_days=item["durationDays"],
                price=float(item["price"]),  # Convert Decimal back to float for domain model
                currency=item.get("currency", "USD"),
                description=item.get("description"),
                is_active=item.get("isActive", True),
                created_at=datetime.fromisoformat(item["createdAt"]),
                updated_at=datetime.fromisoformat(item["updatedAt"])
            ))
        return plans
    
    def update_plan(self, plan_id: str, updates: dict) -> bool:
        """Update plan details"""
        if not updates:
            return False

        update_expressions = []
        expression_attrs = {}
        expression_vals = {}
        
        for key, value in updates.items():
            if value is None:
                continue
            update_expressions.append(f"#{key} = :{key}")
            expression_attrs[f"#{key}"] = key
            
            # Convert float to Decimal for DynamoDB updates
            if isinstance(value, float):
                expression_vals[f":{key}"] = Decimal(str(value))
            else:
                expression_vals[f":{key}"] = value
        
        update_expressions.append("#updatedAt = :updatedAt")
        expression_attrs["#updatedAt"] = "updatedAt"
        expression_vals[":updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_expression = "SET " + ", ".join(update_expressions)
        
        self.table.update_item(
            Key={"PK": f"PLAN#{plan_id}", "SK": "METADATA"},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attrs,
            ExpressionAttributeValues=expression_vals
        )
        return True
    
    def delete_plan(self, plan_id: str) -> bool:
        """Permanently delete plan from DynamoDB."""
        self.table.delete_item(
           Key={
            "PK": f"PLAN#{plan_id}",
            "SK": "METADATA",
           }
        )
        return True