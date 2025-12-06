"""
GOGGA Chat Endpoints - Tier-Based Routing.

FREE Tier: OpenRouter Llama 3.3 70B FREE
JIVE Tier: Cerebras Llama 3.1 8B (direct or + CePO)
JIGGA Tier: Cerebras Qwen 3 235B (thinking or /no_think)

Universal: Prompt enhancement via Llama 3.3 70B FREE (all tiers)
"""
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.domain import ChatRequest, ChatResponse
from app.services.ai_service import ai_service
from app.services.openrouter_service import openrouter_service
from app.services.posthog_service import posthog_service
from app.services.subscription_service import subscription_service
from app.core.router import CognitiveLayer, UserTier, tier_router, is_image_prompt
from app.core.exceptions import InferenceError


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


class TieredChatRequest(BaseModel):
    """Extended chat request with tier support."""
    message: str = Field(..., min_length=1, max_length=32000)
    user_id: str = Field(default="anonymous")
    user_email: str | None = Field(default=None, description="User email for subscription verification")
    user_tier: UserTier = Field(default=UserTier.FREE)
    history: list[dict[str, str]] | None = None
    context_tokens: int = Field(default=0, description="Token count for JIGGA thinking mode")
    force_layer: str | None = None


@router.post("", response_model=ChatResponse)
async def chat(request: TieredChatRequest) -> ChatResponse:
    """
    Send a message to Gogga with tier-based routing.
    
    FREE Tier:
        → OpenRouter Llama 3.3 70B FREE
        
    JIVE Tier:
        Simple → Cerebras Llama 3.1 8B direct
        Complex → Cerebras Llama 3.1 8B + CePO
        
    JIGGA Tier:
        Thinking → Cerebras Qwen 3 235B (temp=0.6, top_p=0.95)
        Fast → Cerebras Qwen 3 235B + /no_think
    
    Backend enforces tier limits by verifying subscription status.
    Users out of credits are downgraded to FREE tier models.
    """
    try:
        # Check if this is an image request
        if is_image_prompt(request.message):
            raise HTTPException(
                status_code=400,
                detail="This looks like an image request. Use /api/v1/images/generate instead."
            )
        
        # BACKEND ENFORCEMENT: Verify subscription and determine effective tier
        effective_tier = request.user_tier
        if request.user_email and request.user_tier != UserTier.FREE:
            sub_status = await subscription_service.verify_subscription(
                user_email=request.user_email,
                requested_tier=request.user_tier,
            )
            effective_tier = sub_status.effective_tier
            
            # Log if tier was downgraded due to credits
            if effective_tier != request.user_tier:
                logger.info(
                    "Tier enforcement: %s → %s (credits: %d, status: %s)",
                    request.user_tier.value, effective_tier.value,
                    sub_status.credits_available, sub_status.status
                )
        
        # Resolve force_layer if provided
        force_layer = _resolve_force_layer(request.force_layer, effective_tier)
        
        result = await ai_service.generate_response(
            user_id=request.user_id,
            message=request.message,
            history=request.history,
            user_tier=effective_tier,  # Use verified effective tier
            force_layer=force_layer,
            context_tokens=request.context_tokens
        )
        
        # Track chat event in PostHog (non-blocking)
        meta = result.get("meta", {})
        posthog_service.track_chat_message(
            user_id=request.user_id,
            tier=effective_tier.value,  # Track effective tier, not requested
            model=meta.get("model", "unknown"),
            input_tokens=meta.get("input_tokens", 0),
            output_tokens=meta.get("output_tokens", 0),
            latency_ms=meta.get("latency_ms", 0),
            layer=meta.get("layer", "unknown"),
            has_thinking=result.get("thinking") is not None
        )
        
        # Add tier enforcement info to meta
        meta["requested_tier"] = request.user_tier.value
        meta["effective_tier"] = effective_tier.value
        meta["tier_enforced"] = effective_tier != request.user_tier
        
        return ChatResponse(
            response=result["response"],
            thinking=result.get("thinking"),  # JIGGA thinking block for UI
            meta=meta
        )
        
    except InferenceError as e:
        logger.error("Inference error for user %s: %s", request.user_id, e)
        posthog_service.capture_error(
            user_id=request.user_id,
            error_type="inference_error",
            error_message=str(e),
            context={"tier": request.user_tier.value, "endpoint": "chat"}
        )
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error for user %s", request.user_id)
        posthog_service.capture_error(
            user_id=request.user_id,
            error_type="unexpected_error",
            error_message=str(e),
            context={"tier": request.user_tier.value, "endpoint": "chat"}
        )
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


def _resolve_force_layer(
    force_layer: str | None, 
    user_tier: UserTier
) -> CognitiveLayer | None:
    """Resolve force_layer string to CognitiveLayer enum."""
    if not force_layer:
        return None
    
    force_lower = force_layer.lower()
    
    # FREE tier layers
    if user_tier == UserTier.FREE:
        return CognitiveLayer.FREE_TEXT
    
    # JIVE tier layers
    if user_tier == UserTier.JIVE:
        if "reasoning" in force_lower or "cepo" in force_lower:
            return CognitiveLayer.JIVE_REASONING
        return CognitiveLayer.JIVE_SPEED
    
    # JIGGA tier layers
    if user_tier == UserTier.JIGGA:
        if "fast" in force_lower or "quick" in force_lower:
            return CognitiveLayer.JIGGA_FAST
        return CognitiveLayer.JIGGA_THINK
    
    return None


