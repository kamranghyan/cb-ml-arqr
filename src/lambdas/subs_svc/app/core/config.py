"""
app.core.config
================
Configuration management for Subscription Service.
"""

import os
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = Field(default_factory=lambda: os.getenv("ENVIRONMENT", "dev"))
    
    # DynamoDB Tables
    TENANT_TABLE: str = Field(
        default_factory=lambda: os.getenv(
            "TENANT_TABLE", f"TenantTable-{os.getenv('ENVIRONMENT', 'dev')}"
        )
    )
    PLAN_TABLE: str = Field(
        default_factory=lambda: os.getenv(
            "PLAN_TABLE", f"PlanTypesTable-{os.getenv('ENVIRONMENT', 'dev')}"
        )
    )
    SUBSCRIPTION_TABLE: str = Field(
        default_factory=lambda: os.getenv(
            "SUBSCRIPTION_TABLE", f"TenantSubscriptionTable-{os.getenv('ENVIRONMENT', 'dev')}"
        )
    )
    RESTAURANT_TABLE: str = Field(
        default_factory=lambda: os.getenv(
            "RESTAURANT_TABLE", f"RestaurantTable-{os.getenv('ENVIRONMENT', 'dev')}"
        )
    )
    
    # AWS Region
    AWS_REGION: str = Field(default_factory=lambda: os.getenv("AWS_REGION", "ap-south-1"))
    
    # Cognito
    COGNITO_USER_POOL_ID: str = Field(default_factory=lambda: os.getenv("COGNITO_USER_POOL_ID", ""))
    COGNITO_CLIENT_ID: str = Field(default_factory=lambda: os.getenv("COGNITO_CLIENT_ID", ""))
    COGNITO_REGION: str = Field(default_factory=lambda: os.getenv("COGNITO_REGION", "ap-south-1"))

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()


@lru_cache
def get_settings() -> Settings:
    """Returns a cached instance of the settings configuration."""
    return settings