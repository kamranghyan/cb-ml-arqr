"""
app.schemas.ar_asset
===================
FastAPI-native request model for the AR assets API.
"""
from __future__ import annotations

from pydantic import BaseModel


class ArUpdateBody(BaseModel):
    arModelKey:  str | None = None
    arScale:     float | None = None
    arPlacement: str | None = None
