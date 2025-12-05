"""
GOGGA PostHog Analytics Service.

Tracks user events, LLM usage, and tier activity for analytics.
All tracking is async and non-blocking to avoid impacting response times.

Events tracked:
- chat_message: User messages with tier, model, tokens, latency
- image_generated: Image generation requests
- subscription_change: Tier upgrades/downgrades
- error: API errors and failures
"""
import logging
import asyncio
from typing import Any, Final
from functools import lru_cache

import posthog

from app.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _init_posthog() -> bool:
    """Initialize PostHog client (cached singleton)."""
    api_key = settings.POSTHOG_API_KEY
    
    if not api_key:
        logger.warning("PostHog API key not configured - analytics disabled")
        return False
    
    posthog.project_api_key = api_key
    posthog.host = settings.POSTHOG_HOST
    posthog.debug = getattr(settings, 'DEBUG', False)
    
    # Disable in test environment
    if getattr(settings, 'TESTING', False):
        posthog.disabled = True
        return False
    
    logger.info(f"PostHog analytics initialized ({settings.POSTHOG_HOST})")
    return True


class PostHogService:
    """
    Async PostHog analytics service for GOGGA.
    
    All capture calls are fire-and-forget to avoid blocking.
    """
    
    def __init__(self):
        self._enabled = _init_posthog()
    
    @property
    def enabled(self) -> bool:
        return self._enabled
    
    async def capture(
        self,
        user_id: str,
        event: str,
        properties: dict[str, Any] | None = None
    ) -> None:
        """
        Capture an event asynchronously.
        
        Args:
            user_id: Unique user identifier
            event: Event name (e.g., 'chat_message', 'image_generated')
            properties: Optional event properties
        """
        if not self._enabled:
            return
        
        try:
            # Run in thread pool to avoid blocking
            await asyncio.to_thread(
                posthog.capture,
                distinct_id=user_id,
                event=event,
                properties=properties or {}
            )
        except Exception as e:
            # Never let analytics break the main flow
            logger.debug("PostHog capture failed: %s", e)
    
    async def identify(
        self,
        user_id: str,
        properties: dict[str, Any] | None = None
    ) -> None:
        """
        Identify a user with properties.
        
        Args:
            user_id: Unique user identifier
            properties: User properties (tier, location, etc.)
        """
        if not self._enabled:
            return
        
        try:
            await asyncio.to_thread(
                posthog.identify,
                distinct_id=user_id,
                properties=properties or {}
            )
        except Exception as e:
            logger.debug("PostHog identify failed: %s", e)
    
    # =========================================================================
    # GOGGA-specific event helpers
    # =========================================================================
    
    async def track_chat(
        self,
        user_id: str,
        tier: str,
        layer: str,
        model: str,
        provider: str,
        input_tokens: int,
        output_tokens: int,
        latency_seconds: float,
        cost_zar: float,
        has_thinking: bool = False,
        fallback: bool = False
    ) -> None:
        """Track a chat message completion."""
        await self.capture(user_id, "chat_message", {
            "tier": tier,
            "layer": layer,
            "model": model,
            "provider": provider,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "latency_seconds": latency_seconds,
            "cost_zar": cost_zar,
            "has_thinking": has_thinking,
            "fallback": fallback,
        })
    
    async def track_image(
        self,
        user_id: str,
        tier: str,
        model: str,
        prompt_length: int,
        latency_seconds: float,
        success: bool = True
    ) -> None:
        """Track an image generation request."""
        await self.capture(user_id, "image_generated", {
            "tier": tier,
            "model": model,
            "prompt_length": prompt_length,
            "latency_seconds": latency_seconds,
            "success": success,
        })
    
    async def track_subscription(
        self,
        user_id: str,
        old_tier: str,
        new_tier: str,
        amount_zar: float | None = None
    ) -> None:
        """Track a subscription change."""
        await self.capture(user_id, "subscription_change", {
            "old_tier": old_tier,
            "new_tier": new_tier,
            "amount_zar": amount_zar,
            "is_upgrade": _tier_rank(new_tier) > _tier_rank(old_tier),
        })
        
        # Also update user properties
        await self.identify(user_id, {"tier": new_tier})
    
    async def track_error(
        self,
        user_id: str,
        error_type: str,
        error_message: str,
        context: dict[str, Any] | None = None
    ) -> None:
        """Track an error event."""
        await self.capture(user_id, "error", {
            "error_type": error_type,
            "error_message": error_message,
            **(context or {}),
        })
    
    async def track_rag_query(
        self,
        user_id: str,
        tier: str,
        mode: str,  # 'semantic' or 'keyword'
        doc_count: int,
        chunk_count: int,
        latency_ms: float,
        top_score: float | None = None
    ) -> None:
        """Track a RAG retrieval query."""
        await self.capture(user_id, "rag_query", {
            "tier": tier,
            "mode": mode,
            "doc_count": doc_count,
            "chunk_count": chunk_count,
            "latency_ms": latency_ms,
            "top_score": top_score,
        })
    
    # =========================================================================
    # Fire-and-forget sync wrappers (for use in sync contexts/error handlers)
    # =========================================================================
    
    def track_chat_message(
        self,
        user_id: str,
        tier: str,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0,
        layer: str = "unknown",
        has_thinking: bool = False
    ) -> None:
        """Sync wrapper for tracking chat - fire and forget."""
        if not self._enabled:
            return
        asyncio.create_task(self.track_chat(
            user_id=user_id,
            tier=tier,
            layer=layer,
            model=model,
            provider="cerebras" if tier != "free" else "openrouter",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_seconds=latency_ms / 1000,
            cost_zar=0,  # Cost tracked separately
            has_thinking=has_thinking
        ))
    
    def capture_error(
        self,
        user_id: str,
        error_type: str,
        error_message: str,
        context: dict[str, Any] | None = None
    ) -> None:
        """Sync wrapper for error tracking - fire and forget."""
        if not self._enabled:
            return
        asyncio.create_task(self.track_error(
            user_id=user_id,
            error_type=error_type,
            error_message=error_message,
            context=context
        ))
    
    def flush(self) -> None:
        """Flush pending events (call on shutdown)."""
        if self._enabled:
            try:
                posthog.flush()
            except Exception as e:
                logger.debug("PostHog flush failed: %s", e)


def _tier_rank(tier: str) -> int:
    """Get numeric rank for tier comparison."""
    ranks = {"free": 0, "jive": 1, "jigga": 2}
    return ranks.get(tier.lower(), 0)


# Singleton instance
posthog_service = PostHogService()
