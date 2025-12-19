"""
GOGGA Credit Service

Manages subscription limits, credit deductions, and free tier fallback.
Token counting uses actual API response values, not estimates.

Credit Flow:
1. Check subscription limit first
2. If exceeded, check credit balance (with tier restrictions)
3. If no credits, fall back to free tier for chat only
4. Deny non-chat actions if no sub/credits

See: .serena/memories/credit_token_system.md
"""
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Literal
import httpx

from app.config import settings


class ActionType(str, Enum):
    """Billable action types."""
    CHAT_10K_TOKENS = "chat_10k_tokens"
    IMAGE_CREATE = "image_create"
    IMAGE_EDIT = "image_edit"
    UPSCALE = "upscale"
    VIDEO_SECOND = "video_second"
    GOGGA_TALK_MIN = "gogga_talk_min"


class DeductionSource(str, Enum):
    """Where the usage was deducted from."""
    SUBSCRIPTION = "subscription"  # Monthly limit
    CREDITS = "credits"            # Credit pack balance
    FREE = "free"                  # Free tier fallback


@dataclass
class UsageState:
    """User's current usage state."""
    tier: Literal["FREE", "JIVE", "JIGGA"]
    credit_balance: int
    chat_tokens_used: int
    images_used: int
    image_edits_used: int
    upscales_used: int
    video_seconds_used: int
    gogga_talk_mins_used: float


@dataclass
class ActionResult:
    """Result of action check or deduction."""
    allowed: bool
    source: Optional[DeductionSource]
    credits_deducted: int = 0
    reason: Optional[str] = None
    
    # For chat fallback
    fallback_model: Optional[str] = None


# Tier limits from config
TIER_LIMITS = {
    "FREE": {
        "chat_tokens": float("inf"),  # Unlimited but slow
        "images": 50,  # Pollinations free tier
        "image_edits": 0,
        "upscales": 0,
        "video_seconds": 0,
        "gogga_talk_mins": 0,
    },
    "JIVE": {
        "chat_tokens": settings.TIER_JIVE_CHAT_TOKENS,
        "images": settings.TIER_JIVE_IMAGES,
        "image_edits": settings.TIER_JIVE_IMAGE_EDITS,
        "upscales": settings.TIER_JIVE_UPSCALES,
        "video_seconds": settings.TIER_JIVE_VIDEO_SECONDS,
        "gogga_talk_mins": settings.TIER_JIVE_GOGGA_TALK_MINS,
    },
    "JIGGA": {
        "chat_tokens": settings.TIER_JIGGA_CHAT_TOKENS,
        "images": settings.TIER_JIGGA_IMAGES,
        "image_edits": settings.TIER_JIGGA_IMAGE_EDITS,
        "upscales": settings.TIER_JIGGA_UPSCALES,
        "video_seconds": settings.TIER_JIGGA_VIDEO_SECONDS,
        "gogga_talk_mins": settings.TIER_JIGGA_GOGGA_TALK_MINS,
    },
}

# Credit costs per action
CREDIT_COSTS = {
    ActionType.CHAT_10K_TOKENS: settings.CREDIT_COST_10K_TOKENS,
    ActionType.IMAGE_CREATE: settings.CREDIT_COST_IMAGE_CREATE,
    ActionType.IMAGE_EDIT: settings.CREDIT_COST_IMAGE_EDIT,
    ActionType.UPSCALE: settings.CREDIT_COST_UPSCALE,
    ActionType.VIDEO_SECOND: settings.CREDIT_COST_VIDEO_SECOND,
    ActionType.GOGGA_TALK_MIN: settings.CREDIT_COST_GOGGA_TALK_MIN,
}

# JIVE credit restrictions (can only use credits for these)
JIVE_CREDIT_ALLOWED = {
    ActionType.CHAT_10K_TOKENS,
    ActionType.IMAGE_CREATE,
    ActionType.GOGGA_TALK_MIN,
}


