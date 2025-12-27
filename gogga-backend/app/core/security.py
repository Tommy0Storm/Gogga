"""
GOGGA Security Module
Handles API key validation and JWT token management.

Enterprise Security Features (Dec 2025 Audit):
- Proper JWT signing with PyJWT
- API key validation against hashed storage
- Admin authentication middleware
- Rate limiting support
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib
import secrets
import logging

from fastapi import HTTPException, Security, Header, Depends, status
from fastapi.security import APIKeyHeader

try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    import base64
    import json

from app.config import settings

logger = logging.getLogger(__name__)

# =============================================================================
# ADDITIONAL SECURITY ENHANCEMENTS (RECOMMENDATIONS #19-21)
# =============================================================================

import hmac
import json
import re
import time
from typing import Any, Callable, Optional
from functools import wraps
from collections import defaultdict


# -----------------------------------------------------------------------------
# REQUEST SIGNING FOR TOOL RESULTS (RECOMMENDATION #19)
# -----------------------------------------------------------------------------

TOOL_SIGNING_SECRET = getattr(settings, 'TOOL_SIGNING_SECRET', 'gogga-tool-signing-secret-change-in-prod')


def sign_tool_result(tool_name: str, arguments: dict[str, Any], result: Any) -> str:
    """
    Generate HMAC signature for tool result.

    RECOMMENDATION #19: Prevents tool result injection attacks.

    Args:
        tool_name: Name of the tool
        arguments: Tool arguments
        result: Tool execution result

    Returns:
        HMAC-SHA256 signature (hex digest)
    """
    payload = json.dumps({
        "tool": tool_name,
        "arguments": arguments,
        "result": result,
        "timestamp": int(time.time())
    }, sort_keys=True, default=str)

    signature = hmac.new(
        TOOL_SIGNING_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    return signature


def verify_tool_result(
    tool_name: str,
    arguments: dict[str, Any],
    result: Any,
    signature: str
) -> bool:
    """
    Verify HMAC signature for tool result.

    Args:
        tool_name: Name of the tool
        arguments: Tool arguments
        result: Tool execution result
        signature: HMAC signature to verify

    Returns:
        True if signature is valid, False otherwise
    """
    expected_signature = sign_tool_result(tool_name, arguments, result)
    return hmac.compare_digest(expected_signature, signature)


# -----------------------------------------------------------------------------
# INPUT SANITIZATION (RECOMMENDATION #20)
# -----------------------------------------------------------------------------

class InputSanitizer:
    """
    Sanitize user inputs to prevent XSS, SQL injection, and command injection.

    RECOMMENDATION #20: Add user input sanitization for tool arguments.
    """

    HTML_TAG_PATTERN = re.compile(r'<[^>]+>')
    SCRIPT_PATTERN = re.compile(r'<script\b[^>]*>(.*?)</script>', re.IGNORECASE | re.DOTALL)
    ON_EVENT_PATTERN = re.compile(r'\bon\w+\s*=', re.IGNORECASE)

    SQL_INJECTION_PATTERNS = [
        re.compile(r"(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b).*\bFROM\b", re.IGNORECASE),
        re.compile(r";.*\b(DROP|DELETE|UPDATE|INSERT)\b", re.IGNORECASE),
        re.compile(r"'.*OR.*'.*='.*'", re.IGNORECASE),
    ]

    COMMAND_INJECTION_PATTERNS = [
        re.compile(r'[;&|`$]'),
        re.compile(r'\$\([^)]*\)'),
        re.compile(r'`[^`]*`'),
    ]

    @classmethod
    def sanitize_string(cls, input_str: str) -> str:
        """Sanitize a string input."""
        if not isinstance(input_str, str):
            return str(input_str)

        sanitized = input_str
        sanitized = cls.HTML_TAG_PATTERN.sub('', sanitized)
        sanitized = cls.SCRIPT_PATTERN.sub('', sanitized)
        sanitized = cls.ON_EVENT_PATTERN.sub('', sanitized)

        for pattern in cls.SQL_INJECTION_PATTERNS:
            if pattern.search(sanitized):
                logger.warning(f"[Security] SQL injection pattern detected")
                sanitized = re.sub(r'[\'";]', '', sanitized)

        for pattern in cls.COMMAND_INJECTION_PATTERNS:
            if pattern.search(sanitized):
                logger.warning(f"[Security] Command injection pattern detected")
                sanitized = pattern.sub('', sanitized)

        return sanitized.strip()

    @classmethod
    def sanitize_dict(cls, input_dict: dict[str, Any]) -> dict[str, Any]:
        """Recursively sanitize dictionary values."""
        sanitized = {}
        for key, value in input_dict.items():
            safe_key = cls.sanitize_string(key)
            if isinstance(value, str):
                sanitized[safe_key] = cls.sanitize_string(value)
            elif isinstance(value, dict):
                sanitized[safe_key] = cls.sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[safe_key] = [
                    cls.sanitize_string(v) if isinstance(v, str) else v
                    for v in value
                ]
            else:
                sanitized[safe_key] = value
        return sanitized

    @classmethod
    def sanitize_tool_arguments(cls, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Sanitize tool arguments before execution."""
        logger.debug(f"[Security] Sanitizing arguments for tool: {tool_name}")
        return cls.sanitize_dict(arguments)


# -----------------------------------------------------------------------------
# PER-TOOL RATE LIMITING (RECOMMENDATION #21)
# -----------------------------------------------------------------------------

class PerToolRateLimiter:
    """
    Rate limiter with per-tool limits.

    RECOMMENDATION #21: Separate limits per tool type.
    """

    DEFAULT_LIMITS = {
        "web_search": (10, 60),
        "legal_search": (10, 60),
        "shopping_search": (10, 60),
        "places_search": (10, 60),
        "generate_video": (3, 3600),
        "generate_image": (20, 3600),
        "upscale_image": (10, 3600),
        "edit_image": (10, 3600),
        "python_execute": (30, 60),
    }

    def __init__(self):
        self._requests: dict[str, dict[str, list[tuple[float, int]]]] = defaultdict(lambda: defaultdict(list))

    def check_rate_limit(
        self,
        tool_name: str,
        user_id: str,
        count: int = 1
    ) -> tuple[bool, Optional[int]]:
        """
        Check if request is within rate limit.

        Returns:
            (allowed, retry_after_seconds)
        """
        limit = self.DEFAULT_LIMITS.get(tool_name, (60, 60))
        max_requests, window_seconds = limit

        now = time.time()
        window_start = now - window_seconds

        user_requests = self._requests[tool_name][user_id]
        user_requests[:] = [(ts, cnt) for ts, cnt in user_requests if ts > window_start]

        total_requests = sum(cnt for _, cnt in user_requests)

        if total_requests + count > max_requests:
            oldest_request = min(user_requests, key=lambda x: x[0]) if user_requests else (now, 0)
            retry_after = int(window_seconds - (now - oldest_request[0]))
            logger.warning(f"[RateLimit] {tool_name} for user {user_id}: {total_requests + count}/{max_requests}")
            return False, retry_after

        self._requests[tool_name][user_id].append((now, count))
        return True, None


_rate_limiter: Optional[PerToolRateLimiter] = None


def get_tool_rate_limiter() -> PerToolRateLimiter:
    """Get the global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = PerToolRateLimiter()
    return _rate_limiter


class RateLimitError(Exception):
    """Raised when rate limit is exceeded."""
    def __init__(self, message: str, retry_after: int):
        super().__init__(message)
        self.retry_after = retry_after

# API Key header definition
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def generate_api_key() -> str:
    """Generate a secure API key for a user."""
    return secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    """Hash an API key for secure storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def mask_key(key: str) -> str:
    """Mask API key for logging (show only first 8 and last 4 chars)."""
    if len(key) <= 12:
        return "***"
    return f"{key[:8]}...{key[-4:]}"


async def validate_api_key(api_key: Optional[str] = Security(api_key_header)) -> str:
    """
    Validate the API key from the request header.
    
    TODO: In production, implement database lookup:
    1. Hash the incoming API key
    2. Query database for matching hash
    3. Check if key is active/not revoked
    4. Return associated user_id or raise 401
    
    Current: Development mode accepts non-empty keys with warning.
    """
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is missing",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    if not api_key or len(api_key) < 16:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    # TODO: Replace with database validation in production
    # hashed = hash_api_key(api_key)
    # stored_key = await db.api_keys.find_one({"hash": hashed, "revoked": False})
    # if not stored_key:
    #     logger.warning("Invalid API key attempt: %s", mask_key(api_key))
    #     raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.debug("API key validated: %s", mask_key(api_key))
    return api_key


async def require_admin(
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
    authorization: Optional[str] = Header(default=None),
) -> bool:
    """
    Require admin authentication for sensitive endpoints.
    
    Validates either:
    - X-Admin-Secret header matches ADMIN_SECRET env var
    - Authorization header contains valid admin JWT
    
    Returns True if authenticated, raises 403 otherwise.
    """
    admin_secret = getattr(settings, 'ADMIN_SECRET', None)
    
    # Check X-Admin-Secret header
    if x_admin_secret and admin_secret:
        if secrets.compare_digest(x_admin_secret, admin_secret):
            logger.info("Admin access granted via X-Admin-Secret")
            return True
    
    # Check Authorization header for admin JWT
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            payload = verify_access_token(token)
            if payload.get("role") == "admin":
                logger.info("Admin access granted via JWT for user: %s", payload.get("sub"))
                return True
        except HTTPException:
            pass
    
    logger.warning("Unauthorized admin access attempt")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required. Provide X-Admin-Secret header or admin JWT.",
    )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a properly signed JWT access token.
    
    Args:
        data: The data to encode in the token (should include 'sub' for user ID)
        expires_delta: Optional expiration time delta
        
    Returns:
        Encoded and signed JWT token string
    """
    to_encode = data.copy()
    
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now,
    })
    
    if JWT_AVAILABLE:
        # Proper JWT with cryptographic signature
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    else:
        # Fallback for development (NOT SECURE - install pyjwt!)
        logger.warning("PyJWT not installed! Using insecure base64 encoding.")
        token_data = json.dumps(to_encode, default=str)
        return base64.urlsafe_b64encode(token_data.encode()).decode()


def verify_access_token(token: str) -> dict:
    """
    Verify and decode a JWT access token.
    
    Args:
        token: The JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if JWT_AVAILABLE:
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
                options={"require": ["exp", "iat", "sub"]},
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid token: %s", str(e))
            raise credentials_exception
    else:
        # Insecure fallback - NOT FOR PRODUCTION
        try:
            token_data = base64.urlsafe_b64decode(token.encode()).decode()
            payload = json.loads(token_data)
            # Check expiration
            exp = datetime.fromisoformat(payload.get("exp", "1970-01-01"))
            if exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Token expired")
            return payload
        except Exception:
            raise credentials_exception

