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
    message: str = Field(..., min_length=1, max_length=100000)
    user_id: str = Field(default="anonymous")
    user_email: str | None = Field(default=None, description="User email for subscription verification")
    user_tier: UserTier = Field(default=UserTier.FREE)
    history: list[dict[str, str]] | None = None
    context_tokens: int = Field(default=0, description="Token count for JIGGA thinking mode")
    force_layer: str | None = None
    force_tool: str | None = Field(default=None, description="ToolShed: Force a specific tool by name")


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
        All → Cerebras Qwen 3 32B with thinking (temp=0.6, top_p=0.95)
        NOTE: /no_think removed for better quality on analysis/long docs
    
    Backend enforces tier limits by verifying subscription status.
    Users out of credits are downgraded to FREE tier models.
    """
    try:
        # Check if this is an image request - only block for FREE tier
        # JIVE/JIGGA tiers can use the generate_image tool via tool calling
        if request.user_tier == UserTier.FREE and is_image_prompt(request.message):
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
        
        # Truncate oversized messages to fit context window (65k tokens ≈ 50k chars safely)
        MAX_MESSAGE_CHARS = 50000
        message = request.message
        if len(message) > MAX_MESSAGE_CHARS:
            logger.warning(
                "Message too long (%d chars), truncating to %d for user %s",
                len(message), MAX_MESSAGE_CHARS, request.user_id
            )
            # Try to preserve the instruction and truncate the data
            lines = message.split('\n')
            # Keep first 5 lines (usually instructions) and last line
            header_lines = lines[:5]
            # Find data lines and limit them
            truncated = '\n'.join(header_lines)
            remaining_budget = MAX_MESSAGE_CHARS - len(truncated) - 200  # Buffer for footer
            
            # Add as many data lines as we can fit
            data_lines = lines[5:]
            current_size = 0
            included_lines = []
            for line in data_lines:
                if current_size + len(line) + 1 < remaining_budget:
                    included_lines.append(line)
                    current_size += len(line) + 1
                else:
                    break
            
            truncated += '\n' + '\n'.join(included_lines)
            truncated += f'\n\n[DATA TRUNCATED: Showing {len(included_lines)} of {len(data_lines)} rows. For full analysis, please send smaller datasets.]'
            message = truncated
        
        result = await ai_service.generate_response(
            user_id=request.user_id,
            message=message,
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
            tool_calls=result.get("tool_calls"),  # Tool calls for frontend execution
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
        # User toggle: Force 235B multilingual model
        if "235b" in force_lower or "235" in force_lower or "multilingual" in force_lower:
            return CognitiveLayer.JIGGA_MULTILINGUAL
        # User toggle: Force 32B model
        if "32b" in force_lower or "32" in force_lower:
            return CognitiveLayer.JIGGA_THINK
        # Legacy: fast mode
        if "fast" in force_lower or "quick" in force_lower:
            return CognitiveLayer.JIGGA_FAST
        # Default to thinking mode
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
    
    # Auto-enable /no_think for very long contexts (100k+ tokens) per Cerebras recommendation
    # This improves accuracy for long context scenarios
    long_context_threshold = 100000
    append_no_think = is_jigga and request.context_tokens >= long_context_threshold
    
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


@router.post("/stream-with-tools")
async def chat_stream_with_tools(request: TieredChatRequest):
    """
    Stream a response with live tool execution logs.
    
    Provides real-time visibility into math tool execution via SSE.
    
    SSE Event Types:
        - meta: Initial metadata (tier, layer, model)
        - tool_start: Math tool execution starting (includes tool names)
        - tool_log: Real-time execution log entry (level, message, icon)
        - tool_complete: All tools finished
        - content: Main response text chunks
        - thinking_start/thinking/thinking_end: JIGGA thinking blocks
        - done: Final metadata with usage stats, costs, tool info
        - error: Error message if something goes wrong
    
    Returns:
        StreamingResponse with text/event-stream content type
    """
    from fastapi.responses import StreamingResponse
    
    # Only JIVE and JIGGA support tool streaming
    if request.user_tier == UserTier.FREE:
        raise HTTPException(
            status_code=400, 
            detail="Tool streaming not available for FREE tier. Use /chat endpoint."
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
    
    is_jigga = request.user_tier == UserTier.JIGGA
    thinking_mode = layer == CognitiveLayer.JIGGA_THINK
    tier = "jigga" if is_jigga else "jive"
    
    # Auto /no_think for long contexts
    append_no_think = is_jigga and request.context_tokens >= 100000
    
    async def event_generator():
        async for chunk in ai_service.generate_response_with_tools_stream(
            user_id=request.user_id,
            message=request.message,
            history=request.history,
            layer=layer,
            thinking_mode=thinking_mode,
            append_no_think=append_no_think,
            tier=tier,
            force_tool=request.force_tool,  # ToolShed: Force specific tool
        ):
            yield chunk
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
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
                    "model": settings.MODEL_JIVE,
                    "name": "Qwen 3 32B",
                    "provider": "Cerebras",
                    "settings": "temp=0.6, top_p=0.95, top_k=20",
                    "mode": "thinking"
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
                    "general": {
                        "model": settings.MODEL_JIGGA,
                        "name": "Qwen 3 32B",
                        "mode": "thinking"
                    },
                    "complex": {
                        "model": settings.MODEL_JIGGA_235B,
                        "name": "Qwen 3 235B",
                        "mode": "thinking",
                        "note": "Used for complex/legal queries and African languages"
                    },
                    "provider": "Cerebras",
                    "settings": "temp=0.6, top_p=0.95, top_k=20"
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
