"""
repository/s3.py — Generic S3 Repository.

Robust multipart parser that handles API Gateway base64 encoding.

Supports:
    - restaurant logo / banner
    - category image
    - item main image
    - item gallery slides 1-6
    - AR .glb model

Item gallery multipart field formats supported:

    image / file
        -> main item image / slide 1

    slide2
    slide3
    slide4
    slide5
    slide6
        -> additional gallery slides

    images / images[]
        -> multiple gallery images
           first image = slide 1
           next images = slide 2, 3, 4, 5, 6

    arModel / arFile
        -> AR .glb model
"""

from __future__ import annotations

import base64
import email
import email.policy
import json
import os
import re
from typing import Any, Optional

import boto3
from botocore.exceptions import ClientError

from app.utils.logger import get_logger


log = get_logger(__name__)


# ============================================================================
# Configuration
# ============================================================================

_BUCKET = os.environ.get("S3_BUCKET", "menu-assets")

_READ_EXPIRY = int(
    os.environ.get(
        "S3_READ_URL_EXPIRY_SECONDS",
        "3600",
    )
)

_MAX_IMAGE_MB = int(
    os.environ.get(
        "MAX_IMAGE_MB",
        "5",
    )
)

_MAX_AR_MB = int(
    os.environ.get(
        "MAX_AR_MB",
        "50",
    )
)


_IMAGE_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


_AR_CONTENT_TYPES = {
    "model/gltf-binary": ".glb",
    "application/octet-stream": ".glb",
}


_MAX_GALLERY_IMAGES = 6


# ============================================================================
# Exceptions
# ============================================================================

class S3RepositoryError(Exception):
    pass


class FileTooLargeError(S3RepositoryError):
    pass


class InvalidContentTypeError(S3RepositoryError):
    pass


class MissingFileError(S3RepositoryError):
    pass


class MissingFieldError(S3RepositoryError):
    pass


# ============================================================================
# Parsed multipart form
# ============================================================================

class ParsedForm:
    def __init__(self):
        # Backward-compatible dictionary.
        #
        # Existing code can continue doing:
        #
        # form.files.get("file")
        #
        # For repeated fields, this contains the LAST file.
        self.files: dict[str, dict] = {}

        # New collection which preserves ALL repeated files.
        #
        # Example:
        #
        # images -> [file1, file2, file3]
        #
        self.files_multi: dict[str, list[dict]] = {}

        # Normal text fields.
        self.fields: dict[str, str] = {}


# ============================================================================
# Multipart helpers
# ============================================================================

def _get_body_bytes(event: dict) -> bytes:
    """
    Get request body as bytes.

    API Gateway can send Lambda bodies as:
        - base64 encoded string
        - normal string
        - bytes
    """

    body_raw = event.get("body") or b""

    is_b64 = event.get(
        "isBase64Encoded",
        False,
    )

    if is_b64:
        if isinstance(body_raw, str):
            return base64.b64decode(body_raw)

        return base64.b64decode(body_raw)

    if isinstance(body_raw, str):
        return body_raw.encode("latin-1")

    return body_raw


def _extract_boundary(ct_header: str) -> str:
    """
    Extract multipart boundary from Content-Type.
    """

    match = re.search(
        r'boundary=([^\s;,]+)',
        ct_header,
        re.IGNORECASE,
    )

    if match:
        return match.group(1).strip('"\' ')

    return ""


def _detect_content_type_from_filename(
    filename: str,
) -> str:
    """
    Detect content type from filename when API Gateway/browser
    sends application/octet-stream.
    """

    lower = filename.lower()

    if lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"

    if lower.endswith(".png"):
        return "image/png"

    if lower.endswith(".webp"):
        return "image/webp"

    if lower.endswith(".glb"):
        return "model/gltf-binary"

    return "application/octet-stream"


