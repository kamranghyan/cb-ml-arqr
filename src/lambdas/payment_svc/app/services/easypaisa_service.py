# app/services/easypaisa_service.py

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
        # Exclude empty values and existing hash
        filtered_params = {k: v for k, v in params.items() if v and k != "hashRequest"}
        
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

    def verify_response_hash(self, response_data: dict) -> bool:
        """Validates incoming webhook/callback payload hash from Easypaisa."""
        received_hash = response_data.get("hashResponse")
        if not received_hash:
            return False
            
        calculated_hash = self.generate_hash(response_data)
        return hmac.compare_digest(received_hash, calculated_hash)