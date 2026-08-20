"""
app.schemas.subscription
=========================
Pydantic schemas for subscription management.

API request / response envelopes
--------------------------------
• SubscriptionCreate - Incoming request body for subscribing to a plan
• SubscriptionResponse - Outgoing response envelope

Response Fields
---------------
• tenant_id: String
• plan_id: String
• status: String (ACTIVE|EXPIRED|CANCELLED|PENDING|INACTIVE)
• start_date: ISO timestamp
• end_date: ISO timestamp
• is_active: Boolean (calculated from status and current time)
• days_remaining: Integer (calculated days until expiration)

Notes
-----
• days_remaining is calculated dynamically (not stored in DB)
• is_active is denormalized for frontend convenience
• These are thin wrappers used by handlers — not stored in DynamoDB
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SubscriptionCreate(BaseModel):
    plan_id: str


class SubscriptionResponse(BaseModel):
    tenant_id: str
    plan_id: str
    status: str
    start_date: datetime
    end_date: datetime
    is_active: bool
    days_remaining: Optional[int] = None
    
    class Config:
        from_attributes = True