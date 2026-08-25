from fastapi import FastAPI
from mangum import Mangum

from app.api.v1.endpoints import payments


app = FastAPI(
    title="Payment Service API",
    version="1.0.0",
)


app.include_router(
    payments.router,
    prefix="/payment",
    tags=["Payments"],
)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "payment-svc",
    }


handler = Mangum(app)