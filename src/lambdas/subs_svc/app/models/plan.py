"""
app.models.plan
================
Plan model - represents subscription plan tiers.

DynamoDB Schema
---------------
PK: PLAN#weekly
SK: METADATA
planId: string (e.g., "weekly", "monthly")
planName: string (e.g., "Weekly Plan")
durationDays: integer (e.g., 7, 30, 90, 180, 365)
price: float (e.g., 9.99)
currency: string (e.g., "USD")
description: string (optional)
isActive: boolean (soft delete flag)
createdAt: ISO timestamp
updatedAt: ISO timestamp

Notes
-----
• Plan ID must match the predefined set: weekly, monthly, quarterly, semi_annual, annual
• isActive=False means plan is soft-deleted (historical data preserved)
• Price field is used by Payment SVC for billing calculations
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class Plan(BaseModel):
    plan_id: str  # weekly, monthly, quarterly, semi_annual, annual
    plan_name: str
    duration_days: int
    price: float
    currency: str = "USD"
    description: Optional[str] = None
    is_active: bool = True
    whats_included: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }