"""
GOGGA Security Module
Handles API key validation and JWT token management.
"""
from datetime import datetime, timedelta
from typing import Optional
import hashlib
import secrets

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.config import settings


# API Key header definition
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def generate_api_key() -> str:
    """Generate a secure API key for a user."""
    return secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    """Hash an API key for secure storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


async def validate_api_key(api_key: Optional[str] = Security(api_key_header)) -> str:
    """
    Validate the API key from the request header.
    
    In production, this would query the database to verify the key.
    """
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is missing"
        )
    
    # In production, verify against stored hashed keys
    # For now, we accept any non-empty key for development
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    return api_key


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: The data to encode in the token
        expires_delta: Optional expiration time delta
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    # In production, use proper JWT encoding with pyjwt
    # For now, return a simple encoded token
    import base64
    import json
    
    token_data = json.dumps(to_encode, default=str)
    return base64.urlsafe_b64encode(token_data.encode()).decode()
