"""
app.utils.multipart
===================
Multipart/form-data helpers for API Gateway proxy events.

Extracts *text* fields only (file parts are handled by
``app.repositories.s3_repository.S3Repository``).

Ported from the legacy ``menu/handlers/request.py`` module.
"""
from __future__ import annotations

import base64
import json
import re
from typing import Any

from app.utils.logger import get_logger

log = get_logger(__name__)


def get_body_bytes(event: dict) -> bytes:
    """Return the raw request body as bytes (base64-aware)."""
    body_raw = event.get("body") or ""
    is_b64 = event.get("isBase64Encoded", False)

    if is_b64:
        return base64.b64decode(body_raw)
    if isinstance(body_raw, str):
        return body_raw.encode("latin-1")
    return body_raw


def parse_form_text_fields(event: dict, ct_header: str) -> dict[str, Any]:
    """
    Extract text fields from multipart/form-data.
    Skips file fields. Returns flat dict of field_name -> value.
    """
    body_bytes = get_body_bytes(event)

    boundary = extract_boundary(ct_header)
    if not boundary:
        log.warning("multipart.no_boundary", extra={"ct": ct_header})
        return {}

    boundary_bytes = ("--" + boundary).encode("latin-1")
    parts = body_bytes.split(boundary_bytes)

    fields: dict[str, str] = {}

    for part in parts:
        if not part:
            continue
        part = part.strip(b"\r\n")
        if part == b"--" or part == b"":
            continue

        separator = b"\r\n\r\n" if b"\r\n\r\n" in part else b"\n\n"
        if separator not in part:
            continue

        hdr_raw, _, body_part = part.partition(separator)
        body_part = body_part.rstrip(b"\r\n")

        part_headers: dict[str, str] = {}
        try:
            for line in hdr_raw.decode("utf-8", errors="replace").splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    part_headers[k.strip().lower()] = v.strip()
        except Exception:
            continue

        disposition = part_headers.get("content-disposition", "")
        name_m = re.search(r'name=["\']?([^"\';\r\n]+)["\']?', disposition)
        fname_m = re.search(r'filename=["\']?([^"\';\r\n]*)["\']?', disposition)

        if not name_m:
            continue

        field_name = name_m.group(1).strip()

        # Skip actual file fields only.
        # Text fields may also contain a Content-Type header,
        # so Content-Type alone must NOT identify a file.
        if fname_m:
            continue

        try:
            value = body_part.decode("utf-8")
        except UnicodeDecodeError:
            value = body_part.decode("latin-1")

        fields[field_name] = value

    # Support a 'data' field carrying the full JSON payload
    if "data" in fields:
        try:
            parsed = json.loads(fields["data"])
            if isinstance(parsed, dict):
                merged = {**fields, **parsed}
                merged.pop("data", None)
                return merged
        except (json.JSONDecodeError, ValueError):
            pass

    return fields


def extract_boundary(ct_header: str) -> str:
    """Extract boundary from Content-Type header, handling various formats."""
    m = re.search(r'boundary=([^\s;,]+)', ct_header, re.IGNORECASE)
    if m:
        return m.group(1).strip("\"'")

    m = re.search(r'boundary="([^"]+)"', ct_header, re.IGNORECASE)
    if m:
        return m.group(1)

    return ""
