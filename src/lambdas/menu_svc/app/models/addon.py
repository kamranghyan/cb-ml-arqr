"""
AddOn entity model.

An AddOn belongs to a specific menu item within a restaurant.

DynamoDB:
    PK = addOnId

GSIs:
    restaurantId-index
    categoryId-index
    menuItemId-index
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from .base import (
    BaseModel,
    ValidationError,
    _require,
    _validate_uuid,
    _validate_iso8601,
    _validate_max_len,
    _validate_positive,
)


@dataclass
class AddOn(BaseModel):
    addOnId: str
    tenantId: str
    restaurantId: str
    categoryId: str
    menuItemId: str

    name: str
    description: Optional[str]

    priceMinorUnits: int

    isActive: bool
    sortOrder: int

    createdAt: str
    updatedAt: str

    # ------------------------------------------------------------------
    # DynamoDB helpers
    # ------------------------------------------------------------------

    @property
    def pk(self) -> str:
        return self.addOnId

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate(self) -> None:
        errors: dict[str, str] = {}

        _require(errors, "addOnId", self.addOnId)
        _validate_uuid(errors, "addOnId", self.addOnId)

        _require(errors, "tenantId", self.tenantId)
        _validate_uuid(errors, "tenantId", self.tenantId)

        _require(errors, "restaurantId", self.restaurantId)
        _validate_uuid(errors, "restaurantId", self.restaurantId)

        _require(errors, "categoryId", self.categoryId)
        _validate_uuid(errors, "categoryId", self.categoryId)

        _require(errors, "menuItemId", self.menuItemId)
        _validate_uuid(errors, "menuItemId", self.menuItemId)

        _require(errors, "name", self.name)
        _validate_max_len(errors, "name", self.name, 200)

        if self.description is not None:
            _validate_max_len(
                errors,
                "description",
                self.description,
                500,
            )

        if self.priceMinorUnits is None:
            errors["priceMinorUnits"] = "required"
        else:
            _validate_positive(
                errors,
                "priceMinorUnits",
                self.priceMinorUnits,
            )

        if self.sortOrder is None:
            errors["sortOrder"] = "required"
        elif self.sortOrder < 0:
            errors["sortOrder"] = "cannot be negative"

        _require(errors, "createdAt", self.createdAt)
        _validate_iso8601(
            errors,
            "createdAt",
            self.createdAt,
        )

        _require(errors, "updatedAt", self.updatedAt)
        _validate_iso8601(
            errors,
            "updatedAt",
            self.updatedAt,
        )

        if errors:
            raise ValidationError(errors)

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_dict(self, exclude_none: bool = False) -> dict[str, Any]:
        data: dict[str, Any] = {
            "addOnId": self.addOnId,
            "tenantId": self.tenantId,
            "restaurantId": self.restaurantId,
            "categoryId": self.categoryId,
            "menuItemId": self.menuItemId,
            "name": self.name,
            "priceMinorUnits": self.priceMinorUnits,
            "isActive": self.isActive,
            "sortOrder": self.sortOrder,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt,
        }

        if self.description is not None or not exclude_none:
            data["description"] = self.description

        return data

    def to_dynamo_item(self) -> dict[str, Any]:
        """Serialize the AddOn for DynamoDB."""
        item = self.to_dict(exclude_none=True)

        item["PK"] = self.pk

        return item

    # ------------------------------------------------------------------
    # Deserialization
    # ------------------------------------------------------------------

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AddOn":
        return cls(
            addOnId=data.get("addOnId", ""),
            tenantId=data.get("tenantId", ""),
            restaurantId=data.get("restaurantId", ""),
            categoryId=data.get("categoryId", ""),
            menuItemId=data.get("menuItemId", ""),
            name=data.get("name", ""),
            description=data.get("description"),
            priceMinorUnits=int(
                data.get("priceMinorUnits", 0)
            ),
            isActive=bool(
                data.get("isActive", True)
            ),
            sortOrder=int(
                data.get("sortOrder", 0)
            ),
            createdAt=data.get("createdAt", ""),
            updatedAt=data.get("updatedAt", ""),
        )

    @classmethod
    def from_dynamo_item(cls, item: dict[str, Any]) -> "AddOn":
        return cls.from_dict(item)