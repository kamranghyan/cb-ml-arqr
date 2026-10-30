"""
Restaurant entity model.

DynamoDB key pattern:
  PK = TENANT#{tenantId}#RESTAURANT#{restaurantId}
  SK = METADATA

Image fields:
  logoKey    -- S3 object key (stored in DynamoDB, never returned raw to clients)
  logoUrl    -- presigned GET URL injected at read time by the service layer (not stored)
  bannerKey  -- S3 key for the wide hero image a guest sees at the top of the menu
  bannerUrl  -- presigned GET URL for the banner, injected at read time

The *Key fields are what we own; the *Url fields are generated fresh on every
read because presigned URLs expire. Neither Url is ever written to DynamoDB.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .base import (
    BaseModel, ValidationError,
    _require, _validate_uuid, _validate_iso8601,
    _validate_max_len, _IANA_TZ_RE, _ISO4217_RE,
)
from .address import Address


@dataclass
class Restaurant(BaseModel):
    restaurantId: str
    tenantId: str
    name: str
    address: Address
    timezone: str
    currencyCode: str
    isActive: bool
    createdAt: str
    updatedAt: str
    logoKey: Optional[str] = None     # S3 key -- stored in DDB, used to generate URL
    logoUrl: Optional[str] = None     # presigned GET URL -- injected at read, not stored
    bannerKey: Optional[str] = None   # S3 key for the guest-facing hero image
    bannerUrl: Optional[str] = None   # presigned GET URL -- injected at read, not stored

    # -- What a guest sees on the landing screen ---------------------------
    # These used to be hardcoded in the guest app, which meant every
    # restaurant claimed the same hours and the same cuisines. They belong to
    # the restaurant, so the tenant sets them when creating or editing it.
    tagline: Optional[str] = None          # "Fine Dining Experience"
    cuisineTags: list[str] = field(default_factory=list)   # ["BBQ", "Pakistani"]
    openingHours: Optional[str] = None     # "10:00AM - 11:00PM"
    deliveryNote: Optional[str] = None     # "Free Delivery", "30 min delivery"
    ratingValue: Optional[float] = None    # 4.8 -- shown only if set
    ratingCount: Optional[int] = None      # 120

    # -- Social media links -----------------------------------------------
    socialMedia: dict[str, Optional[str]] = field(default_factory=dict)

    # -- Dining-table zones -------------------------------------------------
    # Each zone is {"id": "...", "name": "Main Hall", "outlet": "Main Hall"}.
    # Created once via the "New Zone" modal, then reused as a dropdown option
    # every time a new table is created — nobody retypes "Main Hall" by hand
    # for the 30th table. The id is what "Manage Zones" edits/deletes by, so
    # renaming a zone never breaks which one you meant. Lives on the
    # restaurant record — no dedicated table needed.
    zones: list[dict[str, str]] = field(default_factory=list)

    # -- DynamoDB key helpers -----------------------------------------------

    @property
    def pk(self) -> str:
        return f"TENANT#{self.tenantId}#RESTAURANT#{self.restaurantId}"

    @property
    def sk(self) -> str:
        return "METADATA"

    # -- Validation ---------------------------------------------------------

    def validate(self) -> None:
        errors: dict[str, str] = {}

        _require(errors, "restaurantId", self.restaurantId)
        _validate_uuid(errors, "restaurantId", self.restaurantId)

        _require(errors, "tenantId", self.tenantId)
        _validate_uuid(errors, "tenantId", self.tenantId)

        _require(errors, "name", self.name)
        _validate_max_len(errors, "name", self.name, 200)

        _require(errors, "timezone", self.timezone)
        if self.timezone and not _IANA_TZ_RE.match(self.timezone):
            errors["timezone"] = "must be a valid IANA timezone (e.g. Asia/Karachi)"

        _require(errors, "currencyCode", self.currencyCode)
        if self.currencyCode and not _ISO4217_RE.match(self.currencyCode):
            errors["currencyCode"] = "must be a 3-letter ISO 4217 code"

        _require(errors, "createdAt", self.createdAt)
        _validate_iso8601(errors, "createdAt", self.createdAt)

        _require(errors, "updatedAt", self.updatedAt)
        _validate_iso8601(errors, "updatedAt", self.updatedAt)

        if self.tagline:
            _validate_max_len(errors, "tagline", self.tagline, 120)

        if self.ratingValue is not None and not (0 <= self.ratingValue <= 5):
            errors["ratingValue"] = "must be between 0 and 5"

        if self.ratingCount is not None and self.ratingCount < 0:
            errors["ratingCount"] = "cannot be negative"

            if len(self.cuisineTags) > 10:
                errors["cuisineTags"] = "at most 10 tags"

        # -- Zones --------------------------------------------------------
        for i, zone in enumerate(self.zones):
            if not isinstance(zone, dict) or not str(zone.get("name", "")).strip():
                errors[f"zones.{i}"] = "each zone needs a non-empty name"

        # -- Social media links --------------------------------------------
        allowed_socials = {
            "facebook",
            "instagram",
            "tiktok",
            "x",
            "linkedin",
            "youtube",
        }

        for platform, url in self.socialMedia.items():
            if platform not in allowed_socials:
                errors[f"socialMedia.{platform}"] = "unsupported social media platform"
                continue

            if url is not None:
                if not isinstance(url, str):
                    errors[f"socialMedia.{platform}"] = "must be a string"
                elif len(url) > 500:
                    errors[f"socialMedia.{platform}"] = "URL is too long"

        if self.address:
            try:
                self.address.validate()
            except ValidationError as exc:
                for k, v in exc.errors.items():
                    errors[f"address.{k}"] = v
        else:
            errors["address"] = "required"
            
        if errors:
                raise ValidationError(errors)

    # -- Serialisation ------------------------------------------------------

    def to_dict(self, exclude_none: bool = False) -> dict[str, Any]:
        data: dict[str, Any] = {
            "restaurantId": self.restaurantId,
            "tenantId": self.tenantId,
            "name": self.name,
            "address": self.address.to_dict(),
            "timezone": self.timezone,
            "currencyCode": self.currencyCode,
            "isActive": self.isActive,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt,
        }
        if self.logoKey is not None or not exclude_none:
            data["logoKey"] = self.logoKey
        if self.logoUrl is not None:
            data["logoUrl"] = self.logoUrl
        if self.bannerKey is not None or not exclude_none:
            data["bannerKey"] = self.bannerKey
        if self.bannerUrl is not None:
            data["bannerUrl"] = self.bannerUrl

        # Presentation fields: send them when set. A rating that was never
        # entered stays absent rather than becoming a zero, so the guest app
        # can simply not draw the stars.
        for key, value in (
            ("tagline",      self.tagline),
            ("openingHours", self.openingHours),
            ("deliveryNote", self.deliveryNote),
            ("ratingValue",  self.ratingValue),
            ("ratingCount",  self.ratingCount),
        ):
            if value is not None or not exclude_none:
                data[key] = value

        if self.cuisineTags or not exclude_none:
            data["cuisineTags"] = self.cuisineTags

        if self.zones or not exclude_none:
            data["zones"] = self.zones

        data["socialMedia"] = self.socialMedia

        return data

    def to_dynamo_item(self) -> dict[str, Any]:
        """DDB item -- presigned URLs intentionally excluded (never persisted)."""
        item = self.to_dict(exclude_none=True)
        item.pop("logoUrl", None)
        item.pop("bannerUrl", None)
        item["PK"] = self.pk
        item["SK"] = self.sk
        return item

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Restaurant":
        addr_raw = data.get("address") or {}
        address = (
            Address.from_dict(addr_raw)
            if isinstance(addr_raw, dict)
            else Address("", "", "", "")
        )
        return cls(
            restaurantId=data.get("restaurantId", ""),
            tenantId=data.get("tenantId", ""),
            name=data.get("name", ""),
            address=address,
            timezone=data.get("timezone", ""),
            currencyCode=data.get("currencyCode", ""),
            isActive=bool(data.get("isActive", True)),
            createdAt=data.get("createdAt", ""),
            updatedAt=data.get("updatedAt", ""),
            logoKey=data.get("logoKey"),
            logoUrl=data.get("logoUrl"),
            bannerKey=data.get("bannerKey"),
            bannerUrl=data.get("bannerUrl"),
            tagline=data.get("tagline"),
            cuisineTags=list(data.get("cuisineTags") or []),
            openingHours=data.get("openingHours"),
            deliveryNote=data.get("deliveryNote"),
            ratingValue=(
                float(data["ratingValue"]) if data.get("ratingValue") is not None else None
            ),
            ratingCount=(
                int(data["ratingCount"]) if data.get("ratingCount") is not None else None
            ),
            socialMedia=dict(data.get("socialMedia") or {}),
            zones=list(data.get("zones") or []),
        )

    @classmethod
    def from_dynamo_item(cls, item: dict[str, Any]) -> "Restaurant":
        return cls.from_dict(item)