def _add_file_to_form(
    result: ParsedForm,
    field_name: str,
    file_info: dict,
) -> None:
    """
    Add a parsed file.

    IMPORTANT:
    Multiple files can use the same multipart field name.

    Example:

        images -> image1
        images -> image2
        images -> image3

    They will all be preserved in:

        result.files_multi["images"]
    """

    result.files_multi.setdefault(
        field_name,
        [],
    ).append(file_info)

    # Backward compatibility:
    #
    # form.files.get("file")
    #
    # still works.

    result.files[field_name] = file_info


# ============================================================================
# Multipart parser
# ============================================================================

def parse_multipart(event: dict) -> ParsedForm:
    """
    Parse multipart/form-data from an API Gateway Lambda proxy event.

    Handles:
        - base64 encoded bodies
        - plain bodies
        - repeated multipart file fields
        - normal single file fields
        - images / images[]
        - data JSON blob
    """

    result = ParsedForm()

    headers = {
        k.lower(): v
        for k, v in (event.get("headers") or {}).items()
    }

    ct = headers.get(
        "content-type",
        "",
    )

    if "multipart/form-data" not in ct.lower():
        log.warning(
            "Not multipart",
            extra={
                "ct": ct,
            },
        )
        return result

    boundary = _extract_boundary(ct)

    if not boundary:
        log.warning(
            "No boundary found",
            extra={
                "ct": ct,
            },
        )
        return result

    body_bytes = _get_body_bytes(event)

    log.info(
        "Parsing multipart",
        extra={
            "boundary": boundary,
            "body_size": len(body_bytes),
            "is_b64": event.get(
                "isBase64Encoded",
                False,
            ),
        },
    )

    # ------------------------------------------------------------------------
    # Build MIME message
    # ------------------------------------------------------------------------

    mime_header = (
        f"MIME-Version: 1.0\r\n"
        f"Content-Type: {ct}\r\n"
        f"\r\n"
    ).encode()

    full_message = (
        mime_header
        + body_bytes
    )

    try:
        msg = email.message_from_bytes(
            full_message,
            policy=email.policy.compat32,
        )

    except Exception as exc:
        log.warning(
            "email.message_from_bytes failed",
            extra={
                "error": str(exc),
            },
        )

        return _parse_multipart_manual(
            body_bytes,
            boundary,
        )

    if not msg.is_multipart():
        log.warning(
            "Message is not multipart — trying manual parser"
        )

        return _parse_multipart_manual(
            body_bytes,
            boundary,
        )

    # ------------------------------------------------------------------------
    # Read multipart parts
    # ------------------------------------------------------------------------

    for part in msg.walk():

        if part.get_content_maintype() == "multipart":
            continue

        disposition = part.get(
            "Content-Disposition",
            "",
        )

        if not disposition:
            continue

        # --------------------------------------------------------------------
        # Field name
        # --------------------------------------------------------------------

        name_match = re.search(
            r'name=["\']?([^"\';\s]+)["\']?',
            disposition,
        )

        if not name_match:
            continue

        field_name = name_match.group(1)

        # --------------------------------------------------------------------
        # File name
        # --------------------------------------------------------------------

        filename_match = re.search(
            r'filename=["\']?([^"\';\r\n]*)["\']?',
            disposition,
        )

        payload = part.get_payload(
            decode=True
        )

        if payload is None:
            payload = b""

        # --------------------------------------------------------------------
        # File
        # --------------------------------------------------------------------

        if filename_match:

            filename = filename_match.group(1)

            file_ct = (
                part.get_content_type()
                or ""
            )

            if (
                not file_ct
                or file_ct == "application/octet-stream"
            ):
                file_ct = (
                    _detect_content_type_from_filename(
                        filename
                    )
                )

            file_info = {
                "bytes": payload,
                "file_name": filename,
                "content_type": file_ct,
            }

            _add_file_to_form(
                result,
                field_name,
                file_info,
            )

            log.info(
                "File field parsed",
                extra={
                    "field": field_name,
                    "file_name": filename,
                    "ct": file_ct,
                    "size": len(payload),
                },
            )

        # --------------------------------------------------------------------
        # Normal text field
        # --------------------------------------------------------------------

        else:

            try:
                result.fields[field_name] = (
                    payload.decode("utf-8")
                )

            except Exception:

                result.fields[field_name] = (
                    payload.decode(
                        "latin-1",
                        errors="replace",
                    )
                )

    # ------------------------------------------------------------------------
    # Handle data JSON blob
    # ------------------------------------------------------------------------

    if "data" in result.fields:

        try:
            parsed = json.loads(
                result.fields["data"]
            )

            if isinstance(parsed, dict):

                merged = {
                    **result.fields,
                    **parsed,
                }

                merged.pop(
                    "data",
                    None,
                )

                result.fields = merged

        except Exception:
            pass

    # ------------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------------

    log.info(
        "Multipart parsed",
        extra={
            "text_fields": list(
                result.fields.keys()
            ),
            "file_fields": list(
                result.files.keys()
            ),
            "file_fields_multi": {
                key: len(value)
                for key, value in result.files_multi.items()
            },
        },
    )

    return result


