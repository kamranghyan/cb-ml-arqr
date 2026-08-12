"""
MenuItem entity model.

DynamoDB key pattern:
  PK = TENANT#{tenantId}#RESTAURANT#{restaurantId}
  SK = ITEM#{itemId}

Supports optimistic locking via the `version` field.

Image fields:
  imageKey   -- S3 key for item photo (stored in DDB)
  imageUrl   -- presigned GET URL injected at read time (not stored)
  arModelKey -- S3 key for .glb AR model (stored in DDB)
  arModelUrl -- presigned GET URL for AR model (not stored)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Optional
from xml.parsers.expat import errors

from .base import (
    BaseModel, ValidationError,
    _require, _validate_uuid, _validate_iso8601,
    _validate_max_len, _validate_positive,
    ALLOWED_ALLERGENS,
)

@dataclass
class MenuItemSize:
    name: str
    priceMinorUnits: int

    ALLOWED_SIZES = {"Small", "Medium", "Large"}

    def validate(self) -> None:
        errors: dict[str, str] = {}

        if self.name not in self.ALLOWED_SIZES:
            errors["name"] = (
                "must be one of: Small, Medium, Large"
            )

        if self.priceMinorUnits is None:
            errors["priceMinorUnits"] = "required"
        else:
            _validate_positive(
                errors,
                "priceMinorUnits",
                self.priceMinorUnits,
            )

        if errors:
            raise ValidationError(errors)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "priceMinorUnits": self.priceMinorUnits,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MenuItemSize":
        return cls(
            name=data.get("name", ""),
            priceMinorUnits=int(
                data.get("priceMinorUnits", 0)
            ),
        )


@dataclass
class MenuItem(BaseModel):
    itemId: str
    tenantId: str
    restaurantId: str
    categoryId: str
    categoryName: str
    name: str
    description: str
    priceMinorUnits: int
    isActive: bool
    version: int
    createdAt: str
    updatedAt: str

    # Optional fields AFTER all required fields
    prepTime: Optional[int] = None
    calories: Optional[int] = None
    imageKey: Optional[str] = None
    imageUrl: Optional[str] = None
    allergens: List[str] = field(default_factory=list)
    arModelKey: Optional[str] = None
    arModelUrl: Optional[str] = None
    sizes: Optional[List[MenuItemSize]] = None
    slides: List[MenuItemSlide] = field(default_factory=list)

    # -- DynamoDB key helpers -----------------------------------------------

    @property
    def pk(self) -> str:
        return f"TENANT#{self.tenantId}#RESTAURANT#{self.restaurantId}"

    @property
    def sk(self) -> str:
        return f"ITEM#{self.itemId}"

    # -- Validation ---------------------------------------------------------

    def validate(self) -> None:
        errors: dict[str, str] = {}

        _require(errors, "itemId", self.itemId)
        _validate_uuid(errors, "itemId", self.itemId)

        _require(errors, "tenantId", self.tenantId)
        _validate_uuid(errors, "tenantId", self.tenantId)

        _require(errors, "restaurantId", self.restaurantId)
        _validate_uuid(errors, "restaurantId", self.restaurantId)

        _require(errors, "categoryId", self.categoryId)
        _validate_uuid(errors, "categoryId", self.categoryId)

        _require(errors, "name", self.name)
        _validate_max_len(errors, "name", self.name, 200)

        _require(errors, "description", self.description)
        _validate_max_len(errors, "description", self.description, 500)

        if self.priceMinorUnits is None:
            errors["priceMinorUnits"] = "required"
        else:   
            _validate_positive(errors, "priceMinorUnits", self.priceMinorUnits)

        if self.calories is not None:
            if self.calories < 0:
                errors["calories"] = "must be greater than or equal to 0"

        if self.prepTime is not None:
            if self.prepTime < 0:
                errors["prepTime"] = "must be greater than or equal to 0"

        # Validate optional sizes
        if self.sizes:
            seen_sizes: set[str] = set()

            for size in self.sizes:
                size.validate()

                if size.name in seen_sizes:
                    errors["sizes"] = (
                        f"duplicate size: {size.name}"
                    )
                    break

                seen_sizes.add(size.name)

        if self.version is None or self.version < 1:
            errors["version"] = "must be a positive integer"

        if len(self.slides) > 6:
            errors["slides"] = "maximum 6 images are allowed"

        seen_positions: set[int] = set()

        for slide in self.slides:
            if slide.position < 1 or slide.position > 6:
                errors["slides"] = (
                    f"invalid slide position: {slide.position}"
                )
                break

            if slide.position in seen_positions:
                errors["slides"] = (
                    f"duplicate slide position: {slide.position}"
                )
                break

            if not slide.imageKey:
                errors["slides"] = (
                    f"imageKey is required for slide {slide.position}"
                )
                break

            seen_positions.add(slide.position)
        

        _require(errors, "createdAt", self.createdAt)
        _validate_iso8601(errors, "createdAt", self.createdAt)

        _require(errors, "updatedAt", self.updatedAt)
        _validate_iso8601(errors, "updatedAt", self.updatedAt)

        invalid_allergens = [a for a in self.allergens if a not in ALLOWED_ALLERGENS]
        if invalid_allergens:
            errors["allergens"] = f"unknown allergen codes: {invalid_allergens}"

        if errors:
            raise ValidationError(errors)

    # -- Serialisation ------------------------------------------------------

    def to_dict(self, exclude_none: bool = False) -> dict[str, Any]:
        data: dict[str, Any] = {
            "itemId": self.itemId,
            "tenantId": self.tenantId,
            "restaurantId": self.restaurantId,
            "categoryId": self.categoryId,
            "categoryName": self.categoryName,
            "name": self.name,
            "description": self.description,
            "priceMinorUnits": self.priceMinorUnits,
            "isActive": self.isActive,
            "version": self.version,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt,

            "prepTime": self.prepTime,
            "calories": self.calories,

            "allergens": self.allergens,
            "sizes": (
                [size.to_dict() for size in self.sizes]
                if self.sizes is not None
                else None
            ),

            "slides": [
                slide.to_dict(exclude_none=exclude_none)
                for slide in self.slides
            ],
        }
        if self.imageKey is not None or not exclude_none:
            data["imageKey"] = self.imageKey
        if self.imageUrl is not None:
            data["imageUrl"] = self.imageUrl
        if self.arModelKey is not None or not exclude_none:
            data["arModelKey"] = self.arModelKey
        if self.arModelUrl is not None:
            data["arModelUrl"] = self.arModelUrl
        return data

    def to_dynamo_item(self) -> dict[str, Any]:
        """DDB item -- imageUrl/arModelUrl intentionally excluded (never persisted)."""
        item = self.to_dict(exclude_none=True)
        item.pop("imageUrl", None)
        item.pop("arModelUrl", None)
        item["PK"] = self.pk
        item["SK"] = self.sk
        return item

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MenuItem":
        import re

        # Helper function to extract integers from strings like "25 min" or ""
        def _safe_int(val: Any) -> Optional[int]:
            if val is None:
                return None
            if isinstance(val, (int, float)):
                return int(val)
            
            val_str = str(val).strip()
            if not val_str:
                return None
                
            # Extract the first matching block of digits
            match = re.search(r'\d+', val_str)
            if match:
                return int(match.group())
                
            return None

        # Parse sizes safely if present
        sizes_data = data.get("sizes")
        sizes = (
            [MenuItemSize.from_dict(s) for s in sizes_data]
            if sizes_data is not None
            else None
        )

        # Parse slides safely if present
        slides_data = data.get("slides", [])
        slides = [MenuItemSlide.from_dict(s) for s in slides_data]

        return cls(
            itemId=data.get("itemId", ""),
            tenantId=data.get("tenantId", ""),
            restaurantId=data.get("restaurantId", ""),
            categoryId=data.get("categoryId", ""),
            categoryName=data.get("categoryName", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            priceMinorUnits=int(data.get("priceMinorUnits", 0)),
            isActive=bool(data.get("isActive", True)),
            version=int(data.get("version", 1)),
            createdAt=data.get("createdAt", ""),
            updatedAt=data.get("updatedAt", ""),
            
            # Safe numeric conversion
            prepTime=_safe_int(data.get("prepTime")),
            calories=_safe_int(data.get("calories")),
            
            imageKey=data.get("imageKey"),
            imageUrl=data.get("imageUrl"),
            allergens=data.get("allergens", []),
            arModelKey=data.get("arModelKey"),
            arModelUrl=data.get("arModelUrl"),
            sizes=sizes,
            slides=slides,
        )



    @classmethod
    def from_dynamo_item(cls, item: dict[str, Any]) -> "MenuItem":
        return cls.from_dict(item)
    

@dataclass
class MenuItemSlide:
    position: int
    imageKey: str
    imageUrl: Optional[str] = None

    def to_dict(self, exclude_none: bool = False) -> dict[str, Any]:
        data = {
            "position": self.position,
            "imageKey": self.imageKey,
        }

        if self.imageUrl is not None or not exclude_none:
            data["imageUrl"] = self.imageUrl

        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MenuItemSlide":
        return cls(
            position=int(data.get("position", 1)),
            imageKey=data.get("imageKey", ""),
            imageUrl=data.get("imageUrl"),
        )