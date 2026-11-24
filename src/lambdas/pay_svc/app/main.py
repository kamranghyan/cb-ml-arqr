from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.api.v1.endpoints import payments


app = FastAPI(
    title="Payment Service API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://cb-ml-dev-ml-guest-ui.s3-website.ap-south-1.amazonaws.com",
        "http://cb-ml-dev-ml-admin-ui.s3-website.ap-south-1.amazonaws.com",
        "http://cb-ml-dev-ml-kds-ui.s3-website.ap-south-1.amazonaws.com",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(payments.router, prefix="/payment", tags=["Payments"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "payment-svc"}


handler = Mangum(app)