# ============================================================================
# Manual multipart fallback
# ============================================================================

def _parse_multipart_manual(
    body_bytes: bytes,
    boundary: str,
) -> ParsedForm:

    result = ParsedForm()

    boundary_bytes = (
        "--" + boundary
    ).encode("latin-1")

    parts = body_bytes.split(
        boundary_bytes
    )

    log.info(
        "Manual parser",
        extra={
            "parts": len(parts),
            "boundary": boundary,
        },
    )

    for part in parts:

        if not part:
            continue

        part = part.strip(
            b"\r\n"
        )

        if part in (
            b"--",
            b"",
        ):
            continue

        # ------------------------------------------------------------
        # Headers/body separator
        # ------------------------------------------------------------

        if b"\r\n\r\n" in part:
            sep = b"\r\n\r\n"

        elif b"\n\n" in part:
            sep = b"\n\n"

        else:
            continue

        hdr_raw, _, body_part = (
            part.partition(sep)
        )

        body_part = body_part.rstrip(
            b"\r\n"
        )

        # ------------------------------------------------------------
        # Part headers
        # ------------------------------------------------------------

        part_headers: dict[str, str] = {}

        for line in hdr_raw.decode(
            "latin-1",
            errors="replace",
        ).splitlines():

            if ":" not in line:
                continue

            key, _, value = line.partition(
                ":"
            )

            part_headers[
                key.strip().lower()
            ] = value.strip()

        disposition = part_headers.get(
            "content-disposition",
            "",
        )

        name_match = re.search(
            r'name=["\']?([^"\';\r\n]+)["\']?',
            disposition,
        )

        filename_match = re.search(
            r'filename=["\']?([^"\';\r\n]*)["\']?',
            disposition,
        )

        if not name_match:
            continue

        field_name = (
            name_match.group(1).strip()
        )

        # ------------------------------------------------------------
        # File
        # ------------------------------------------------------------

        if filename_match:

            filename = (
                filename_match.group(1).strip()
            )

            file_ct = (
                part_headers
                .get(
                    "content-type",
                    "",
                )
                .split(";")[0]
                .strip()
            )

            if (
                not file_ct
                or file_ct == "application/octet-stream"
            ):
                file_ct = (
                    _detect_content_type_from_filename(
                        filename
                    )
                )

            file_info = {
                "bytes": body_part,
                "file_name": filename,
                "content_type": file_ct,
            }

            _add_file_to_form(
                result,
                field_name,
                file_info,
            )

            log.info(
                "Manual: file field",
                extra={
                    "field": field_name,
                    "file_name": filename,
                    "size": len(body_part),
                },
            )

        # ------------------------------------------------------------
        # Text field
        # ------------------------------------------------------------

        else:

            try:
                result.fields[field_name] = (
                    body_part.decode("utf-8")
                )

            except Exception:

                result.fields[field_name] = (
                    body_part.decode(
                        "latin-1",
                        errors="replace",
                    )
                )

    return result


