from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):

    # ============================================================
    # Environment
    # ============================================================

    ENVIRONMENT: str = "dev"


    # ============================================================
    # DynamoDB
    # ============================================================

    PAYMENTS_TABLE_NAME: str = "PaymentTable-dev"


    # ============================================================
    # EventBridge
    # ============================================================

    EVENT_BUS_NAME: str = "arqr-event-bus-dev"


    # ============================================================
    # EasyPaisa
    # ============================================================

    EASYPAISA_STORE_ID: str = "12345"

    EASYPAISA_CREDENTIALS: str = "dummy_credentials"

    EASYPAISA_ACCOUNT_NUM: str = "03001234567"

    EASYPAISA_BASE_URL: str = (
        "https://easypaystg.easypaisa.com.pk/"
        "easypay-service/rest/v4"
    )

    EASYPAISA_POST_BACK_URL: str = (
        "https://example.com/callback"
    )

    EASYPAISA_ENV: str = "sandbox"


    # ============================================================
    # Payment mode
    # ============================================================

    USE_MOCK_PAYMENTS: bool = False


    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()