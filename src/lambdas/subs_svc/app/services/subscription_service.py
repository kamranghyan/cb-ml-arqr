"""
app.services.subscription_service
==================================

Core business logic for subscription management.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from shared.exceptions import ResourceNotFoundError, BadRequestError
from shared.structured_logger import get_logger

from app.repositories.tenant_repository import TenantRepository
from app.repositories.plan_repository import PlanRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.models.subscription import Subscription
from app.schemas.subscription import SubscriptionResponse


log = get_logger("subscription.service")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SubscriptionService:

    def __init__(self):
        self.tenant_repo = TenantRepository()
        self.plan_repo = PlanRepository()
        self.subscription_repo = SubscriptionRepository()

    # ─────────────────────────────────────────────────────────────
    # Create Subscription
    # ─────────────────────────────────────────────────────────────

    def create_subscription(
        self,
        tenant_id: str,
        plan_id: str,
    ) -> SubscriptionResponse:
        """Create a new pending subscription for a tenant."""

        tenant = self.tenant_repo.get_tenant(tenant_id)

        if not tenant:
            raise ResourceNotFoundError(
                "Tenant",
                tenant_id,
            )

        plan = self.plan_repo.get_plan(plan_id)

        if not plan or not plan.is_active:
            raise BadRequestError(
                "Selected plan is either invalid or inactive."
            )

        start_date = _now()

        end_date = start_date + timedelta(
            days=plan.duration_days
        )

        subscription_id = (
            f"{tenant_id}_"
            f"{start_date.strftime('%Y%m%d%H%M%S')}"
        )

        subscription = Subscription(
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            plan_id=plan_id,
            status="PENDING",
            start_date=start_date,
            end_date=end_date,
            payment_status="PENDING",
        )

        self.subscription_repo.create_subscription(
            subscription
        )

        self.tenant_repo.update_tenant_subscription(
            tenant_id,
            {
                "status": "PENDING",
                "plan_id": plan_id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "is_active": False,
            },
        )

        log.info(
            "subscription.created",
            tenant_id=tenant_id,
            sub_id=subscription_id,
            plan_id=plan_id,
        )

        return self._to_response(
            subscription,
            plan_id,
        )

    # ─────────────────────────────────────────────────────────────
    # Activate Subscription
    # ─────────────────────────────────────────────────────────────

    def activate_subscription(
        self,
        tenant_id: str,
        plan_id: str,
        payment_id: str,
    ) -> dict:
        """
        Activate subscription after verified payment.

        This method is intentionally idempotent.
        """

        subscription = (
            self.subscription_repo
            .get_latest_subscription(tenant_id)
        )

        if not subscription:
            raise ResourceNotFoundError(
                "Subscription",
                tenant_id,
            )

        if subscription.plan_id != plan_id:
            raise BadRequestError(
                "Plan ID mismatch for pending subscription."
            )

        # Already active = duplicate webhook/payment event.
        if subscription.status == "ACTIVE":
            log.info(
                "subscription.already_active",
                tenant_id=tenant_id,
                plan_id=plan_id,
                payment_id=payment_id,
            )

            return {
                "status": "success",
                "message": "Subscription already active",
                "tenant_id": tenant_id,
                "plan_id": plan_id,
                "payment_id": payment_id,
                "subscriptionStartDate": (
                    subscription.start_date.isoformat()
                ),
                "subscriptionEndDate": (
                    subscription.end_date.isoformat()
                ),
                "expires_at": subscription.end_date.isoformat(),
            }

        # Only pending subscription can be activated.
        if subscription.status != "PENDING":
            raise BadRequestError(
                f"Cannot activate subscription with status "
                f"{subscription.status}."
            )

        # Mark subscription as paid + active.
        self.subscription_repo.update_subscription_status(
            tenant_id,
            "ACTIVE",
            "PAID",
        )

        # Enable tenant access.
        self.tenant_repo.update_tenant_subscription(
            tenant_id,
            {
                "status": "ACTIVE",
                "plan_id": plan_id,
                "start_date": subscription.start_date.isoformat(),
                "end_date": subscription.end_date.isoformat(),
                "is_active": True,
            },
        )

        log.info(
            "subscription.activated",
            tenant_id=tenant_id,
            plan_id=plan_id,
            payment_id=payment_id,
        )

        return {
            "status": "success",
            "message": "Subscription activated successfully",
            "tenant_id": tenant_id,
            "plan_id": plan_id,
            "payment_id": payment_id,
            "subscriptionStartDate": (
                subscription.start_date.isoformat()
            ),
            "subscriptionEndDate": (
                subscription.end_date.isoformat()
            ),
            "expires_at": subscription.end_date.isoformat(),
        }

    # ─────────────────────────────────────────────────────────────
    # Get Subscription Status
    # ─────────────────────────────────────────────────────────────

    def get_subscription_status(
        self,
        tenant_id: str,
    ) -> SubscriptionResponse:
        """
        Get current subscription status for tenant.
        """

        tenant = self.tenant_repo.get_tenant(tenant_id)

        if not tenant:
            raise ResourceNotFoundError(
                "Tenant",
                tenant_id,
            )

        subscription = (
            self.subscription_repo
            .get_latest_subscription(tenant_id)
        )

        # Tenant exists but has no subscription.
        if not subscription:
            now = _now()

            return SubscriptionResponse(
                tenant_id=tenant_id,
                plan_id="",
                status="INACTIVE",
                subscriptionStartDate=now,
                subscriptionEndDate=now,
                is_active=False,
                days_remaining=0,
            )

        # TenantRepository may return either a dict or model.
        if isinstance(tenant, dict):
            current_plan_id = (
                tenant.get("current_plan_id")
                or tenant.get("plan_id")
            )
        else:
            current_plan_id = (
                getattr(
                    tenant,
                    "current_plan_id",
                    None,
                )
                or getattr(
                    tenant,
                    "plan_id",
                    None,
                )
            )

        return self._to_response(
            subscription,
            current_plan_id or subscription.plan_id,
        )

    # ─────────────────────────────────────────────────────────────
    # Delete Subscription
    # ─────────────────────────────────────────────────────────────

    def delete_subscription(
        self,
        tenant_id: str,
    ) -> dict:
        """
        Permanently delete the latest subscription
        and reset tenant subscription information.
        """

        subscription = (
            self.subscription_repo
            .get_latest_subscription(tenant_id)
        )

        if not subscription:
            raise ResourceNotFoundError(
                "Subscription",
                tenant_id,
            )

        # Permanently delete subscription from DynamoDB.
        self.subscription_repo.delete_subscription(
            tenant_id,
            subscription.subscription_id,
        )

        # Reset tenant subscription state.
        self.tenant_repo.update_tenant_subscription(
            tenant_id,
            {
                "status": "INACTIVE",
                "plan_id": None,
                "start_date": None,
                "end_date": None,
                "is_active": False,
            },
        )

        log.info(
            "subscription.permanently_deleted",
            tenant_id=tenant_id,
            subscription_id=subscription.subscription_id,
        )

        return {
            "status": "success",
            "message": "Subscription deleted successfully",
            "tenant_id": tenant_id,
            "subscription_id": subscription.subscription_id,
        }

    # ─────────────────────────────────────────────────────────────
    # Convert Subscription → Response
    # ─────────────────────────────────────────────────────────────

    def _to_response(
        self,
        subscription: Subscription,
        plan_id: Optional[str] = None,
    ) -> SubscriptionResponse:
        """Convert subscription model to response schema."""

        days_remaining = 0

        if subscription.status == "ACTIVE":
            now = _now()

            end_date = subscription.end_date

            if end_date.tzinfo is None:
                end_date = end_date.replace(
                    tzinfo=timezone.utc
                )

            days_remaining = (
                end_date - now
            ).days

            days_remaining = max(
                0,
                days_remaining,
            )

        return SubscriptionResponse(
            tenant_id=subscription.tenant_id,
            plan_id=plan_id or subscription.plan_id,
            status=subscription.status,
            subscriptionStartDate=subscription.start_date,
            subscriptionEndDate=subscription.end_date,
            is_active=subscription.status == "ACTIVE",
            days_remaining=days_remaining,
        )