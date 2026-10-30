# app/schemas/payment.py

from pydantic import BaseModel, Field

class PaymentInitiateRequest(BaseModel):
    tenantId: str
    planId: str
    amount: float = Field(..., gt=0)
    orderId: str
    email: str
    mobileNo: str