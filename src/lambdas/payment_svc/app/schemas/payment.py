# app/schemas/payment.py

from pydantic import BaseModel, Field

class PaymentInitiateRequest(BaseModel):
    tenant_id: str
    plan_id: str
    amount: float = Field(..., gt=0)
    order_id: str
    email: str
    mobile_no: str