def is_multipart(event: dict) -> bool:

    headers = {
        k.lower(): v
        for k, v in (event.get("headers") or {}).items()
    }

    return (
        "multipart/form-data"
        in headers.get(
            "content-type",
            "",
        ).lower()
    )


# ============================================================================
# S3 key builders
# ============================================================================

def restaurant_logo_key(
    tenant_id: str,
    restaurant_id: str,
    ext: str,
) -> str:

    return (
        f"TENANT#{tenant_id}"
        f"/restaurants/{restaurant_id}"
        f"/logo{ext}"
    )


def restaurant_banner_key(
    tenant_id: str,
    restaurant_id: str,
    ext: str,
) -> str:

    return (
        f"TENANT#{tenant_id}"
        f"/restaurants/{restaurant_id}"
        f"/banner{ext}"
    )


def category_image_key(
    tenant_id: str,
    restaurant_id: str,
    category_id: str,
    ext: str,
) -> str:

    return (
        f"TENANT#{tenant_id}"
        f"/restaurants/{restaurant_id}"
        f"/categories/{category_id}{ext}"
    )


def item_image_key(
    tenant_id: str,
    restaurant_id: str,
    item_id: str,
    ext: str,
) -> str:

    return (
        f"TENANT#{tenant_id}"
        f"/restaurants/{restaurant_id}"
        f"/items/{item_id}{ext}"
    )


def item_slide_image_key(
    tenant_id: str,
    restaurant_id: str,
    item_id: str,
    position: int,
    ext: str,
) -> str:

    return (
        f"TENANT#{tenant_id}"
        f"/restaurants/{restaurant_id}"
        f"/items/{item_id}"
        f"/slide-{position}{ext}"
    )


def item_ar_key(
    tenant_id: str,
    restaurant_id: str,
    item_id: str,
) -> str:

    return (
        f"TENANT#{tenant_id}"
        f"/restaurants/{restaurant_id}"
        f"/ar-models/{item_id}.glb"
    )


# ============================================================================
# Validators
# ============================================================================

def validate_image(
    file_bytes: bytes,
    content_type: str,
) -> str:

    ct = (
        content_type
        .lower()
        .split(";")[0]
        .strip()
    )

    if ct not in _IMAGE_CONTENT_TYPES:

        raise InvalidContentTypeError(
            f"Invalid image type '{ct}'. "
            "Allowed: jpeg, png, webp"
        )

    if len(file_bytes) > (
        _MAX_IMAGE_MB * 1024 * 1024
    ):

        raise FileTooLargeError(
            f"Image exceeds {_MAX_IMAGE_MB}MB limit"
        )

    return _IMAGE_CONTENT_TYPES[ct]


def validate_ar(
    file_bytes: bytes,
    content_type: str,
) -> None:

    ct = (
        content_type
        .lower()
        .split(";")[0]
        .strip()
    )

    if ct not in _AR_CONTENT_TYPES:

        raise InvalidContentTypeError(
            f"Invalid AR type '{ct}'. "
            "Only .glb files allowed"
        )

    if len(file_bytes) > (
        _MAX_AR_MB * 1024 * 1024
    ):

        raise FileTooLargeError(
            f"AR model exceeds {_MAX_AR_MB}MB limit"
        )


# ============================================================================
# S3 Repository
# ============================================================================

