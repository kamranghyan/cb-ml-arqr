"""
app.models.subscription
========================
Subscription model - audit/history of tenant subscriptions.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Subscription(BaseModel):
    tenant_id: str
    subscription_id: str
    plan_id: str
    status: str  # ACTIVE, EXPIRED, CANCELLED, PENDING
    start_date: datetime
    end_date: datetime
    payment_id: Optional[str] = None
    payment_status: str = "PENDING"  # PENDING, PAID, FAILED
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )