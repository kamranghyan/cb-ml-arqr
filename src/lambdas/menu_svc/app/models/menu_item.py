"""
MenuItem entity model.

DynamoDB key pattern:
    PK = TENANT#{tenantId}#RESTAURANT#{restaurantId}
    SK = ITEM#{itemId}

Supports:
    - optimistic locking via `version`
    - main item image
    - gallery slides 1-6
    - AR .glb model
    - allergens
    - sizes

Image fields:
    imageKey   -- S3 key for item photo (stored in DDB)
    imageUrl   -- presigned GET URL injected at read time (not stored)

AR fields:
    arModelKey -- S3 key for .glb model (stored in DDB)
    arModelUrl -- presigned GET URL injected at read time (not stored)

Gallery:
    slides -- list of MenuItemSlide objects
              position 1 = main image
              position 2-6 = additional images
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Optional

from .base import (
    BaseModel,
    ValidationError,
    _require,
    _validate_uuid,
    _validate_iso8601,
    _validate_max_len,
    _validate_positive,
    ALLOWED_ALLERGENS,
)


# ============================================================================
# Menu Item Size
# ============================================================================

@dataclass
class MenuItemSize:
    name: str
    priceMinorUnits: int

    ALLOWED_SIZES = {
        "Small",
        "Medium",
        "Large",
    }

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
    def from_dict(
        cls,
        data: dict[str, Any],
    ) -> "MenuItemSize":
        if not isinstance(data, dict):
            data = {}

        raw_price = data.get("priceMinorUnits", 0)

        try:
            price = int(raw_price)
        except (TypeError, ValueError):
            price = 0

        return cls(
            name=str(data.get("name", "")),
            priceMinorUnits=price,
        )


# ============================================================================
# Menu Item Slide
# ============================================================================

@dataclass
class MenuItemSlide:
    """
    One image in the item gallery.

    position:
        1 = main item image
        2-6 = additional gallery images
    """

    position: int
    imageKey: str
    imageUrl: Optional[str] = None

    def validate(self) -> None:
        errors: dict[str, str] = {}

        if self.position < 1 or self.position > 6:
            errors["position"] = (
                "must be between 1 and 6"
            )

        if not self.imageKey:
            errors["imageKey"] = "required"

        if errors:
            raise ValidationError(errors)

    def to_dict(
        self,
        exclude_none: bool = False,
    ) -> dict[str, Any]:

        data: dict[str, Any] = {
            "position": self.position,
            "imageKey": self.imageKey,
        }

        # imageUrl is generated dynamically and should normally
        # not be persisted into DynamoDB.
        if self.imageUrl is not None or not exclude_none:
            data["imageUrl"] = self.imageUrl

        return data

    def to_dynamo_dict(self) -> dict[str, Any]:
        """
        DynamoDB-safe representation.

        imageUrl is intentionally excluded because presigned URLs
        are temporary and must never be persisted.
        """

        return {
            "position": self.position,
            "imageKey": self.imageKey,
        }

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any],
    ) -> "MenuItemSlide":

        if not isinstance(data, dict):
            data = {}

        raw_position = data.get("position", 1)

        try:
            position = int(raw_position)
        except (TypeError, ValueError):
            position = 1

        return cls(
            position=position,
            imageKey=str(
                data.get("imageKey", "") or ""
            ),
            imageUrl=data.get("imageUrl"),
        )


# ============================================================================
# Menu Item
# ============================================================================

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

    # ------------------------------------------------------------------------
    # Optional fields
    # ------------------------------------------------------------------------

    prepTime: Optional[int] = None
    calories: Optional[int] = None

    # Main image
    imageKey: Optional[str] = None
    imageUrl: Optional[str] = None

    # Allergens
    allergens: List[str] = field(
        default_factory=list
    )

    # AR
    arModelKey: Optional[str] = None
    arModelUrl: Optional[str] = None

    # Sizes
    sizes: Optional[List[MenuItemSize]] = None

    # Gallery
    slides: List[MenuItemSlide] = field(
        default_factory=list
    )

    # =========================================================================
    # DynamoDB key helpers
    # =========================================================================

    @property
    def pk(self) -> str:
        return (
            f"TENANT#{self.tenantId}"
            f"#RESTAURANT#{self.restaurantId}"
        )

    @property
    def sk(self) -> str:
        return f"ITEM#{self.itemId}"

    # =========================================================================
    # Validation
    # =========================================================================

    def validate(self) -> None:

        errors: dict[str, str] = {}

        # ---------------------------------------------------------------------
        # IDs
        # ---------------------------------------------------------------------

        _require(
            errors,
            "itemId",
            self.itemId,
        )

        _validate_uuid(
            errors,
            "itemId",
            self.itemId,
        )

        _require(
            errors,
            "tenantId",
            self.tenantId,
        )

        _validate_uuid(
            errors,
            "tenantId",
            self.tenantId,
        )

        _require(
            errors,
            "restaurantId",
            self.restaurantId,
        )

        _validate_uuid(
            errors,
            "restaurantId",
            self.restaurantId,
        )

        _require(
            errors,
            "categoryId",
            self.categoryId,
        )

        _validate_uuid(
            errors,
            "categoryId",
            self.categoryId,
        )

        # ---------------------------------------------------------------------
        # Basic fields
        # ---------------------------------------------------------------------

        _require(
            errors,
            "name",
            self.name,
        )

        _validate_max_len(
            errors,
            "name",
            self.name,
            200,
        )

        _require(
            errors,
            "description",
            self.description,
        )

        _validate_max_len(
            errors,
            "description",
            self.description,
            500,
        )

        # ---------------------------------------------------------------------
        # Price
        # ---------------------------------------------------------------------

        if self.priceMinorUnits is None:
            errors["priceMinorUnits"] = "required"
        else:
            _validate_positive(
                errors,
                "priceMinorUnits",
                self.priceMinorUnits,
            )

        # ---------------------------------------------------------------------
        # Calories
        # ---------------------------------------------------------------------

        if self.calories is not None:
            if self.calories < 0:
                errors["calories"] = (
                    "must be greater than or equal to 0"
                )

        # ---------------------------------------------------------------------
        # Preparation time
        # ---------------------------------------------------------------------

        if self.prepTime is not None:
            if self.prepTime < 0:
                errors["prepTime"] = (
                    "must be greater than or equal to 0"
                )

        # ---------------------------------------------------------------------
        # Sizes
        # ---------------------------------------------------------------------

        if self.sizes is not None:

            seen_sizes: set[str] = set()

            for size in self.sizes:

                if not isinstance(
                    size,
                    MenuItemSize,
                ):
                    errors["sizes"] = (
                        "invalid size object"
                    )
                    break

                try:
                    size.validate()
                except ValidationError as exc:
                    errors["sizes"] = str(exc)
                    break

                if size.name in seen_sizes:
                    errors["sizes"] = (
                        f"duplicate size: {size.name}"
                    )
                    break

                seen_sizes.add(size.name)

        # ---------------------------------------------------------------------
        # Version
        # ---------------------------------------------------------------------

        if self.version is None or self.version < 1:
            errors["version"] = (
                "must be a positive integer"
            )

        # ---------------------------------------------------------------------
        # Gallery slides
        # ---------------------------------------------------------------------

        if self.slides is None:
            self.slides = []

        if len(self.slides) > 6:
            errors["slides"] = (
                "maximum 6 images are allowed"
            )

        seen_positions: set[int] = set()

        for slide in self.slides:

            if not isinstance(
                slide,
                MenuItemSlide,
            ):
                errors["slides"] = (
                    "invalid slide object"
                )
                break

            if slide.position < 1 or slide.position > 6:
                errors["slides"] = (
                    f"invalid slide position: "
                    f"{slide.position}"
                )
                break

            if slide.position in seen_positions:
                errors["slides"] = (
                    f"duplicate slide position: "
                    f"{slide.position}"
                )
                break

            if not slide.imageKey:
                errors["slides"] = (
                    f"imageKey is required for "
                    f"slide {slide.position}"
                )
                break

            seen_positions.add(
                slide.position
            )

        # ---------------------------------------------------------------------
        # Timestamps
        # ---------------------------------------------------------------------

        _require(
            errors,
            "createdAt",
            self.createdAt,
        )

        _validate_iso8601(
            errors,
            "createdAt",
            self.createdAt,
        )

        _require(
            errors,
            "updatedAt",
            self.updatedAt,
        )

        _validate_iso8601(
            errors,
            "updatedAt",
            self.updatedAt,
        )

        # ---------------------------------------------------------------------
        # Allergens
        # ---------------------------------------------------------------------

        if self.allergens is None:
            self.allergens = []

        invalid_allergens = [
            allergen
            for allergen in self.allergens
            if allergen not in ALLOWED_ALLERGENS
        ]

        if invalid_allergens:
            errors["allergens"] = (
                f"unknown allergen codes: "
                f"{invalid_allergens}"
            )

        # ---------------------------------------------------------------------
        # Final validation
        # ---------------------------------------------------------------------

        if errors:
            raise ValidationError(errors)

    # =========================================================================
    # Serialisation
    # =========================================================================

    def to_dict(
        self,
        exclude_none: bool = False,
    ) -> dict[str, Any]:

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
                [
                    size.to_dict(
                        )
                    for size in self.sizes
                ]
                if self.sizes is not None
                else None
            ),

            "slides": [
                slide.to_dict(
                    exclude_none=exclude_none
                )
                for slide in (
                    self.slides or []
                )
            ],
        }

        # ---------------------------------------------------------------------
        # Main image
        # ---------------------------------------------------------------------

        if (
            self.imageKey is not None
            or not exclude_none
        ):
            data["imageKey"] = self.imageKey

        if self.imageUrl is not None:
            data["imageUrl"] = self.imageUrl

        # ---------------------------------------------------------------------
        # AR
        # ---------------------------------------------------------------------

        if (
            self.arModelKey is not None
            or not exclude_none
        ):
            data["arModelKey"] = self.arModelKey

        if self.arModelUrl is not None:
            data["arModelUrl"] = self.arModelUrl

        return data

    # =========================================================================
    # DynamoDB serialisation
    # =========================================================================

    def to_dynamo_item(self) -> dict[str, Any]:
        """
        Build the DynamoDB item.

        IMPORTANT:
            imageUrl and arModelUrl are NEVER stored because they are
            temporary presigned URLs.

        Gallery slide imageUrl values are also removed before persistence.
        """

        item = self.to_dict(
            exclude_none=True
        )

        # Never persist temporary URLs.
        item.pop(
            "imageUrl",
            None,
        )

        item.pop(
            "arModelUrl",
            None,
        )

        # Clean gallery slides before saving.
        item["slides"] = [
            slide.to_dynamo_dict()
            for slide in (
                self.slides or []
            )
        ]

        # DynamoDB keys.
        item["PK"] = self.pk
        item["SK"] = self.sk

        return item

    # =========================================================================
    # Deserialisation
    # =========================================================================

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any],
    ) -> "MenuItem":

        import re

        if not isinstance(data, dict):
            data = {}

        # ---------------------------------------------------------------------
        # Safe integer conversion
        # ---------------------------------------------------------------------

        def _safe_int(
            value: Any,
        ) -> Optional[int]:

            if value is None:
                return None

            if isinstance(
                value,
                bool,
            ):
                return int(value)

            if isinstance(
                value,
                (int, float),
            ):
                return int(value)

            value_str = str(
                value
            ).strip()

            if not value_str:
                return None

            # Supports:
            #   "25"
            #   "25 min"
            #   "500 kcal"
            match = re.search(
                r"-?\d+",
                value_str,
            )

            if match:
                try:
                    return int(
                        match.group()
                    )
                except ValueError:
                    return None

            return None

        # ---------------------------------------------------------------------
        # Price
        # ---------------------------------------------------------------------

        raw_price = data.get(
            "priceMinorUnits",
            0,
        )

        try:
            price_minor_units = int(
                raw_price
            )
        except (
            TypeError,
            ValueError,
        ):
            price_minor_units = 0

        # ---------------------------------------------------------------------
        # Version
        # ---------------------------------------------------------------------

        raw_version = data.get(
            "version",
            1,
        )

        try:
            version = int(
                raw_version
            )
        except (
            TypeError,
            ValueError,
        ):
            version = 1

        # ---------------------------------------------------------------------
        # Sizes
        # ---------------------------------------------------------------------

        sizes_data = data.get(
            "sizes"
        )

        sizes: Optional[
            List[MenuItemSize]
        ]

        if sizes_data is None:
            sizes = None

        elif isinstance(
            sizes_data,
            list,
        ):
            sizes = [
                MenuItemSize.from_dict(
                    size
                )
                for size in sizes_data
                if isinstance(
                    size,
                    dict,
                )
            ]

        else:
            sizes = None

        # ---------------------------------------------------------------------
        # Slides
        # ---------------------------------------------------------------------

        slides_data = data.get(
            "slides",
            [],
        )

        if not isinstance(
            slides_data,
            list,
        ):
            slides_data = []

        slides = [
            MenuItemSlide.from_dict(
                slide
            )
            for slide in slides_data
            if isinstance(
                slide,
                dict,
            )
        ]

        # ---------------------------------------------------------------------
        # Allergens
        # ---------------------------------------------------------------------

        allergens_data = data.get(
            "allergens",
            [],
        )

        if not isinstance(
            allergens_data,
            list,
        ):
            allergens_data = []

        allergens = [
            str(allergen)
            for allergen in allergens_data
            if allergen is not None
        ]

        # ---------------------------------------------------------------------
        # isActive
        # ---------------------------------------------------------------------

        raw_active = data.get(
            "isActive",
            True,
        )

        if isinstance(
            raw_active,
            str,
        ):
            is_active = (
                raw_active.lower()
                not in {
                    "false",
                    "0",
                    "no",
                    "",
                }
            )
        else:
            is_active = bool(
                raw_active
            )

        # ---------------------------------------------------------------------
        # Build MenuItem
        # ---------------------------------------------------------------------

        return cls(

            itemId=str(
                data.get(
                    "itemId",
                    ""
                )
                or ""
            ),

            tenantId=str(
                data.get(
                    "tenantId",
                    ""
                )
                or ""
            ),

            restaurantId=str(
                data.get(
                    "restaurantId",
                    ""
                )
                or ""
            ),

            categoryId=str(
                data.get(
                    "categoryId",
                    ""
                )
                or ""
            ),

            categoryName=str(
                data.get(
                    "categoryName",
                    ""
                )
                or ""
            ),

            name=str(
                data.get(
                    "name",
                    ""
                )
                or ""
            ),

            description=str(
                data.get(
                    "description",
                    ""
                )
                or ""
            ),

            priceMinorUnits=price_minor_units,

            isActive=is_active,

            version=version,

            createdAt=str(
                data.get(
                    "createdAt",
                    ""
                )
                or ""
            ),

            updatedAt=str(
                data.get(
                    "updatedAt",
                    ""
                )
                or ""
            ),

            # Numeric fields
            prepTime=_safe_int(
                data.get(
                    "prepTime"
                )
            ),

            calories=_safe_int(
                data.get(
                    "calories"
                )
            ),

            # Images
            imageKey=data.get(
                "imageKey"
            ),

            imageUrl=data.get(
                "imageUrl"
            ),

            # Allergens
            allergens=allergens,

            # AR
            arModelKey=data.get(
                "arModelKey"
            ),

            arModelUrl=data.get(
                "arModelUrl"
            ),

            # Sizes
            sizes=sizes,

            # Gallery
            slides=slides,
        )

    # =========================================================================
    # DynamoDB deserialisation
    # =========================================================================

    @classmethod
    def from_dynamo_item(
        cls,
        item: dict[str, Any],
    ) -> "MenuItem":

        return cls.from_dict(
            item
        )