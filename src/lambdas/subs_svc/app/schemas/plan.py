"""
app.schemas.plan
=================
Pydantic schemas for plan management.

API request / response envelopes
--------------------------------
• PlanCreate - Incoming request body for creating a plan
• PlanUpdate - Incoming request body for updating a plan
• PlanResponse - Outgoing response envelope (not stored in DynamoDB)

Validation Rules
----------------
• plan_id: Must be one of [weekly, monthly, quarterly, semi_annual, annual]
• duration_days: Must be > 0
• price: Must be >= 0
• currency: Defaults to "USD"

Notes
-----
• These are thin wrappers used by handlers — not stored in DynamoDB
• Pydantic automatically validates data types and constraints
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class PlanCreate(BaseModel):
    plan_id: str
    plan_name: str
    duration_days: int = Field(..., gt=0)
    price: float = Field(..., ge=0)
    currency: str = "USD"
    description: Optional[str] = None
    
    @field_validator('plan_id')
    @classmethod
    def validate_plan_id(cls, v: str) -> str:
        allowed = ['weekly', 'monthly', 'quarterly', 'semi_annual', 'annual']
        if v not in allowed:
            raise ValueError(f'plan_id must be one of: {", ".join(allowed)}')
        return v


class PlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    duration_days: Optional[int] = Field(None, gt=0)
    price: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PlanResponse(BaseModel):
    plan_id: str
    plan_name: str
    duration_days: int
    price: float
    currency: str
    description: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True