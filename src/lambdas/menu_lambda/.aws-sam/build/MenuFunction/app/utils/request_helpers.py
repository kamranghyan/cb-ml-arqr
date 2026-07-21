"""
app.utils.request_helpers
=========================
Small helpers shared by the API endpoint modules:

* ``parse_body``          — JSON *or* multipart text-field body → dict
* ``build_gateway_event`` — wrap a FastAPI Request body back into a minimal
                            API Gateway-style event (the S3Repository's
                            multipart parser expects that shape)
* ``coerce_bool`` / ``coerce_int`` — form fields arrive as strings
"""
from __future__ import annotations

import base64

from fastapi import Request

from app.utils.multipart import parse_form_text_fields


async def parse_body(request: Request) -> dict:
    """Parse the request body: JSON or multipart text fields."""
    ct = request.headers.get("content-type", "")
    if "multipart/form-data" in ct:
        body_bytes = await request.body()
        raw_event = build_gateway_event(body_bytes, ct)
        return parse_form_text_fields(raw_event, ct)
    try:
        body = await request.json()
        return body if isinstance(body, dict) else {}
    except Exception:
        return {}


def build_gateway_event(body_bytes: bytes, content_type: str) -> dict:
    """Build a minimal API Gateway-like event dict for the S3 repository."""
    return {
        "body": base64.b64encode(body_bytes).decode(),
        "isBase64Encoded": True,
        "headers": {"content-type": content_type},
    }


def coerce_bool(body: dict, field: str) -> None:
    if field in body and isinstance(body[field], str):
        body[field] = body[field].lower() in ("true", "1", "yes")


def coerce_int(body: dict, field: str) -> None:
    if field in body and isinstance(body[field], str):
        try:
            body[field] = int(body[field])
        except ValueError:
            pass
