"""
app.models.schemas
==================
Request / response bodies for auth_svc.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

# Roles a caller may create. "admin" is platform-admin only (or seed script).
Role = Literal["admin", "tenant", "staff"]

PlanTier = Literal["starter", "professional", "enterprise"]

# How many restaurants each plan allows. -1 = unlimited.
PLAN_LIMITS: dict[str, int] = {
    "starter":      1,
    "professional": 5,
    "enterprise":  -1,
}


# ── Auth ──────────────────────────────────────────────────────────────

class LoginBody(BaseModel):
    email:    EmailStr
    password: str


class RefreshBody(BaseModel):
    refreshToken: str


class TokenResponse(BaseModel):
    idToken:      str
    accessToken:  str
    refreshToken: Optional[str] = None
    expiresIn:    int
    user:         "UserProfile"


class UserProfile(BaseModel):
    sub:          str
    email:        str
    name:         str = ""
    role:         str                      # admin | tenant | staff
    tenantId:     str = ""
    restaurantId: str = ""
    groups:       list[str] = Field(default_factory=list)


# ── Registration ──────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    """
    One endpoint creates every kind of user; `role` decides the rules.

    role=admin   platform admin — no tenant, no restaurant
    role=tenant  company owner  — needs companyName + planTier; manages every
                 branch it owns, including menus and QR codes
    role=staff   kitchen staff  — needs tenantId + restaurantId
    """
    role:     Role
    email:    EmailStr
    password: str = Field(min_length=8)
    name:     str = ""

    # role=tenant
    companyName: Optional[str] = None
    planTier:    Optional[PlanTier] = "starter"

    # role=staff
    tenantId:     Optional[str] = None
    restaurantId: Optional[str] = None


class RegisterResponse(BaseModel):
    sub:          str
    email:        str
    role:         str
    tenantId:     str = ""
    restaurantId: str = ""


# ── Tenants ───────────────────────────────────────────────────────────

class Tenant(BaseModel):
    tenantId:        str
    companyName:     str
    email:           str = ""
    isActive:        bool = True
    planTier:        str = "starter"
    maxRestaurants:  int = 1
    restaurantCount: int = 0
    createdAt:       str = ""
    updatedAt:       str = ""


class TenantUpdateBody(BaseModel):
    companyName: Optional[str] = None
    isActive:    Optional[bool] = None
    planTier:    Optional[PlanTier] = None


TokenResponse.model_rebuild()