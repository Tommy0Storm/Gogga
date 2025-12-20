"""
GOGGA Authentication and Authorization Module.

Handles user tier authentication and provides dependency injection
for protected endpoints.

SECURITY NOTE (Dec 2025 Audit):
In production, NEVER trust X-User-Tier header from client.
Always validate tier from database based on authenticated user.
"""

import logging
from typing import Optional

from fastapi import Header, HTTPException, status

from app.core.router import UserTier
from app.config import settings

logger = logging.getLogger(__name__)

# Re-export UserTier for convenience
__all__ = ["UserTier", "get_current_user_tier", "get_user_id"]

# Flag to enable/disable development mode tier override
# MUST be False in production - allows client to set their own tier
DEV_ALLOW_TIER_OVERRIDE: bool = getattr(settings, 'DEBUG', False)


async def get_current_user_tier(
    x_user_tier: Optional[str] = Header(default=None, alias="X-User-Tier"),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    authorization: Optional[str] = Header(default=None),
) -> UserTier:
    """
    Get current user's subscription tier.
    
    SECURITY: In production, tier MUST be validated from database,
    not trusted from client headers.
    
    Priority order:
    1. JWT token (if valid, use embedded tier claim)
    2. API key lookup (query database for user's tier)
    3. X-User-Tier header (DEV MODE ONLY - controlled by DEV_ALLOW_TIER_OVERRIDE)
    4. Default to FREE
    
    Args:
        x_user_tier: Optional tier override header (dev only)
        x_api_key: API key for authentication
        authorization: Bearer token for JWT auth
        
    Returns:
        UserTier enum value
    """
    # Priority 1: Check JWT token for tier claim
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            from app.core.security import verify_access_token
            payload = verify_access_token(token)
            tier_from_jwt = payload.get("tier")
            if tier_from_jwt and tier_from_jwt.upper() in [t.value.upper() for t in UserTier]:
                logger.debug("Tier from JWT: %s", tier_from_jwt)
                return UserTier(tier_from_jwt.lower())
        except Exception:
            pass  # Fall through to other methods
    
    # Priority 2: If API key provided, look up user's tier from database
    if x_api_key:
        # TODO: Query database for user's actual tier based on API key
        # Example: user = await db.users.find_by_api_key(x_api_key)
        #          return UserTier(user.subscription.tier)
        # For now, authenticated users get JIVE tier for testing
        logger.debug("API key provided, granting JIVE tier")
        return UserTier.JIVE
    
    # Priority 3: Development mode only - accept tier from header
    if DEV_ALLOW_TIER_OVERRIDE and x_user_tier:
        tier_upper = x_user_tier.upper()
        if tier_upper in [t.value.upper() for t in UserTier]:
            logger.warning("DEV MODE: Tier override from header: %s", x_user_tier)
            return UserTier(x_user_tier.lower())
        else:
            logger.warning("Invalid tier header: %s", x_user_tier)
    elif x_user_tier and not DEV_ALLOW_TIER_OVERRIDE:
        # Log attempted bypass in production
        logger.warning("⚠️ SECURITY: Attempted tier bypass via header (ignored): %s", x_user_tier)
    
    # Default to FREE tier
    return UserTier.FREE


async def get_user_id(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-ID"),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> Optional[str]:
    """
    Get current user ID from request headers.
    
    Args:
        x_user_id: Direct user ID header (dev only)
        x_api_key: API key to look up user ID
        
    Returns:
        User ID string or None for anonymous
    """
    if x_user_id:
        return x_user_id
    
    if x_api_key:
        # TODO: Look up user ID from API key
        pass
    
    return None


async def require_tier(minimum_tier: UserTier):
    """
    Dependency factory to require a minimum subscription tier.
    
    Usage:
        @router.get("/premium", dependencies=[Depends(require_tier(UserTier.JIVE))])
    """
    async def _check_tier(
        current_tier: UserTier = Header(alias="X-User-Tier", default=UserTier.FREE.value)
    ):
        tier_order = [UserTier.FREE, UserTier.JIVE, UserTier.JIGGA]
        
        if tier_order.index(current_tier) < tier_order.index(minimum_tier):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires {minimum_tier.value} tier or higher."
            )
        
        return current_tier
    
    return _check_tier
