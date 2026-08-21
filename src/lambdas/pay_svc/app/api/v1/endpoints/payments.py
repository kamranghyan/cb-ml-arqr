import logging
from fastapi import APIRouter, Request, HTTPException, status, Depends
from app.services.easypaisa_service import EasyPaisaService
from app.services.payment_db_service import PaymentDbService
from app.services.eventbridge_service import EventBridgeService

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/callback")
async def easypaisa_callback(
    request: Request,
    easypaisa_svc: EasyPaisaService = Depends(),
    db_svc: PaymentDbService = Depends(),
    event_svc: EventBridgeService = Depends(),
):
    # 1. Parse incoming form data from EasyPaisa
    form_data = await request.form()
    payload = dict(form_data)
    
    order_id = payload.get("orderId")
    response_code = payload.get("responseCode")
    
    if not order_id:
        logger.error("Callback received without orderId")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Missing orderId"
        )

    # 2. Strict Signature Verification
    if not easypaisa_svc.verify_response_hash(payload):
        logger.warning(f"Unauthorized callback attempt detected for orderId={order_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid signature hash"
        )

    # 3. Retrieve order to check existing state (Idempotency)
    existing_record = db_svc.get_payment_by_order_id(order_id)
    if not existing_record:
        logger.error(f"Callback received for non-existent orderId={order_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Order not found"
        )

    # Prevent duplicate event processing on EasyPaisa retries
    if existing_record.get("status") == "SUCCESS":
        logger.info(f"Duplicate callback received for orderId={order_id}. Already processed.")
        return {"status": "ACKNOWLEDGE", "message": "Already processed"}

    # 4. Handle Successful Payment (EasyPaisa Code "0000")
    if response_code == "0000":
        transaction_id = payload.get("transactionId", "N/A")
        
        # Persist success status in DynamoDB
        db_svc.update_payment_status(
            order_id=order_id,
            status="SUCCESS",
            transaction_id=transaction_id,
            raw_response=payload
        )
        
        # Publish downstream event
        event_svc.publish_payment_succeeded(
            tenant_id=existing_record["tenantId"],
            plan_id=existing_record["planId"],
            order_id=order_id,
            amount=float(payload.get("transactionAmount", 0.0))
        )
        
        logger.info(f"Payment succeeded and event dispatched for orderId={order_id}")

    # 5. Handle Failed / Declined Payment
    else:
        db_svc.update_payment_status(
            order_id=order_id,
            status="FAILED",
            transaction_id=payload.get("transactionId"),
            raw_response=payload
        )
        logger.warning(f"Payment failed for orderId={order_id} with responseCode={response_code}")

    return {"status": "ACKNOWLEDGE"}