# =========================================================================
# PROMPT ENHANCEMENT (Universal - All Tiers)
# =========================================================================

class EnhanceRequest(BaseModel):
    """Request for prompt enhancement."""
    prompt: str = Field(..., min_length=1, max_length=4000)
    user_id: str | None = None


@router.post("/enhance")
async def enhance_prompt(request: EnhanceRequest) -> dict[str, Any]:
    """
    Enhance a prompt using Llama 3.3 70B FREE.
    
    Available to ALL tiers - this is the universal "Enhance" button.
    Works for both text and image prompts.
    
    Returns:
        original_prompt, enhanced_prompt, and metadata
    """
    try:
        result = await openrouter_service.enhance_prompt(request.prompt)
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.exception("Prompt enhancement error")
        raise HTTPException(status_code=500, detail=str(e))


# =========================================================================
# STREAMING (JIVE/JIGGA Only)
# =========================================================================

@router.post("/stream")
async def chat_stream(request: TieredChatRequest):
    """
    Stream a response using Server-Sent Events (SSE).
    
    Only available for JIVE and JIGGA tiers - FREE tier uses standard response.
    
    SSE Event Types:
        - meta: Initial metadata (tier, layer, model)
        - content: Main response text chunks
        - thinking_start: Start of JIGGA thinking block
        - thinking: Thinking block content chunks
        - thinking_end: End of JIGGA thinking block
        - done: Final metadata with usage stats and costs
        - error: Error message if something goes wrong
    
    Returns:
        StreamingResponse with text/event-stream content type
    """
    from fastapi.responses import StreamingResponse
    
    # Only JIVE and JIGGA support streaming
    if request.user_tier == UserTier.FREE:
        raise HTTPException(
            status_code=400, 
            detail="Streaming not available for FREE tier. Use the standard /chat endpoint."
        )
    
    # Track analytics
    await posthog_service.capture(
        user_id=request.user_id,
        event="chat_stream_started",
        properties={
            "tier": request.user_tier.value,
            "message_length": len(request.message)
        }
    )
    
    # Route to appropriate layer
    if request.force_layer:
        layer = _resolve_force_layer(request.force_layer, request.user_tier)
    else:
        layer = tier_router.classify_intent(
            request.message, 
            request.user_tier, 
            request.context_tokens
        )
    
    # Determine streaming mode based on layer
    is_jigga = request.user_tier == UserTier.JIGGA
    thinking_mode = layer == CognitiveLayer.JIGGA_THINK
    append_no_think = layer == CognitiveLayer.JIGGA_FAST
    
    async def event_generator():
        async for chunk in ai_service.generate_stream(
            user_id=request.user_id,
            message=request.message,
            history=request.history,
            layer=layer,
            thinking_mode=thinking_mode,
            append_no_think=append_no_think
        ):
            yield chunk
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


# =========================================================================
# MODEL INFO
# =========================================================================

@router.get("/tiers")
async def list_tiers():
    """List available tiers and their capabilities."""
    from app.config import settings
    from app.core.router import IMAGE_LIMITS
    
    return {
        "tiers": [
            {
                "id": "free",
                "name": "Free Tier",
                "text": {
                    "model": settings.OPENROUTER_MODEL_LLAMA,
                    "provider": "OpenRouter",
                    "cost": "FREE"
                },
                "images": {
                    "model": settings.OPENROUTER_MODEL_LONGCAT,
                    "provider": "OpenRouter", 
                    "limit": IMAGE_LIMITS[UserTier.FREE],
                    "cost": "FREE"
                },
                "prompt_enhancement": {
                    "model": settings.OPENROUTER_MODEL_LLAMA,
                    "cost": "FREE"
                }
            },
            {
                "id": "jive",
                "name": "Jive Tier (Pro)",
                "text": {
                    "simple": {
                        "model": settings.MODEL_SPEED,
                        "name": "Llama 3.1 8B",
                        "provider": "Cerebras"
                    },
                    "complex": {
                        "model": f"{settings.MODEL_SPEED}+CePO",
                        "name": "Llama 3.1 8B + CePO",
                        "provider": "Cerebras"
                    }
                },
                "images": {
                    "model": settings.DEEPINFRA_IMAGE_MODEL,
                    "provider": "DeepInfra",
                    "limit": IMAGE_LIMITS[UserTier.JIVE]
                },
                "prompt_enhancement": {
                    "model": settings.OPENROUTER_MODEL_LLAMA,
                    "cost": "FREE (included)"
                }
            },
            {
                "id": "jigga",
                "name": "Jigga Tier (Advanced)",
                "text": {
                    "thinking": {
                        "model": settings.MODEL_COMPLEX,
                        "name": "Qwen 3 235B",
                        "provider": "Cerebras",
                        "settings": "temp=0.6, top_p=0.95"
                    },
                    "fast": {
                        "model": settings.MODEL_COMPLEX,
                        "name": "Qwen 3 235B + /no_think",
                        "provider": "Cerebras",
                        "note": "Appends /no_think for fast responses"
                    }
                },
                "images": {
                    "model": settings.DEEPINFRA_IMAGE_MODEL,
                    "provider": "DeepInfra",
                    "limit": IMAGE_LIMITS[UserTier.JIGGA]
                },
                "prompt_enhancement": {
                    "model": settings.OPENROUTER_MODEL_LLAMA,
                    "cost": "FREE (included)"
                }
            }
        ]
    }


@router.get("/models")
async def list_models():
    """List available models (legacy endpoint)."""
    return await list_tiers()
