"""
app.repositories.subscription_repository
=========================================
SubscriptionRepository — DynamoDB CRUD operations on TenantSubscriptionTable.
"""

from datetime import datetime, timezone
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from shared.exceptions import StorageError
from shared.structured_logger import get_logger

from app.core.config import get_settings
from app.models.subscription import Subscription


log = get_logger("subscription.repository")
_settings = get_settings()


def _format_datetime(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.isoformat()


def _parse_datetime(dt_str: str) -> datetime:
    return datetime.fromisoformat(
        dt_str.replace("Z", "+00:00")
    )


class SubscriptionRepository:
    def __init__(self, table=None):
        if table:
            self.table = table
        else:
            ddb = boto3.resource(
                "dynamodb",
                region_name=_settings.COGNITO_REGION,
            )

            self.table = ddb.Table(
                _settings.SUBSCRIPTION_TABLE
            )

    # =========================================================
    # CREATE SUBSCRIPTION
    # =========================================================

    def create_subscription(
        self,
        subscription: Subscription,
    ) -> Subscription:

        item = {
            "PK": f"TENANTSUB#{subscription.tenant_id}",
            "SK": f"SUB#{subscription.subscription_id}",

            "tenantId": subscription.tenant_id,
            "subscriptionId": subscription.subscription_id,
            "planId": subscription.plan_id,

            "status": subscription.status,

            "startDate": _format_datetime(
                subscription.start_date
            ),
            "endDate": _format_datetime(
                subscription.end_date
            ),

            "paymentId": subscription.payment_id,
            "paymentStatus": subscription.payment_status,

            "createdAt": _format_datetime(
                subscription.created_at
            ),
            "updatedAt": _format_datetime(
                subscription.updated_at
            ),
        }

        try:
            self.table.put_item(
                Item=item
            )

        except ClientError as exc:
            raise StorageError(
                "Failed to record subscription"
            ) from exc

        return subscription

    # =========================================================
    # GET LATEST SUBSCRIPTION
    # =========================================================

    def get_latest_subscription(
        self,
        tenant_id: str,
    ) -> Optional[Subscription]:

        """Get the most recent subscription for a tenant."""

        try:
            response = self.table.query(
                KeyConditionExpression="PK = :pk",

                ExpressionAttributeValues={
                    ":pk": f"TENANTSUB#{tenant_id}"
                },

                ScanIndexForward=False,
                Limit=1,
            )

        except ClientError as exc:
            raise StorageError(
                "Failed to query subscription history"
            ) from exc

        items = response.get(
            "Items",
            [],
        )

        if not items:
            return None

        item = items[0]

        return Subscription(
            tenant_id=item["tenantId"],
            subscription_id=item["subscriptionId"],
            plan_id=item["planId"],
            status=item["status"],

            start_date=_parse_datetime(
                item["startDate"]
            ),

            end_date=_parse_datetime(
                item["endDate"]
            ),

            payment_id=item.get(
                "paymentId"
            ),

            payment_status=item.get(
                "paymentStatus",
                "PENDING",
            ),

            created_at=_parse_datetime(
                item["createdAt"]
            ),

            updated_at=_parse_datetime(
                item["updatedAt"]
            ),
        )

    # =========================================================
    # UPDATE SUBSCRIPTION STATUS
    # =========================================================

    def update_subscription_status(
        self,
        tenant_id: str,
        status: str,
        payment_status: Optional[str] = None,
    ) -> None:

        """Update the latest subscription status."""

        latest = self.get_latest_subscription(
            tenant_id
        )

        if not latest:
            return

        now_str = _format_datetime(
            datetime.now(timezone.utc)
        )

        update_expr = (
            "SET #status = :status, "
            "#updatedAt = :updatedAt"
        )

        expr_attrs = {
            "#status": "status",
            "#updatedAt": "updatedAt",
        }

        expr_vals = {
            ":status": status,
            ":updatedAt": now_str,
        }

        if payment_status:

            update_expr += (
                ", #paymentStatus = :paymentStatus"
            )

            expr_attrs[
                "#paymentStatus"
            ] = "paymentStatus"

            expr_vals[
                ":paymentStatus"
            ] = payment_status

        try:
            self.table.update_item(
                Key={
                    "PK": f"TENANTSUB#{tenant_id}",
                    "SK": (
                        f"SUB#"
                        f"{latest.subscription_id}"
                    ),
                },

                UpdateExpression=update_expr,

                ExpressionAttributeNames=expr_attrs,

                ExpressionAttributeValues=expr_vals,
            )

        except ClientError as exc:
            raise StorageError(
                "Failed to update subscription status"
            ) from exc

    # =========================================================
    # DELETE SUBSCRIPTION
    # =========================================================

    def delete_subscription(
        self,
        tenant_id: str,
        subscription_id: str,
    ) -> None:

        """Permanently delete a subscription from DynamoDB."""

        try:
            self.table.delete_item(
                Key={
                    "PK": f"TENANTSUB#{tenant_id}",
                    "SK": f"SUB#{subscription_id}",
                }
            )

            log.info(
                "subscription.deleted",
                tenant_id=tenant_id,
                subscription_id=subscription_id,
            )

        except ClientError as exc:
            raise StorageError(
                "Failed to delete subscription"
            ) from exc