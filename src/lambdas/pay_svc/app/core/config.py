from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    EASYPAISA_STORE_ID: str = "12345"
    EASYPAISA_BASE_URL: str = (
        "https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4"
    )
    EASYPAISA_ACCOUNT_NUM: str = "03001234567"
    EASYPAISA_CREDENTIALS: str = "dummy_credentials"
    USE_MOCK_PAYMENTS: bool = True  # Mock response enabled by default

    # Infrastructure Configs
    EVENT_BUS_NAME: str = "default"
    PAYMENTS_TABLE_NAME: str = "payments-dev"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()