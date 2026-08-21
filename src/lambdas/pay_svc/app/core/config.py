# app/core/config.py

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENVIRONMENT: str = "dev"
    PAYMENT_TABLE: str
    EVENT_BUS_NAME: str = "arqr-event-bus-dev"
    
    # Easypaisa Credentials
    EASYPAISA_STORE_ID: str
    EASYPAISA_HASH_KEY: str
    EASYPAISA_ENV: str = "sandbox"
    EASYPAISA_PAY_URL: str = "https://easypay.easypaisa.com.pk/easypay/Index.jsf"
    EASYPAISA_POST_BACK_URL: str

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()