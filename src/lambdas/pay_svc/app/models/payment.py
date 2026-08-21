# app/models/payment.py

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class Payment(BaseModel):
    order_id: str
    tenant_id: str
    plan_id: str
    amount: float
    status: str = "INITIATED"  # INITIATED, SUCCESS, FAILED
    transaction_id: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())