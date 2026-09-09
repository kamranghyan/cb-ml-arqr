"""
app.services.plan_service
==========================
PlanService — Core business logic for plan management.

Business Logic
--------------
1. create_plan()
   • Validates plan doesn't already exist
   • Creates new plan with isActive=True
   • Returns created plan

2. list_plans()
   • Retrieves all plans (optionally only active ones)
   • Ordered by creation date

3. update_plan()
   • Validates plan exists
   • Updates provided fields (partial update)
   • Returns updated plan

4. delete_plan()
   • Soft delete - sets isActive=False
   • Preserves historical plan data for existing subscriptions

Admin Controls
--------------
• All plan management endpoints are admin-only
• Admin role validated via Cognito groups
• Regular tenants can only view plans (not modify)

Notes
-----
• Plan deletion is soft - never hard delete (data integrity)
• Plan prices used by Payment SVC for billing
"""

import logging
from typing import List, Optional
from fastapi import HTTPException
from app.repositories.plan_repository import PlanRepository
from app.models.plan import Plan
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse

logger = logging.getLogger(__name__)


class PlanService:
    def __init__(self):
        self.plan_repo = PlanRepository()
    
    def create_plan(self, plan_data: PlanCreate) -> PlanResponse:
        """Create a new plan"""
        # Check if plan exists
        existing = self.plan_repo.get_plan(plan_data.plan_id)
        if existing:
            raise HTTPException(status_code=400, detail="Plan already exists")
        
        plan = Plan(
            plan_id=plan_data.plan_id,
            plan_name=plan_data.plan_name,
            duration_days=plan_data.duration_days,
            price=plan_data.price,
            currency=plan_data.currency,
            description=plan_data.description,
            whats_included=plan_data.whats_included,
            is_active=True
        )
        
        created = self.plan_repo.create_plan(plan)
        return self._to_response(created)
    
    def list_plans(self, active_only: bool = True) -> List[PlanResponse]:
        """List all plans"""
        plans = self.plan_repo.list_plans(active_only)
        return [self._to_response(plan) for plan in plans]
    
    def get_plan(self, plan_id: str) -> PlanResponse:
        """Get a plan by ID"""
        plan = self.plan_repo.get_plan(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return self._to_response(plan)
    
    def update_plan(self, plan_id: str, updates: PlanUpdate) -> PlanResponse:
        """Update a plan"""
        # Check if plan exists
        existing = self.plan_repo.get_plan(plan_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Build update dict
        update_data = {}
        if updates.plan_name is not None:
            update_data["planName"] = updates.plan_name
        if updates.duration_days is not None:
            update_data["durationDays"] = updates.duration_days
        if updates.price is not None:
            update_data["price"] = updates.price
        if updates.description is not None:
            update_data["description"] = updates.description
        if updates.is_active is not None:
            update_data["isActive"] = updates.is_active
        if updates.currency is not None:
            update_data["currency"] = updates.currency
        
        if not update_data:
            return self._to_response(existing)
        
        self.plan_repo.update_plan(plan_id, update_data)
        
        # Get updated plan
        updated = self.plan_repo.get_plan(plan_id)
        return self._to_response(updated)
    
    def delete_plan(self, plan_id: str) -> dict:
        """Soft delete a plan"""
        existing = self.plan_repo.get_plan(plan_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        self.plan_repo.delete_plan(plan_id)
        return {"message": f"Plan {plan_id} deleted successfully"}
    
    def _to_response(self, plan: Plan) -> PlanResponse:
        """Convert Plan model to PlanResponse schema"""
        return PlanResponse(
            plan_id=plan.plan_id,
            plan_name=plan.plan_name,
            duration_days=plan.duration_days,
            price=plan.price,
            currency=plan.currency,
            description=plan.description,
            is_active=plan.is_active,
            whats_included=plan.whats_included
        )