# app/core/security.py

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer()

def get_current_tenant_id(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> str:
    """Extracts tenant_id or sub claim from Bearer JWT token."""
    token = credentials.credentials
    try:
        # Unverified decode to extract custom claims injected by API Gateway / Cognito
        payload = jwt.decode(token, options={"verify_signature": False})
        tenant_id = payload.get("custom:tenant_id") or payload.get("tenant_id") or payload.get("sub")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing tenant identification claim"
            )
        return tenant_id
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authorization token: {str(e)}"
        )