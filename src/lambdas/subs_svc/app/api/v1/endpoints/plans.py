"""
app.api.v1.endpoints.plans
==========================
Plan management endpoints (Admin only)

Who may do what
---------------
GET     /plans                public read (list all active plans)
GET     /plans/{plan_id}      public read (get plan details)
POST    /plans/admin          platform admin only (create new plan tier)
PUT     /plans/admin/{plan_id} platform admin only (update plan details)
DELETE  /plans/admin/{plan_id} platform admin only (soft delete plan)

Plan Tiers
-----------
• weekly      - 7 days access
• monthly     - 30 days access  
• quarterly   - 90 days access
• semi_annual - 180 days access
• annual      - 365 days access

Notes
-----
• Plan creation/deletion is restricted to platform admin via Cognito groups
• Soft delete sets isActive=False - preserves historical subscription data
• Plan prices are used by Payment SVC for billing (future integration)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from app.core.security import admin_required, get_current_tenant
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse
from app.services.plan_service import PlanService

# Router without prefix - prefix applied in v1/__init__.py
router = APIRouter()
plan_service = PlanService()


@router.post("/admin", response_model=PlanResponse)
@admin_required
async def create_plan(request: Request, plan: PlanCreate, tenant=Depends(get_current_tenant)):
    """Create a new plan (Admin only)"""
    return plan_service.create_plan(plan)


# Accepts both /api/v1/plans and /api/v1/plans/
@router.get("", response_model=List[PlanResponse])
@router.get("/", response_model=List[PlanResponse])
async def list_plans(active_only: bool = True):
    """List all available plans"""
    return plan_service.list_plans(active_only)


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: str):
    """Get plan details"""
    return plan_service.get_plan(plan_id)


@router.put("/admin/{plan_id}", response_model=PlanResponse)
@admin_required
async def update_plan(request: Request, plan_id: str, updates: PlanUpdate, tenant=Depends(get_current_tenant)):
    """Update plan (Admin only)"""
    return plan_service.update_plan(plan_id, updates)


@router.delete("/admin/{plan_id}")
@admin_required
async def delete_plan(request: Request, plan_id: str, tenant=Depends(get_current_tenant)):
    """Delete plan (soft delete) (Admin only)"""
    return plan_service.delete_plan(plan_id)