class CreditService:
    """Manages credit checks and deductions."""
    
    _client: Optional[httpx.AsyncClient] = None
    
    @classmethod
    async def _get_client(cls) -> httpx.AsyncClient:
        """Get or create HTTP client (lazy singleton)."""
        if cls._client is None or cls._client.is_closed:
            cls._client = httpx.AsyncClient(timeout=30.0)
        return cls._client
    
    @classmethod
    async def get_user_state(cls, user_id: str) -> UsageState:
        """
        Fetch user's current usage state from frontend API.
        
        The frontend (Next.js) owns the Prisma database, so we call
        its internal API to get current usage values.
        """
        client = await cls._get_client()
        try:
            response = await client.get(
                f"{settings.FRONTEND_URL}/api/internal/user-usage/{user_id}",
                headers={"X-Internal-Key": settings.INTERNAL_API_KEY},
            )
            response.raise_for_status()
            data = response.json()
            
            return UsageState(
                tier=data.get("tier", "FREE"),
                credit_balance=data.get("creditBalance", 0),
                chat_tokens_used=data.get("usageChatTokens", 0),
                images_used=data.get("usageImages", 0),
                image_edits_used=data.get("usageImageEdits", 0),
                upscales_used=data.get("usageUpscales", 0),
                video_seconds_used=data.get("usageVideoSeconds", 0),
                gogga_talk_mins_used=data.get("usageGoggaTalkMins", 0.0),
            )
        except Exception as e:
            # Default to FREE tier with no usage on error
            print(f"[CreditService] Error fetching user state: {e}")
            return UsageState(
                tier="FREE",
                credit_balance=0,
                chat_tokens_used=0,
                images_used=0,
                image_edits_used=0,
                upscales_used=0,
                video_seconds_used=0,
                gogga_talk_mins_used=0.0,
            )
    
    @classmethod
    def check_action(
        cls,
        state: UsageState,
        action: ActionType,
        quantity: int = 1,
    ) -> ActionResult:
        """
        Check if action is allowed and determine source.
        
        Flow:
        1. Check subscription limit
        2. Check credit balance (with tier restrictions)
        3. Fall back to free tier for chat only
        4. Deny if not chat and no credits
        """
        tier = state.tier
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["FREE"])
        credits_needed = CREDIT_COSTS[action] * quantity
        
        # Map action to usage field
        usage_map = {
            ActionType.CHAT_10K_TOKENS: ("chat_tokens", state.chat_tokens_used, quantity * 10_000),
            ActionType.IMAGE_CREATE: ("images", state.images_used, quantity),
            ActionType.IMAGE_EDIT: ("image_edits", state.image_edits_used, quantity),
            ActionType.UPSCALE: ("upscales", state.upscales_used, quantity),
            ActionType.VIDEO_SECOND: ("video_seconds", state.video_seconds_used, quantity),
            ActionType.GOGGA_TALK_MIN: ("gogga_talk_mins", state.gogga_talk_mins_used, quantity),
        }
        
        limit_key, current_usage, usage_increment = usage_map[action]
        limit_value = limits.get(limit_key, 0)
        
        # Step 1: Check subscription limit
        if current_usage + usage_increment <= limit_value:
            return ActionResult(
                allowed=True,
                source=DeductionSource.SUBSCRIPTION,
            )
        
        # Step 2: Check credit balance (with tier restrictions)
        if tier == "JIVE" and action not in JIVE_CREDIT_ALLOWED:
            # JIVE can only use credits for chat, images, and voice
            if action == ActionType.CHAT_10K_TOKENS:
                # Fall back to free tier
                return ActionResult(
                    allowed=True,
                    source=DeductionSource.FREE,
                    fallback_model=settings.MODEL_FREE,
                )
            return ActionResult(
                allowed=False,
                source=None,
                reason=f"JIVE tier credits cannot be used for {action.value}. Upgrade to JIGGA for this feature.",
            )
        
        if state.credit_balance >= credits_needed:
            return ActionResult(
                allowed=True,
                source=DeductionSource.CREDITS,
                credits_deducted=credits_needed,
            )
        
        # Step 3: Fall back to free tier for chat only
        if action == ActionType.CHAT_10K_TOKENS:
            return ActionResult(
                allowed=True,
                source=DeductionSource.FREE,
                fallback_model=settings.MODEL_FREE,
            )
        
        # Step 4: Deny non-chat actions
        return ActionResult(
            allowed=False,
            source=None,
            reason=f"Insufficient credits for {action.value}. Need {credits_needed} credits, have {state.credit_balance}.",
        )
    
    @classmethod
    async def deduct_usage(
        cls,
        user_id: str,
        action: ActionType,
        quantity: int,
        source: DeductionSource,
        *,
        idempotency_key: Optional[str] = None,
        request_id: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        tier: Optional[str] = None,
        duration_ms: Optional[int] = None,
    ) -> dict:
        """
        Record usage deduction via frontend API.
        
        Called AFTER the action completes with actual usage values
        (not estimates).
        
        Enterprise Features:
        - Idempotency key prevents double-billing on retries
        - Full audit trail with request metadata
        - Returns detailed response for verification
        
        Args:
            user_id: User ID
            action: Action type being billed
            quantity: Number of units (tokens/10K, images, etc.)
            source: Where to deduct from (subscription, credits, free)
            idempotency_key: Unique key to prevent duplicate charges
            request_id: Original request ID for tracing
            model: AI model used
            provider: Provider name
            tier: User's tier
            duration_ms: Request duration in milliseconds
            
        Returns:
            Dict with success status, eventId, and duplicate flag
        """
        client = await cls._get_client()
        
        # Generate idempotency key if not provided
        if idempotency_key is None:
            import uuid
            idempotency_key = f"{action.value}:{user_id}:{uuid.uuid4()}"
        
        try:
            response = await client.post(
                f"{settings.FRONTEND_URL}/api/internal/deduct-usage",
                headers={"X-Internal-Key": settings.INTERNAL_API_KEY},
                json={
                    "userId": user_id,
                    "action": action.value,
                    "quantity": quantity,
                    "source": source.value,
                    "idempotencyKey": idempotency_key,
                    "requestId": request_id,
                    "model": model,
                    "provider": provider,
                    "tier": tier,
                    "durationMs": duration_ms,
                },
            )
            response.raise_for_status()
            data = response.json()
            return {
                "success": True,
                "eventId": data.get("eventId"),
                "duplicate": data.get("duplicate", False),
                "creditsDeducted": data.get("creditsDeducted", 0),
            }
        except Exception as e:
            print(f"[CreditService] Error deducting usage: {e}")
            return {
                "success": False,
                "error": str(e),
                "duplicate": False,
            }
    
    @classmethod
    def calculate_token_credits(cls, total_tokens: int) -> int:
        """
        Calculate credits needed for token usage.
        
        1 credit per 10K tokens, rounded up.
        Uses integer arithmetic for precision.
        """
        if total_tokens <= 0:
            return 0
        return (total_tokens + 9_999) // 10_000  # Round up
    
    @classmethod
    def validate_token_count(cls, claimed_tokens: int, actual_tokens: int, tolerance: float = 0.1) -> bool:
        """
        Validate that claimed token count is within tolerance of actual.
        
        For enterprise billing accuracy - catches token count manipulation attempts.
        
        Args:
            claimed_tokens: Tokens reported by client
            actual_tokens: Tokens from API response
            tolerance: Allowed variance (0.1 = 10%)
            
        Returns:
            True if within tolerance, False if suspicious
        """
        if actual_tokens == 0:
            return claimed_tokens == 0
        
        variance = abs(claimed_tokens - actual_tokens) / actual_tokens
        return variance <= tolerance


# Export singleton-style functions
async def check_action_allowed(
    user_id: str,
    action: ActionType,
    quantity: int = 1,
) -> ActionResult:
    """Check if action is allowed for user."""
    state = await CreditService.get_user_state(user_id)
    return CreditService.check_action(state, action, quantity)


async def deduct_usage(
    user_id: str,
    action: ActionType,
    quantity: int,
    source: DeductionSource,
    *,
    idempotency_key: Optional[str] = None,
    request_id: Optional[str] = None,
    model: Optional[str] = None,
    provider: Optional[str] = None,
    tier: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> dict:
    """Deduct usage after action completes."""
    return await CreditService.deduct_usage(
        user_id, 
        action, 
        quantity, 
        source,
        idempotency_key=idempotency_key,
        request_id=request_id,
        model=model,
        provider=provider,
        tier=tier,
        duration_ms=duration_ms,
    )


def calculate_token_credits(total_tokens: int) -> int:
    """Calculate credits needed for token count."""
    return CreditService.calculate_token_credits(total_tokens)


def validate_token_count(claimed_tokens: int, actual_tokens: int, tolerance: float = 0.1) -> bool:
    """Validate token count accuracy."""
    return CreditService.validate_token_count(claimed_tokens, actual_tokens, tolerance)
