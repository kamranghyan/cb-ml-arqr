"""
app.core.config
===============
Single source of truth for every environment variable this Lambda reads.

Pydantic BaseSettings validates and coerces values at cold-start so the
function never crashes mid-request due to a missing variable.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings  # pydantic v2


class Settings(BaseSettings):
    # ── Service identity ──────────────────────────────────────────────
    service_name: str = Field("menu_svc", alias="SERVICE_NAME")
    environment: str = Field("dev", alias="ENVIRONMENT")
    log_level: str = Field("INFO", alias="LOG_LEVEL")

    # ── DynamoDB ──────────────────────────────────────────────────────
    menu_table: str = Field("MenuTable", alias="MENU_TABLE")
    tenant_table: str = Field("TenantTable", alias="TENANT_TABLE")
    restaurant_tables_table: str = Field(
        "RestaurantTables-dev", alias="TABLE_RESTAURANT_TABLES"
    )

    # ── S3 ────────────────────────────────────────────────────────────
    s3_bucket: str = Field("menu-assets", alias="S3_BUCKET")
    max_image_mb: int = Field(5, alias="MAX_IMAGE_MB")
    max_ar_mb: int = Field(50, alias="MAX_AR_MB")

    # ── Redis (CacheService) ─────────────────────────────────────────
    redis_host: str = Field("localhost", alias="REDIS_HOST")
    redis_port: int = Field(6379, alias="REDIS_PORT")

    # ── Cognito ──────────────────────────────────────────────────────
    cognito_region: str = Field("ap-south-1", alias="COGNITO_REGION")
    cognito_user_pool_id: str = Field("", alias="COGNITO_USER_POOL_ID")
    cognito_client_id: str = Field("", alias="COGNITO_CLIENT_ID")

    model_config = {"populate_by_name": True, "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
