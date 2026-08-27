"""
app.schemas.subscription
========================

Pydantic schemas for subscription management.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SubscriptionCreate(BaseModel):
    plan_id: str = Field(..., min_length=1)


class SubscriptionResponse(BaseModel):
    tenant_id: str
    plan_id: str
    status: str

    subscriptionStartDate: datetime
    subscriptionEndDate: datetime

    is_active: bool
    days_remaining: Optional[int] = None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )