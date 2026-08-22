import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class EasyPaisaService:

    def __init__(self):
        self.store_id = settings.EASYPAISA_STORE_ID
        self.base_url = settings.EASYPAISA_BASE_URL
        self.account_num = settings.EASYPAISA_ACCOUNT_NUM
        self.use_mock = settings.USE_MOCK_PAYMENTS

    async def initiate_ma_transaction(
        self, order_id: str, amount: float, mobile_no: str, email: str
    ) -> dict:
        if self.use_mock:
            logger.info(f"[MOCK EASYPAISA] MA Transaction for Order: {order_id}")
            return {
                "responseCode": "0000",
                "responseDesc": "SUCCESS",
                "orderId": order_id,
                "transactionId": f"MOCK_TXN_{order_id}",
                "transactionDateTime": "2026-08-22 10:00:00",
            }

        # Real httpx API call goes here when mock is False...

    async def initiate_otc_transaction(
        self, order_id: str, amount: float, msisdn: str, email: str, token_expiry: str
    ) -> dict:
        if self.use_mock:
            logger.info(f"[MOCK EASYPAISA] OTC Transaction for Order: {order_id}")
            return {
                "responseCode": "0000",
                "responseDesc": "SUCCESS",
                "orderId": order_id,
                "paymentToken": f"MOCK_TOKEN_{order_id}",
                "transactionId": f"MOCK_TXN_{order_id}",
            }

        # Real httpx API call goes here when mock is False...

    async def inquire_transaction(self, order_id: str) -> dict:
        if self.use_mock:
            logger.info(f"[MOCK EASYPAISA] Inquire Order: {order_id}")
            return {
                "responseCode": "0000",
                "responseDesc": "PAID",
                "orderId": order_id,
                "transactionStatus": "PAID",
            }

        # Real httpx API call goes here when mock is False...