"""
app.core.config
===============
Settings for auth_svc, loaded from environment variables.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(populate_by_name=True, extra="ignore")

    environment: str = Field("dev", alias="ENVIRONMENT")
    log_level:   str = Field("INFO", alias="LOG_LEVEL")

    # ── Cognito ───────────────────────────────────────────────────────
    cognito_region:       str = Field("ap-south-1", alias="COGNITO_REGION")
    cognito_user_pool_id: str = Field("", alias="COGNITO_USER_POOL_ID")
    cognito_client_id:    str = Field("", alias="COGNITO_CLIENT_ID")

    # ── DynamoDB ──────────────────────────────────────────────────────
    tenant_table:     str = Field("TenantTable-dev", alias="TENANT_TABLE")
    restaurant_table: str = Field("RestaurantTable-dev", alias="RESTAURANT_TABLE")

    # ── Cognito groups (roles) ────────────────────────────────────────
    group_admin:            str = "menulay_admin"
    group_tenant:           str = "menulay_tenant"
    group_restaurant_admin: str = "menulay_restaurant_admin"
    group_staff:            str = "menulay_kitchen_staff"


@lru_cache
def get_settings() -> Settings:
    return Settings()
