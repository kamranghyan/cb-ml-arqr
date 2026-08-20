"""
app.models.tenant
==================
Tenant model - represents restaurant owner/organization.

DynamoDB Schema (Updated for subscription)
-----------------------------------------
PK: tenantId (string)
email: string
name: string
companyName: string
role: string (default: "tenant")

Subscription Fields (NEW)
-------------------------
subscriptionStatus: string (ACTIVE|EXPIRED|CANCELLED|INACTIVE|PENDING)
currentPlanId: string (weekly|monthly|quarterly|semi_annual|annual)
subscriptionStartDate: ISO timestamp (when current subscription started)
subscriptionEndDate: ISO timestamp (when current subscription expires)
subscriptionIsActive: boolean (quick check for access guard)

createdAt: ISO timestamp
updatedAt: ISO timestamp

Notes
-----
• REMOVED: planTier field - now managed by subscription module
• subscriptionIsActive is a denormalized field for fast access checks
• Tenant can create restaurants ONLY when subscriptionIsActive=True
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class Tenant(BaseModel):
    tenant_id: str
    email: str
    name: str
    company_name: str
    role: str = "tenant"
    
    # Subscription fields (NEW)
    subscription_status: str = "INACTIVE"  # ACTIVE, EXPIRED, CANCELLED, INACTIVE, PENDING
    current_plan_id: Optional[str] = None
    subscription_start_date: Optional[datetime] = None
    subscription_end_date: Optional[datetime] = None
    subscription_is_active: bool = False
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }