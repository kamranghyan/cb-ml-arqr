"""
app.repositories.payment_repository
===================================
PaymentRepository — DynamoDB CRUD operations for PaymentTable.

Table: PaymentTable-{Environment}
PK: orderId (string)
"""

import boto3
from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from app.core.config import settings


class PaymentRepository:
    def __init__(self):
        self.table = boto3.resource('dynamodb').Table(settings.PAYMENT_TABLE)

    def create_payment_record(
        self, 
        order_id: str, 
        tenant_id: str, 
        plan_id: str, 
        amount: float
    ) -> Dict[str, Any]:
        """Create an initial payment record with status INITIATED."""
        now = datetime.utcnow().isoformat()
        item = {
            "orderId": order_id,
            "tenantId": tenant_id,
            "planId": plan_id,
            "amount": Decimal(str(amount)),
            "status": "INITIATED",
            "createdAt": now,
            "updatedAt": now
        }
        self.table.put_item(Item=item)
        return item

    def get_payment(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a payment record by orderId."""
        response = self.table.get_item(Key={"orderId": order_id})
        item = response.get("Item")
        if not item:
            return None
        
        # Convert Decimal amount back to float for app usage
        if "amount" in item and isinstance(item["amount"], Decimal):
            item["amount"] = float(item["amount"])
            
        return item

    def update_payment_status(
        self, 
        order_id: str, 
        status: str, 
        transaction_id: Optional[str] = None, 
        raw_response: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update transaction status, provider transaction ID, and full callback raw payload."""
        now = datetime.utcnow().isoformat()
        
        update_expression = "SET #status = :status, #updatedAt = :updatedAt"
        expression_attrs = {
            "#status": "status",
            "#updatedAt": "updatedAt"
        }
        expression_vals = {
            ":status": status,
            ":updatedAt": now
        }

        if transaction_id:
            update_expression += ", #txId = :txId"
            expression_attrs["#txId"] = "transactionId"
            expression_vals[":txId"] = transaction_id

        if raw_response:
            update_expression += ", #raw = :raw"
            expression_attrs["#raw"] = "rawResponse"
            expression_vals[":raw"] = raw_response

        self.table.update_item(
            Key={"orderId": order_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attrs,
            ExpressionAttributeValues=expression_vals
        )
        return True