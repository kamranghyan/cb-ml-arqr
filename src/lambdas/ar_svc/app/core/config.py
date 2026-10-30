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
    service_name: str = Field("ar_svc", alias="SERVICE_NAME")
    environment: str = Field("dev", alias="ENVIRONMENT")
    log_level: str = Field("INFO", alias="LOG_LEVEL")

    # ── DynamoDB ──────────────────────────────────────────────────────
    # AR metadata (arModelKey, arScale, arPlacement) lives on the menu item
    # itself, which now has its own table.
    item_table: str = Field("ItemTable-dev", alias="ITEM_TABLE")

    # ── S3 ────────────────────────────────────────────────────────────
    asset_bucket_name: str = Field("", alias="ASSET_BUCKET_NAME")

    # ── CloudFront (AR model delivery + cache invalidation) ───────────
    cf_domain: str = Field("", alias="CF_DOMAIN")

    # ── Cognito ──────────────────────────────────────────────────────
    cognito_region: str = Field("ap-south-1", alias="COGNITO_REGION")
    cognito_user_pool_id: str = Field("", alias="COGNITO_USER_POOL_ID")
    cognito_client_id: str = Field("", alias="COGNITO_CLIENT_ID")

    model_config = {"populate_by_name": True, "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()