class S3Repository:

    def __init__(
        self,
        s3_client=None,
    ) -> None:

        self._s3 = (
            s3_client
            or boto3.client("s3")
        )

    # ========================================================================
    # Generic upload
    # ========================================================================

    def upload(
        self,
        file_bytes: bytes,
        s3_key: str,
        content_type: str,
    ) -> str:

        try:

            self._s3.put_object(
                Bucket=_BUCKET,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type,
            )

            log.info(
                "S3 upload OK",
                extra={
                    "key": s3_key,
                    "size": len(file_bytes),
                },
            )

            return s3_key

        except ClientError as exc:

            log.error(
                "S3 upload failed",
                extra={
                    "key": s3_key,
                    "error": str(exc),
                },
            )

            raise

    # ========================================================================
    # Presigned read URL
    # ========================================================================

    def get_read_url(
        self,
        s3_key: Optional[str],
    ) -> Optional[str]:

        if not s3_key:
            return None

        try:

            return self._s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": _BUCKET,
                    "Key": s3_key,
                },
                ExpiresIn=_READ_EXPIRY,
            )

        except ClientError:

            return None

    # ========================================================================
    # Restaurant images
    # ========================================================================

    def upload_restaurant_images(
        self,
        event: dict,
        restaurant_id: str,
        tenant_id: str,
    ) -> dict[str, Any]:

        form = parse_multipart(event)

        result: dict[str, Any] = {}

        # --------------------------------------------------------------------
        # Logo
        # --------------------------------------------------------------------

        logo_info = (
            form.files.get("logo")
            or form.files.get("file")
        )

        if (
            logo_info
            and logo_info.get("bytes")
        ):

            try:

                ext = validate_image(
                    logo_info["bytes"],
                    logo_info["content_type"],
                )

                s3_key = restaurant_logo_key(
                    tenant_id,
                    restaurant_id,
                    ext,
                )

                self.upload(
                    logo_info["bytes"],
                    s3_key,
                    logo_info["content_type"],
                )

                result["logoKey"] = s3_key

                result["logoUrl"] = (
                    self.get_read_url(
                        s3_key
                    )
                )

            except Exception as exc:

                log.warning(
                    "Logo upload failed",
                    extra={
                        "error": str(exc)
                    },
                )

        # --------------------------------------------------------------------
        # Banner
        # --------------------------------------------------------------------

        banner_info = form.files.get(
            "banner"
        )

        if (
            banner_info
            and banner_info.get("bytes")
        ):

            try:

                ext = validate_image(
                    banner_info["bytes"],
                    banner_info["content_type"],
                )

                s3_key = restaurant_banner_key(
                    tenant_id,
                    restaurant_id,
                    ext,
                )

                self.upload(
                    banner_info["bytes"],
                    s3_key,
                    banner_info["content_type"],
                )

                result["bannerKey"] = s3_key

                result["bannerUrl"] = (
                    self.get_read_url(
                        s3_key
                    )
                )

            except Exception as exc:

                log.warning(
                    "Banner upload failed",
                    extra={
                        "error": str(exc)
                    },
                )

        if not result:

            log.info(
                "No restaurant images in request",
                extra={
                    "fields": list(
                        form.files.keys()
                    )
                },
            )

        return result

    # ========================================================================
    # Category image
    # ========================================================================

    def upload_category_image(
        self,
        event: dict,
        restaurant_id: str,
        category_id: str,
        tenant_id: str,
    ) -> tuple[
        Optional[str],
        Optional[str],
    ]:

        form = parse_multipart(event)

        file_info = form.files.get(
            "file"
        )

        if (
            not file_info
            or not file_info.get("bytes")
        ):

            log.info(
                "No category image in request"
            )

            return None, None

        ext = validate_image(
            file_info["bytes"],
            file_info["content_type"],
        )

        s3_key = category_image_key(
            tenant_id,
            restaurant_id,
            category_id,
            ext,
        )

        self.upload(
            file_info["bytes"],
            s3_key,
            file_info["content_type"],
        )

        return (
            s3_key,
            self.get_read_url(
                s3_key
            ),
        )

    # ========================================================================
    # Item assets
    # ========================================================================

    def upload_item_assets(
        self,
        event: dict,
        restaurant_id: str,
        item_id: str,
        tenant_id: str,
    ) -> dict[str, Any]:
        """
        Upload item main image, gallery images and/or AR model.

        Supported multipart fields:

            image / file
                -> main image / slide 1

            images / images[]
                -> multiple gallery images
                   first = slide 1
                   second = slide 2
                   ...
                   sixth = slide 6

            slide2
            slide3
            slide4
            slide5
            slide6
                -> explicit gallery positions

            arModel / arFile
                -> AR .glb model

        Maximum gallery size: 6 images.

        IMPORTANT FOR EDIT:

        This method uploads only files that are actually present
        in the incoming multipart request.

        Therefore an edit request can send:
            - only a new main image
            - only new gallery images
            - only a new AR model
            - any combination of the above

        Existing non-file fields are not touched by this method.
        """

        form = parse_multipart(event)

        result: dict[str, Any] = {
            "imageKey": None,
            "imageUrl": None,
            "slides": [],
            "arModelKey": None,
            "arModelUrl": None,
        }

        # ====================================================================
        # 1. Collect gallery files
        # ====================================================================

        gallery_files: list[
            tuple[int, dict]
        ] = []

        # --------------------------------------------------------------------
        # Main image
        # --------------------------------------------------------------------

        main_image_info = (
            form.files.get("image")
            or form.files.get("file")
        )

        has_main_image = bool(
            main_image_info
            and main_image_info.get("bytes")
        )

        if has_main_image:

            gallery_files.append(
                (
                    1,
                    main_image_info,
                )
            )

        # --------------------------------------------------------------------
        # Repeated images / images[]
        # --------------------------------------------------------------------

        repeated_images: list[dict] = []

        repeated_images.extend(
            form.files_multi.get(
                "images",
                [],
            )
        )

        repeated_images.extend(
            form.files_multi.get(
                "images[]",
                [],
            )
        )

        # --------------------------------------------------------------------
        # If images/images[] were sent without image/file:
        #
        # first image = slide 1
        # --------------------------------------------------------------------

        if repeated_images:

            if not has_main_image:

                for index, image_info in enumerate(
                    repeated_images[
                        :_MAX_GALLERY_IMAGES
                    ],
                    start=1,
                ):

                    if not image_info.get("bytes"):
                        continue

                    gallery_files.append(
                        (
                            index,
                            image_info,
                        )
                    )

            # ----------------------------------------------------------------
            # Main image already exists.
            #
            # Main image = slide 1.
            #
            # Additional repeated images start at slide 2.
            # ----------------------------------------------------------------

            else:

                next_position = 2

                for image_info in repeated_images:

                    if next_position > _MAX_GALLERY_IMAGES:
                        break

                    if not image_info.get("bytes"):
                        continue

                    # Avoid uploading the exact same bytes twice when
                    # frontend sends the main image in both:
                    #
                    # image
                    # images[]
                    #
                    if (
                        image_info.get("bytes")
                        == main_image_info.get("bytes")
                    ):
                        continue

                    gallery_files.append(
                        (
                            next_position,
                            image_info,
                        )
                    )

                    next_position += 1

        # --------------------------------------------------------------------
        # Explicit slide2-slide6 fields
        # --------------------------------------------------------------------

        for position in range(
            2,
            _MAX_GALLERY_IMAGES + 1,
        ):

            field_name = (
                f"slide{position}"
            )

            slide_info = form.files.get(
                field_name
            )

            if (
                not slide_info
                or not slide_info.get("bytes")
            ):
                continue

            # Explicit slide position wins over images[] position.

            gallery_files = [
                (
                    existing_position,
                    existing_info,
                )
                for (
                    existing_position,
                    existing_info,
                ) in gallery_files
                if existing_position != position
            ]

            gallery_files.append(
                (
                    position,
                    slide_info,
                )
            )

        # --------------------------------------------------------------------
        # Sort and limit
        # --------------------------------------------------------------------

        gallery_files.sort(
            key=lambda item: item[0]
        )

        gallery_files = gallery_files[
            :_MAX_GALLERY_IMAGES
        ]

        log.info(
            "Item gallery files collected",
            extra={
                "item_id": item_id,
                "positions": [
                    position
                    for position, _ in gallery_files
                ],
                "file_names": [
                    info.get("file_name")
                    for _, info in gallery_files
                ],
            },
        )

        # ====================================================================
        # 2. Upload gallery images
        # ====================================================================

        for position, image_info in gallery_files:

            try:

                ext = validate_image(
                    image_info["bytes"],
                    image_info["content_type"],
                )

                # ------------------------------------------------------------
                # Slide 1 = main item image
                # ------------------------------------------------------------

                if position == 1:

                    s3_key = item_image_key(
                        tenant_id,
                        restaurant_id,
                        item_id,
                        ext,
                    )

                # ------------------------------------------------------------
                # Slides 2-6
                # ------------------------------------------------------------

                else:

                    s3_key = item_slide_image_key(
                        tenant_id,
                        restaurant_id,
                        item_id,
                        position,
                        ext,
                    )

                # ------------------------------------------------------------
                # Upload
                #
                # IMPORTANT:
                # S3 put_object replaces the object when the same key exists.
                #
                # Therefore editing an item and uploading a new image
                # replaces the previous image for that same position.
                # ------------------------------------------------------------

                self.upload(
                    image_info["bytes"],
                    s3_key,
                    image_info["content_type"],
                )

                image_url = self.get_read_url(
                    s3_key
                )

                # ------------------------------------------------------------
                # Main image result
                # ------------------------------------------------------------

                if position == 1:

                    result["imageKey"] = s3_key

                    result["imageUrl"] = image_url

                # ------------------------------------------------------------
                # Every uploaded image is also a slide
                # ------------------------------------------------------------

                result["slides"].append(
                    {
                        "position": position,
                        "imageKey": s3_key,
                        "imageUrl": image_url,
                    }
                )

                log.info(
                    "Item gallery image uploaded",
                    extra={
                        "item_id": item_id,
                        "position": position,
                        "key": s3_key,
                        "file_name": image_info.get(
                            "file_name"
                        ),
                    },
                )

            except Exception as exc:

                log.warning(
                    "Item gallery image upload failed",
                    extra={
                        "item_id": item_id,
                        "position": position,
                        "file_name": image_info.get(
                            "file_name"
                        ),
                        "error": str(exc),
                    },
                )

        # ====================================================================
        # 3. AR model
        # ====================================================================

        ar_info = (
            form.files.get("arModel")
            or form.files.get("arFile")
        )

        if (
            ar_info
            and ar_info.get("bytes")
        ):

            try:

                ct = (
                    ar_info.get("content_type")
                    or "model/gltf-binary"
                )

                if ct == "application/octet-stream":

                    ct = "model/gltf-binary"

                validate_ar(
                    ar_info["bytes"],
                    ct,
                )

                s3_key = item_ar_key(
                    tenant_id,
                    restaurant_id,
                    item_id,
                )

                self.upload(
                    ar_info["bytes"],
                    s3_key,
                    ct,
                )

                result["arModelKey"] = s3_key

                result["arModelUrl"] = (
                    self.get_read_url(
                        s3_key
                    )
                )

                log.info(
                    "AR model uploaded",
                    extra={
                        "key": s3_key,
                        "item_id": item_id,
                    },
                )

            except Exception as exc:

                log.warning(
                    "AR model upload failed",
                    extra={
                        "error": str(exc),
                        "item_id": item_id,
                    },
                )

        else:

            log.info(
                "No arModel field found",
                extra={
                    "fields": list(
                        form.files.keys()
                    )
                },
            )

        # ====================================================================
        # 4. Final result
        # ====================================================================

        log.info(
            "Item assets upload completed",
            extra={
                "item_id": item_id,
                "imageKey": result["imageKey"],
                "slides_count": len(
                    result["slides"]
                ),
                "slides": [
                    {
                        "position": slide["position"],
                        "imageKey": slide["imageKey"],
                    }
                    for slide in result["slides"]
                ],
                "arModelKey": result["arModelKey"],
            },
        )

        return result