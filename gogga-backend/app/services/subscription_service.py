"""
GOGGA Subscription Verification Service

Verifies user subscription status and credits before processing requests.
Calls the frontend API to get real-time subscription data since the
database is managed by the Next.js frontend (Prisma/SQLite).

This is the backend enforcement layer - frontend-only enforcement can be bypassed!
"""
import logging
from typing import Optional
from dataclasses import dataclass

import httpx

from app.config import settings
from app.core.router import UserTier

logger = logging.getLogger(__name__)


@dataclass
class SubscriptionStatus:
    """Subscription status from frontend API."""
    tier: str
    status: str
    credits_available: int
    images_available: int
    effective_tier: UserTier  # Actual tier to use for this request


class SubscriptionService:
    """
    Verifies subscription status by calling the frontend API.
    
    This ensures backend enforcement of tier limits:
    - Users out of credits get FREE tier models
    - Cancelled/expired users get FREE tier
    - Active paid users get their tier's models
    """
    
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else "http://localhost:3000"
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client
    
    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
    
    async def verify_subscription(self, user_email: str, requested_tier: UserTier) -> SubscriptionStatus:
        """
        Verify a user's subscription status and determine effective tier.
        
        Args:
            user_email: User's email address
            requested_tier: Tier the frontend claims the user has
            
        Returns:
            SubscriptionStatus with effective_tier to use for this request
        """
        # FREE tier always allowed - no verification needed
        if requested_tier == UserTier.FREE:
            return SubscriptionStatus(
                tier="FREE",
                status="active",
                credits_available=0,
                images_available=50,  # FREE tier image limit
                effective_tier=UserTier.FREE,
            )
        
        try:
            client = await self._get_client()
            response = await client.get(
                f"{self._frontend_url}/api/subscription",
                params={"email": user_email},
                headers={"Authorization": f"Bearer {settings.INTERNAL_API_KEY}"},
            )
            
            if response.status_code == 200:
                data = response.json()
                return self._determine_effective_tier(data, requested_tier)
            elif response.status_code == 404:
                # No subscription found - default to FREE
                logger.warning("No subscription found for %s, defaulting to FREE", user_email)
                return SubscriptionStatus(
                    tier="FREE",
                    status="none",
                    credits_available=0,
                    images_available=0,
                    effective_tier=UserTier.FREE,
                )
            else:
                logger.error("Subscription check failed: %d - %s", response.status_code, response.text[:200])
                # On error, trust the frontend tier to avoid blocking users
                return SubscriptionStatus(
                    tier=requested_tier.value.upper(),
                    status="unknown",
                    credits_available=-1,  # Unknown
                    images_available=-1,
                    effective_tier=requested_tier,
                )
                
        except httpx.ConnectError:
            # Frontend not reachable - trust the request tier
            logger.warning("Frontend not reachable for subscription check, trusting request tier")
            return SubscriptionStatus(
                tier=requested_tier.value.upper(),
                status="unverified",
                credits_available=-1,
                images_available=-1,
                effective_tier=requested_tier,
            )
        except Exception as e:
            logger.exception("Subscription verification error: %s", e)
            # On error, trust the frontend tier
            return SubscriptionStatus(
                tier=requested_tier.value.upper(),
                status="error",
                credits_available=-1,
                images_available=-1,
                effective_tier=requested_tier,
            )
    
    def _determine_effective_tier(self, data: dict, requested_tier: UserTier) -> SubscriptionStatus:
        """
        Determine the effective tier based on subscription data.
        
        Key rules:
        1. Cancelled/expired status → FREE tier
        2. Out of credits → FREE tier behavior (but keep tier identity)
        3. Active with credits → use their tier
        """
        tier = data.get("tier", "FREE").upper()
        status = data.get("status", "active")
        credits = data.get("credits", {})
        images = data.get("images", {})
        
        credits_available = credits.get("available", 0)
        images_available = images.get("limit", 0) - images.get("used", 0)
        
        # Determine effective tier
        effective_tier = UserTier.FREE  # Default
        
        if status in ("active", "past_due"):
            if credits_available > 0:
                # Active with credits - use their tier
                if tier == "JIGGA":
                    effective_tier = UserTier.JIGGA
                elif tier == "JIVE":
                    effective_tier = UserTier.JIVE
                else:
                    effective_tier = UserTier.FREE
            else:
                # Out of credits - FREE tier behavior
                logger.info("User %s out of credits, using FREE tier", tier)
                effective_tier = UserTier.FREE
        else:
            # Cancelled, expired, or other status - FREE tier
            logger.info("User subscription status %s, using FREE tier", status)
            effective_tier = UserTier.FREE
        
        # Log tier mismatch if frontend sent wrong tier
        if requested_tier != effective_tier:
            logger.warning(
                "Tier mismatch: frontend sent %s, effective tier is %s (credits: %d, status: %s)",
                requested_tier.value, effective_tier.value, credits_available, status
            )
        
        return SubscriptionStatus(
            tier=tier,
            status=status,
            credits_available=credits_available,
            images_available=max(0, images_available),
            effective_tier=effective_tier,
        )


# Singleton instance
subscription_service = SubscriptionService()
