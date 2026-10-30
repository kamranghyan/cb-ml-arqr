"""
app.services.access_guard
==========================
SubscriptionAccessGuard — Enforces subscription-based access control.
"""

from datetime import datetime, timezone
from typing import Tuple

from shared.exceptions import ForbiddenError
from shared.structured_logger import get_logger

from app.repositories.tenant_repository import TenantRepository
from app.repositories.subscription_repository import SubscriptionRepository

log = get_logger("subscription.access_guard")


class SubscriptionAccessGuard:
    """Guard to check if tenant has active subscription."""

    def __init__(self, tenant_repo=None, subscription_repo=None):
        self.tenant_repo = tenant_repo or TenantRepository()
        self.subscription_repo = subscription_repo or SubscriptionRepository()

    def check_tenant_access(self, tenant_id: str) -> Tuple[bool, str]:
        """
        Check if tenant has active subscription.
        Returns: (has_access, message)
        """
        try:
            tenant = self.tenant_repo.get_tenant(tenant_id)
            if not tenant:
                return False, "Tenant not found"

            # Check subscription flag on tenant
            if not getattr(tenant, "subscription_is_active", False):
                return False, "No active subscription. Please subscribe to a plan."

            # Check expiration date
            end_date_raw = getattr(tenant, "subscription_end_date", None)
            if end_date_raw:
                if isinstance(end_date_raw, str):
                    end_date = datetime.fromisoformat(end_date_raw.replace("Z", "+00:00"))
                else:
                    end_date = end_date_raw

                now = datetime.now(timezone.utc)
                if now > end_date:
                    # Auto-expire inline
                    self.tenant_repo.update_subscription_status(tenant_id, "EXPIRED", False)
                    log.info("subscription.auto_expired", tenant_id=tenant_id)
                    return False, "Subscription has expired. Please renew."

            return True, "Access granted"

        except Exception as exc:  # noqa: BLE001
            log.error("access_guard.check_failed", tenant_id=tenant_id, error=str(exc))
            return False, f"Error checking subscription status: {str(exc)}"

    def require_active_subscription(self, tenant_id: str) -> bool:
        """Raises ForbiddenError if tenant doesn't have an active subscription."""
        has_access, message = self.check_tenant_access(tenant_id)
        if not has_access:
            raise ForbiddenError(message)
        return True