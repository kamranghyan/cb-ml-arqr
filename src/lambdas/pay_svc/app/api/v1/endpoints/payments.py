import json
import logging
from urllib.parse import parse_qs

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)

from app.schemas.payment import PaymentInitiateRequest
from app.services.easypaisa_service import EasyPaisaService
from app.services.payment_db_service import PaymentDbService
from app.services.eventbridge_service import EventBridgeService


logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/initiate",
    status_code=status.HTTP_201_CREATED,
)
async def initiate_payment(
    payload: PaymentInitiateRequest,
    easypaisa_svc: EasyPaisaService = Depends(),
    db_svc: PaymentDbService = Depends(),
    event_svc: EventBridgeService = Depends(),
):
    """
    Payment flow:

        Frontend
            ↓
        /payment/initiate
            ↓
        PaymentTable = PENDING
            ↓
        EasyPaisa
            ↓
        ┌──────────────────────────────┐
        │ MOCK                         │
        │ → SUCCESS immediately        │
        │ → EventBridge                │
        │                              │
        │ REAL                         │
        │ → PENDING                    │
        │ → EasyPaisa callback         │
        │ → SUCCESS                    │
        │ → EventBridge                │
        └──────────────────────────────┘
    """

    try:
        # =====================================================
        # 1. Create PENDING payment record
        # =====================================================

        payment = db_svc.create_payment_record(
            order_id=payload.orderId,
            tenant_id=payload.tenantId,
            plan_id=payload.planId,
            amount=payload.amount,
            email=payload.email,
            mobile_no=payload.mobileNo,
            payment_method="EasyPaisa Mobile Account",
            status="PENDING",
        )

        logger.info(
            "Payment created as PENDING",
            extra={
                "order_id": payload.orderId,
                "tenant_id": payload.tenantId,
                "plan_id": payload.planId,
            },
        )

        # =====================================================
        # 2. Initiate EasyPaisa transaction
        # =====================================================

        res_data = await easypaisa_svc.initiate_ma_transaction(
            order_id=payload.orderId,
            amount=payload.amount,
            mobile_no=payload.mobileNo,
            email=payload.email,
        )

        response_code = res_data.get("responseCode")
        transaction_id = res_data.get("transactionId")

        logger.info(
            "EasyPaisa initiation response",
            extra={
                "order_id": payload.orderId,
                "response_code": response_code,
                "transaction_id": transaction_id,
                "use_mock": easypaisa_svc.use_mock,
            },
        )

        # =====================================================
        # 3. Validate transaction response
        # =====================================================

        if response_code != "0000":

            db_svc.update_payment_status(
                order_id=payload.orderId,
                status="FAILED",
                transaction_id=transaction_id,
                raw_response=res_data,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Payment initiation failed: "
                    f"{res_data.get('responseDesc', 'Unknown error')}"
                ),
            )

        # =====================================================
        # 4. Transaction ID is required
        # =====================================================

        if not transaction_id:

            db_svc.update_payment_status(
                order_id=payload.orderId,
                status="FAILED",
                raw_response=res_data,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment transaction ID missing",
            )

        # =====================================================
        # 5. MOCK PAYMENT
        # =====================================================
        #
        # Mock EasyPaisa returns responseCode=0000.
        #
        # Since this is a local/test payment, we treat it as
        # immediately SUCCESSFUL.
        #
        # Real EasyPaisa does NOT do this.
        # Real payment stays PENDING until callback.
        # =====================================================

        if easypaisa_svc.use_mock:

            updated_payment = db_svc.update_payment_status(
                order_id=payload.orderId,
                status="SUCCESS",
                transaction_id=transaction_id,
                raw_response=res_data,
            )

            logger.info(
                "MOCK payment marked SUCCESS",
                extra={
                    "order_id": payload.orderId,
                    "transaction_id": transaction_id,
                },
            )

            # =================================================
            # Publish payment.succeeded
            # =================================================

            event_svc.publish_payment_succeeded(
                tenantId=updated_payment["tenantId"],
                planId=updated_payment["planId"],
                orderId=updated_payment["orderId"],
                amount=payload.amount,
                transactionId=updated_payment.get(
                    "transactionId"
                ),
                currency="PKR",
                paymentMethod=updated_payment.get("paymentMethod"),
            )

            logger.info(
                "MOCK payment.succeeded event published",
                extra={
                    "order_id": payload.orderId,
                    "transaction_id": transaction_id,
                },
            )

            return {
                "status": "SUCCESS",
                "message": "Payment successful",
                "orderId": payload.orderId,
                "transactionId": transaction_id,
                "data": res_data,
            }

        # =====================================================
        # 6. REAL EASYPAISA PAYMENT
        # =====================================================
        #
        # responseCode=0000 means the transaction was accepted,
        # NOT that the customer has completed payment.
        #
        # Therefore keep it PENDING.
        #
        # Later:
        #
        # EasyPaisa → /payment/callback
        #              ↓
        #         SUCCESS / FAILED
        # =====================================================

        db_svc.update_payment_status(
            order_id=payload.orderId,
            status="PENDING",
            transaction_id=transaction_id,
            raw_response=res_data,
        )

        logger.info(
            "Real EasyPaisa payment initiated; waiting for callback",
            extra={
                "order_id": payload.orderId,
                "transaction_id": transaction_id,
            },
        )

        return {
            "status": "PENDING",
            "message": (
                "Payment initiated successfully. "
                "Waiting for confirmation."
            ),
            "orderId": payload.orderId,
            "transactionId": transaction_id,
            "data": res_data,
        }

    # =========================================================
    # HTTP EXCEPTION
    # =========================================================

    except HTTPException:
        raise

    # =========================================================
    # UNEXPECTED ERROR
    # =========================================================

    except Exception as exc:

        logger.exception(
            "Error initiating payment",
            extra={
                "order_id": payload.orderId,
                "error": str(exc),
            },
        )

        # Try to mark payment as FAILED if the record exists.
        try:
            db_svc.update_payment_status(
                order_id=payload.orderId,
                status="FAILED",
                raw_response={
                    "error": str(exc),
                },
            )
        except Exception:
            logger.exception(
                "Could not mark payment as FAILED",
                extra={
                    "order_id": payload.orderId,
                },
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Failed to initiate payment: {str(exc)}"
            ),
        )





