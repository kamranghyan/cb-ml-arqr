import hmac
import hashlib
from app.core.config import settings

class EasyPaisaService:
    def __init__(self):
        self.store_id = settings.EASYPAISA_STORE_ID
        self.hash_key = settings.EASYPAISA_HASH_KEY
        self.post_back_url = settings.EASYPAISA_POST_BACK_URL

    def generate_hash(self, params: dict) -> str:
        """
        Sorts parameters alphabetically and constructs HMAC-SHA256 hash string.
        """
        # Exclude empty values and existing hash keys
        filtered_params = {
            k: str(v) for k, v in params.items() 
            if v is not None and v != "" and k not in ("hashRequest", "hashResponse")
        }
        
        # Sort keys alphabetically
        sorted_keys = sorted(filtered_params.keys())
        
        # Build query string key=value&key2=value2
        hash_string = "&".join([f"{k}={filtered_params[k]}" for k in sorted_keys])
        
        # Generate HMAC-SHA256 signature
        signature = hmac.new(
            self.hash_key.encode('utf-8'),
            hash_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature

    def create_checkout_payload(self, payload_schema) -> dict:
        """
        Constructs and signs the payload dictionary required for EasyPaisa hosted checkout.
        """
        params = {
            "storeId": self.store_id,
            "orderId": payload_schema.order_id,
            "transactionAmount": f"{payload_schema.amount:.2f}",
            "mobileNum": payload_schema.mobile_no,
            "emailAddress": payload_schema.email,
            "postBackURL": self.post_back_url,
        }
        
        # Sign the payload and add the hashRequest field
        params["hashRequest"] = self.generate_hash(params)
        return params

    def verify_response_hash(self, response_data: dict) -> bool:
        """Validates incoming webhook/callback payload hash from Easypaisa."""
        received_hash = response_data.get("hashResponse")
        if not received_hash:
            return False
            
        calculated_hash = self.generate_hash(response_data)
        return hmac.compare_digest(received_hash, calculated_hash)