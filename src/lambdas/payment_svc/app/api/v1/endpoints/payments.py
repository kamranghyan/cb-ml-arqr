# app/api/v1/endpoints/payments.py

from fastapi import APIRouter, Request, HTTPException, status
from lambdas.payment_svc.easypaisa_service import EasyPaisaService
from lambdas.payment_svc.eventbridge_service import EventBridgeService
from app.repositories.payment_repository import PaymentRepository

router = APIRouter()
easypaisa_service = EasyPaisaService()
eventbridge_service = EventBridgeService()
payment_repo = PaymentRepository()

@router.post("/callback")
async def easypaisa_callback(request: Request):
    # Parse form data or JSON sent by Easypaisa
    form_data = await request.form()
    payload = dict(form_data) if form_data else await request.json()

    # 1. Verify response signature
    is_valid = easypaisa_service.verify_response_hash(payload)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature hash from payment provider"
        )

    order_id = payload.get("orderId")
    response_code = payload.get("responseCode")
    transaction_id = payload.get("transactionId")

    # 2. Check payment status (0000 usually indicates success in Easypaisa)
    is_success = response_code == "0000"
    payment_status = "SUCCESS" if is_success else "FAILED"

    # 3. Update payment record in DynamoDB
    payment_repo.update_payment_status(
        order_id=order_id,
        status=payment_status,
        transaction_id=transaction_id,
        raw_response=payload
    )

    # 4. If successful, publish event to EventBridge
    if is_success:
        payment = payment_repo.get_payment(order_id)
        eventbridge_service.publish_payment_succeeded(
            tenant_id=payment["tenant_id"],
            plan_id=payment["plan_id"],
            order_id=order_id,
            amount=payment["amount"]
        )

    return {"status": "ACKNOWLEDGE", "order_id": order_id}