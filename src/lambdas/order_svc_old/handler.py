"""
handler.py  (Lambda handler entry point)
=========================================
AWS Lambda is configured with:   Handler = handler.lambda_handler

This file is intentionally thin — all logic lives in app/.
Its only job is to:
    1. Bind per-invocation context to the structured logger
    2. Delegate to the Mangum ASGI handler

Why a separate file from app/main.py?
    Keeps the ASGI app independently importable for local ``uvicorn`` dev and
    pytest without needing a real Lambda context object.
"""
from __future__ import annotations

import os
import sys

# ---------------------------------------------------------------------------
# LOCAL DEV PATH SHIM
# In Lambda, the shared layer is mounted at /opt/python (already on sys.path).
# When running outside Lambda (pytest, uvicorn), insert the repo's layer
# source directory so `import shared` resolves.
# ---------------------------------------------------------------------------
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_SHARED_LAYER = os.path.join(_REPO_ROOT, "layers", "shared_layer", "python")

if os.path.isdir(_SHARED_LAYER) and _SHARED_LAYER not in sys.path:
    sys.path.insert(0, _SHARED_LAYER)

# ---------------------------------------------------------------------------
# Now safe to import shared + app
# ---------------------------------------------------------------------------
from app.main import handler as _mangum_handler  # Mangum-wrapped FastAPI app  # noqa: E402
from shared.structured_logger import bind_correlation_id, get_logger  # noqa: E402

logger = get_logger(__name__)


def lambda_handler(event: dict, context: object) -> dict:
    """
    AWS Lambda entry point.

    Parameters
    ----------
    event:   API Gateway Proxy v1/v2 event dict
    context: LambdaContext object (aws_request_id, function_name, …)
    """
    bind_correlation_id(getattr(context, "aws_request_id", "local"))

    logger.info(
        "lambda.invocation_start",
        path=event.get("path") or event.get("rawPath", "unknown"),
        method=event.get("httpMethod")
        or (event.get("requestContext") or {}).get("http", {}).get("method", "unknown"),
        function_name=getattr(context, "function_name", "order_svc"),
        environment=os.environ.get("ENVIRONMENT", "dev"),
    )

    response = _mangum_handler(event, context)

    logger.info("lambda.invocation_end", status_code=response.get("statusCode"))
    return response
