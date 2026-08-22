import logging
from fastapi import APIRouter, Request, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr, Field
from app.services.easypaisa_service import EasyPaisaService
from app.services.payment_db_service import PaymentDbService
from app.services.eventbridge_service import EventBridgeService

logger = logging.getLogger(__name__)
router = APIRouter()


class InitiatePaymentRequest(BaseModel):
    order_id: str = Field(..., example="MS5007")
    amount: float = Field(..., gt=0, example=12.00)
    mobile_no: str = Field(..., example="03458508726")
    email: EmailStr = Field(..., example="testEmail@gmail.com")
    tenant_id: str = Field(..., example="1c71a684-c20f-411b-9cd6-45ab2f24413b")
    plan_id: str = Field(..., example="PLAN#starter")


class InquirePaymentRequest(BaseModel):
    order_id: str = Field(..., example="abc123")


@router.post("/initiate", status_code=status.HTTP_201_CREATED)
async def initiate_payment(
    payload: InitiatePaymentRequest,
    easypaisa_svc: EasyPaisaService = Depends(),
    db_svc: PaymentDbService = Depends(),
    event_svc: EventBridgeService = Depends(),
):
    try:
        # 1. Create initial PENDING record in DynamoDB
        db_svc.create_payment_record(
            order_id=payload.order_id,
            tenant_id=payload.tenant_id,
            plan_id=payload.plan_id,
            amount=payload.amount,
            email=payload.email,
            mobile_no=payload.mobile_no,
            status="PENDING",
        )

        # 2. Invoke Easypaisa Direct MA API directly
        res_data = await easypaisa_svc.initiate_ma_transaction(
            order_id=payload.order_id,
            amount=payload.amount,
            mobile_no=payload.mobile_no,
            email=payload.email,
        )

        response_code = res_data.get("responseCode")

        # 3. Synchronous Response Handling
        if response_code == "0000":
            transaction_id = res_data.get("transactionId", "N/A")

            db_svc.update_payment_status(
                order_id=payload.order_id,
                status="SUCCESS",
                transaction_id=transaction_id,
                raw_response=res_data,
            )

            event_svc.publish_payment_succeeded(
                tenant_id=payload.tenant_id,
                plan_id=payload.plan_id,
                order_id=payload.order_id,
                amount=payload.amount,
            )

            return {
                "status": "SUCCESS",
                "message": "Payment processed successfully",
                "order_id": payload.order_id,
                "data": res_data,
            }
        else:
            db_svc.update_payment_status(
                order_id=payload.order_id,
                status="FAILED",
                raw_response=res_data,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment failed: {res_data.get('responseDesc')}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error initiating payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate payment: {str(e)}",
        )


@router.post("/callback")
async def easypaisa_callback(
    request: Request,
    db_svc: PaymentDbService = Depends(),
    event_svc: EventBridgeService = Depends(),
):
    """Handles asynchronous payment callback payloads sent by Easypaisa."""
    try:
        # Safely parse body based on content-type without triggering request.form()
        content_type = request.headers.get("content-type", "")

        if "application/json" in content_type:
            payload = await request.json()
        else:
            # Fallback: Parse raw body string or URL-encoded bytes safely
            body_bytes = await request.body()
            body_str = body_bytes.decode("utf-8")

            try:
                import json

                payload = json.loads(body_str)
            except Exception:
                from urllib.parse import parse_qs

                parsed = parse_qs(body_str)
                payload = {k: v[0] for k, v in parsed.items()}

        logger.info(f"[EASYPAISA] Callback Received: {payload}")

        order_id = payload.get("orderId") or payload.get("order_id")
        response_code = payload.get("responseCode") or payload.get(
            "response_code"
        )

        if not order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing orderId in callback payload",
            )

        existing_record = db_svc.get_payment_by_order_id(order_id)
        if not existing_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if existing_record.get("status") == "SUCCESS":
            return {"status": "ACKNOWLEDGE", "message": "Already processed"}

        if response_code == "0000":
            transaction_id = payload.get("transactionId", "N/A")

            db_svc.update_payment_status(
                order_id=order_id,
                status="SUCCESS",
                transaction_id=transaction_id,
                raw_response=payload,
            )

            event_svc.publish_payment_succeeded(
                tenant_id=existing_record["tenantId"],
                plan_id=existing_record["planId"],
                order_id=order_id,
                amount=float(
                    payload.get(
                        "transactionAmount", existing_record.get("amount", 0.0)
                    )
                ),
            )
        else:
            db_svc.update_payment_status(
                order_id=order_id,
                status="FAILED",
                transaction_id=payload.get("transactionId"),
                raw_response=payload,
            )

        return {"status": "ACKNOWLEDGE"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error processing callback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process callback: {str(e)}",
        )@router.post("/callback")
async def easypaisa_callback(
    request: Request,
    db_svc: PaymentDbService = Depends(),
    event_svc: EventBridgeService = Depends(),
):
    """Handles asynchronous payment callback payloads sent by Easypaisa."""
    try:
        # Safely parse body based on content-type without triggering request.form()
        content_type = request.headers.get("content-type", "")

        if "application/json" in content_type:
            payload = await request.json()
        else:
            # Fallback: Parse raw body string or URL-encoded bytes safely
            body_bytes = await request.body()
            body_str = body_bytes.decode("utf-8")

            try:
                import json

                payload = json.loads(body_str)
            except Exception:
                from urllib.parse import parse_qs

                parsed = parse_qs(body_str)
                payload = {k: v[0] for k, v in parsed.items()}

        logger.info(f"[EASYPAISA] Callback Received: {payload}")

        order_id = payload.get("orderId") or payload.get("order_id")
        response_code = payload.get("responseCode") or payload.get(
            "response_code"
        )

        if not order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing orderId in callback payload",
            )

        existing_record = db_svc.get_payment_by_order_id(order_id)
        if not existing_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if existing_record.get("status") == "SUCCESS":
            return {"status": "ACKNOWLEDGE", "message": "Already processed"}

        if response_code == "0000":
            transaction_id = payload.get("transactionId", "N/A")

            db_svc.update_payment_status(
                order_id=order_id,
                status="SUCCESS",
                transaction_id=transaction_id,
                raw_response=payload,
            )

            event_svc.publish_payment_succeeded(
                tenant_id=existing_record["tenantId"],
                plan_id=existing_record["planId"],
                order_id=order_id,
                amount=float(
                    payload.get(
                        "transactionAmount", existing_record.get("amount", 0.0)
                    )
                ),
            )
        else:
            db_svc.update_payment_status(
                order_id=order_id,
                status="FAILED",
                transaction_id=payload.get("transactionId"),
                raw_response=payload,
            )

        return {"status": "ACKNOWLEDGE"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error processing callback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process callback: {str(e)}",
        )


@router.post("/inquire")
async def inquire_payment_post(
    payload: InquirePaymentRequest,
    easypaisa_svc: EasyPaisaService = Depends(),
):
    """
    POST endpoint to inquire payment status via JSON body.
    """
    res_data = await easypaisa_svc.inquire_transaction(payload.order_id)
    return {"status": "SUCCESS", "data": res_data}


@router.get("/inquire/{order_id}")
async def inquire_payment_get(
    order_id: str,
    easypaisa_svc: EasyPaisaService = Depends(),
):
    """
    GET endpoint to check payment status directly via URL parameter.
    """
    res_data = await easypaisa_svc.inquire_transaction(order_id)
    return {"status": "SUCCESS", "data": res_data}