@router.get("/status/{order_id}")
async def get_payment_status(
    order_id: str,
    db_svc: PaymentDbService = Depends(),
):
    try:
        payment = db_svc.get_payment_by_order_id(order_id)

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment record not found",
            )

        return {
            "status": payment.get("status"),
            "orderId": payment.get("orderId"),
            "transactionId": payment.get("transactionId"),
            "amount": payment.get("amount"),
            "tenantId": payment.get("tenantId"),
            "planId": payment.get("planId"),
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception(
            "Error fetching payment status",
            extra={
                "order_id": order_id,
                "error": str(exc),
            },
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch payment status: {str(exc)}",
        )



@router.post("/callback")
async def easypaisa_callback(
    request: Request,
    db_svc: PaymentDbService = Depends(),
    event_svc: EventBridgeService = Depends(),
):
    """
    EasyPaisa final callback.

    SUCCESS callback:

        EasyPaisa
            ↓
        PaymentTable SUCCESS
            ↓
        EventBridge payment.succeeded
            ↓
        Invoice SVC
    """

    try:
        # =====================================================
        # 1. Parse callback
        # =====================================================

        content_type = request.headers.get(
            "content-type",
            "",
        ).lower()

        if "application/json" in content_type:

            payload = await request.json()

        else:

            body_bytes = await request.body()

            body_str = body_bytes.decode(
                "utf-8"
            )

            try:
                payload = json.loads(
                    body_str
                )

            except Exception:

                parsed = parse_qs(
                    body_str
                )

                payload = {
                    key: values[0]
                    for key, values in parsed.items()
                }

        logger.info(
            "EasyPaisa callback received",
            extra={
                "payload": payload,
            },
        )

        # =====================================================
        # 2. Extract values
        # =====================================================

        order_id = payload.get(
            "orderId"
        )

        response_code = payload.get(
            "responseCode"
        )

        transaction_id = payload.get(
            "transactionId"
        )

        if not order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing orderId in callback payload",
            )

        # =====================================================
        # 3. Get payment
        # =====================================================

        existing_record = (
            db_svc.get_payment_by_order_id(
                order_id
            )
        )

        if not existing_record:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment record not found",
            )

        # =====================================================
        # 4. Idempotency
        # =====================================================

        if existing_record.get(
            "status"
        ) == "SUCCESS":

            return {
                "status": "ACKNOWLEDGE",
                "message": "Already processed",
            }

        # =====================================================
        # 5. SUCCESS
        # =====================================================

        if response_code == "0000":

            if not transaction_id:
                transaction_id = existing_record.get(
                    "transactionId"
                )

            transaction_amount = payload.get(
                "transactionAmount"
            )

            try:
                amount = float(
                    transaction_amount
                    if transaction_amount is not None
                    else existing_record.get(
                        "amount",
                        0,
                    )
                )

            except (
                TypeError,
                ValueError,
            ):
                amount = float(
                    existing_record.get(
                        "amount",
                        0,
                    )
                )

            # =================================================
            # 6. Update DB FIRST
            # =================================================

            updated_payment = (
                db_svc.update_payment_status(
                    order_id=order_id,
                    status="SUCCESS",
                    transaction_id=transaction_id,
                    raw_response=payload,
                )
            )

            # =================================================
            # 7. Publish EventBridge
            # =================================================

            event_svc.publish_payment_succeeded(
                tenantId=updated_payment[
                    "tenantId"
                ],
                planId=updated_payment[
                    "planId"
                ],
                orderId=updated_payment[
                    "orderId"
                ],
                amount=amount,
                transactionId=updated_payment.get(
                    "transactionId"
                ),
                currency="PKR",
            )

            logger.info(
                "Payment SUCCESS + EventBridge published",
                extra={
                    "order_id": order_id,
                    "transaction_id": transaction_id,
                },
            )

            return {
                "status": "ACKNOWLEDGE",
                "message": "Payment successful",
                "orderId": order_id,
            }

        # =====================================================
        # 8. FAILED
        # =====================================================

        db_svc.update_payment_status(
            order_id=order_id,
            status="FAILED",
            transaction_id=transaction_id,
            raw_response=payload,
        )

        return {
            "status": "ACKNOWLEDGE",
            "message": "Payment failed",
            "orderId": order_id,
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception(
            "Error processing EasyPaisa callback",
            extra={
                "error": str(exc),
            },
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to process payment callback: "
                f"{str(exc)}"
            ),
        )