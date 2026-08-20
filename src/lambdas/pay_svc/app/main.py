# app/main.py

from fastapi import FastAPI
from mangum import Mangum
from app.api.v1.endpoints import payments

app = FastAPI(title="Payment Service API")

app.include_router(payments.router, prefix="/payments", tags=["Payments"])

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "payment-svc"}

# SAM executes this handler for AWS Lambda
handler = Mangum(app)