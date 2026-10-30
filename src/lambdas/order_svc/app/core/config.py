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
    service_name: str = Field("order_svc", alias="SERVICE_NAME")
    environment: str = Field("dev", alias="ENVIRONMENT")
    log_level: str = Field("INFO", alias="LOG_LEVEL")

    # ── DynamoDB ──────────────────────────────────────────────────────
    order_table: str = Field("", alias="TABLE_ORDER")
    menu_table: str = Field("", alias="TABLE_MENU")
    item_table: str = Field("ItemTable-dev", alias="ITEM_TABLE")
    dining_table: str = Field("DiningTable-dev", alias="DINING_TABLE")

    # ── Step Functions ────────────────────────────────────────────────
    step_arn: str = Field("none", alias="STEP_ARN")

    # ── Feature flags ─────────────────────────────────────────────────
    skip_menu_validation: bool = Field(False, alias="SKIP_MENU")

    # ── Redis (CartService — best-effort cart clear) ──────────────────
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