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
from app.core.router import CognitiveLayer, UserTier, tier_router, is_image_prompt
from app.core.exceptions import InferenceError


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


class TieredChatRequest(BaseModel):
    """Extended chat request with tier support."""
    message: str = Field(..., min_length=1, max_length=32000)
    user_id: str = Field(default="anonymous")
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
    """
    try:
        # Check if this is an image request
        if is_image_prompt(request.message):
            raise HTTPException(
                status_code=400,
                detail="This looks like an image request. Use /api/v1/images/generate instead."
            )
        
        # Resolve force_layer if provided
        force_layer = _resolve_force_layer(request.force_layer, request.user_tier)
        
        result = await ai_service.generate_response(
            user_id=request.user_id,
            message=request.message,
            history=request.history,
            user_tier=request.user_tier,
            force_layer=force_layer,
            context_tokens=request.context_tokens
        )
        
        return ChatResponse(
            response=result["response"],
            thinking=result.get("thinking"),  # JIGGA thinking block for UI
            meta=result.get("meta", {})
        )
        
    except InferenceError as e:
        logger.error("Inference error for user %s: %s", request.user_id, e)
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error for user %s", request.user_id)
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
# STREAMING (Placeholder)
# =========================================================================

@router.post("/stream")
async def chat_stream(request: TieredChatRequest):
    """Stream a response (not yet implemented)."""
    raise HTTPException(status_code=501, detail="Streaming not yet implemented")


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
