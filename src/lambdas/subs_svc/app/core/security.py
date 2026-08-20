"""
app.core.security
==================
Cognito authentication and authorization utilities.

Purpose
-------
• Validate JWT tokens from Cognito
• Extract tenant_id and role from token claims
• Provide decorators for role-based access control

Claims Used
-----------
• sub: User ID (used as tenant_id fallback)
• custom:tenant_id: Tenant ID (primary)
• cognito:groups: ['menulay_admin', 'admin', 'tenant', 'kitchen']
• email: User email

Functions
---------
• CognitoAuth.decode_token() - Verify JWT and return decoded payload
• get_current_tenant() - FastAPI dependency for authenticated user
• admin_required() - Decorator to restrict endpoints to platform admins

Notes
-----
• Public keys are fetched from Cognito JWKS endpoint
• Each request validates token against Cognito's RSA keys
• Tenant ID is extracted from custom:tenant_id claim (or sub as fallback)
"""

import jwt
import json
import logging
import requests
from typing import Dict, Optional, List
from functools import wraps
from fastapi import HTTPException, Request
from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed admin group names in Cognito
ALLOWED_ADMIN_GROUPS = {"admin", "platform_admin", "menulay_admin"}


class CognitoAuth:
    """Cognito authentication handler"""
    
    @staticmethod
    def get_public_keys():
        """Get Cognito public keys for JWT verification"""
        try:
            url = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
            response = requests.get(url)
            response.raise_for_status()
            return response.json()["keys"]
        except Exception as e:
            logger.error(f"Failed to fetch Cognito public keys: {str(e)}")
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    @staticmethod
    def decode_token(token: str) -> Dict:
        """Decode and verify Cognito JWT token (handles both ID and Access tokens)."""
        try:
            if token.startswith("Bearer "):
                token = token[7:]
            
            keys = CognitoAuth.get_public_keys()
            
            for key in keys:
                try:
                    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
                    
                    # Disable PyJWT's strict aud check so Access Tokens don't fail validation
                    decoded = jwt.decode(
                        token,
                        public_key,
                        algorithms=["RS256"],
                        options={"verify_aud": False},
                        issuer=f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"
                    )
                    
                    # Verify Client ID manually across both ID (aud) and Access (client_id) tokens
                    token_client_id = decoded.get("client_id") or decoded.get("aud")
                    if token_client_id != settings.COGNITO_CLIENT_ID:
                        logger.warning(f"Token client_id mismatch: {token_client_id}")
                        raise jwt.InvalidTokenError("Token was not issued for this client ID")

                    return decoded
                except jwt.InvalidTokenError:
                    continue
            
            raise jwt.InvalidTokenError("No valid key found for signature verification")
            
        except jwt.InvalidTokenError as e:
            logger.error(f"Token validation failed: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error decoding token: {str(e)}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    @staticmethod
    def get_tenant_id_from_token(token: str) -> str:
        """Extract tenant ID from JWT token"""
        decoded = CognitoAuth.decode_token(token)
        tenant_id = decoded.get("custom:tenant_id") or decoded.get("sub")
        if not tenant_id:
            raise HTTPException(status_code=401, detail="Tenant ID not found in token")
        return tenant_id
    
    @staticmethod
    def get_user_roles_from_token(token: str) -> List[str]:
        """Extract user roles/groups list from JWT token"""
        decoded = CognitoAuth.decode_token(token)
        groups = decoded.get("cognito:groups", [])
        return [g.lower() for g in groups]


# FastAPI Dependency for authentication
async def get_current_tenant(request: Request) -> Dict:
    """Dependency to get current authenticated tenant"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = auth_header.replace("Bearer ", "")
    decoded = CognitoAuth.decode_token(token)
    groups = [g.lower() for g in decoded.get("cognito:groups", ["tenant"])]
    
    return {
        "tenant_id": decoded.get("custom:tenant_id") or decoded.get("sub"),
        "email": decoded.get("email"),
        "role": groups[0] if groups else "tenant",
        "roles": groups
    }


def admin_required(func):
    """Decorator to ensure user has admin permissions"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request')
        if not request:
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
        
        if not request:
            raise HTTPException(status_code=400, detail="Request object required")
        
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header required")
        
        token = auth_header.replace("Bearer ", "")
        user_roles = CognitoAuth.get_user_roles_from_token(token)
        
        # Check if any user group overlaps with allowed admin groups
        if not any(role in ALLOWED_ADMIN_GROUPS for role in user_roles):
            raise HTTPException(status_code=403, detail="Admin privileges required")
        
        return await func(*args, **kwargs)
    return wrapper