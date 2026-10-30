# app/models/payment.py

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class Payment(BaseModel):
    order_id: str
    tenantId: str
    planId: str
    amount: float
    status: str = "INITIATED"  # INITIATED, SUCCESS, FAILED
    transactionId: Optional[str] = None
    rawResponse: Optional[Dict[str, Any]] = None
    createdAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())