"""
GOGGA Icon Generation API Endpoints

Provides icon generation via Gemini 2.0 Flash with tier limits and token tracking.

Endpoints:
- POST /api/v1/icons/generate - Generate new icon
- GET /api/v1/icons/history - Get user's icon history  
- DELETE /api/v1/icons/{icon_id} - Delete icon from history
- GET /api/v1/icons/quota - Get current usage and quota
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field

from app.services.icon_service import IconService
from app.services.credit_service import CreditService, ActionType
from app.core.auth import get_user_id

logger = logging.getLogger(__name__)
router = APIRouter()


class IconGenerateRequest(BaseModel):
    """Request to generate an icon."""
    prompt: str = Field(..., min_length=3, max_length=500, description="Icon description")
    lighting: str = Field(default="studio", description="Lighting style")
    complexity: str = Field(default="balanced", description="Detail level")
    backing: str = Field(default="none", description="Background shape")


class IconGenerateResponse(BaseModel):
    """Response from icon generation."""
    svg: str
    usage: dict
    cost: dict
    quota: dict


class IconQuotaResponse(BaseModel):
    """User's icon generation quota status."""
    tier: str
    used: int
    limit: int
    remaining: int
    credit_cost: int


@router.post("/generate", response_model=IconGenerateResponse)
async def generate_icon(
    request: IconGenerateRequest,
    user_id: Annotated[str, Depends(get_user_id)],
    x_user_tier: str = Header(default="FREE", alias="X-User-Tier"),
):
    """
    Generate a premium 3D SVG icon using Gemini 2.0 Flash.
    
    Tier limits:
    - FREE: 0 icons (must purchase credits)
    - JIVE: 3 icons/month (5 credits each)
    - JIGGA: 6 icons/month (5 credits each)
    
    Returns SVG content with token usage and cost tracking.
    """
    tier = x_user_tier.upper()
    
    logger.info(
        f"Icon generation request | user={user_id} | tier={tier} | "
        f"lighting={request.lighting} | complexity={request.complexity}"
    )
    
    # PRE-FLIGHT CREDIT CHECK
    try:
        user_state = await CreditService.get_user_state(user_id)
        
        # Check if user can generate icon (subscription or credits)
        check_result = CreditService.check_action(
            user_state,
            ActionType.ICON_GENERATE,
            quantity=1
        )
        
        if not check_result.allowed:
            logger.warning(
                f"Icon generation denied | user={user_id} | "
                f"reason={check_result.reason}"
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "quota_exceeded",
                    "message": check_result.reason,
                    "tier": tier,
                    "used": user_state.icons_used,
                    "limit": CreditService.get_tier_limit(tier, "icons"),
                }
            )
        
        logger.info(
            f"Icon generation approved | source={check_result.source.value} | "
            f"credits_deducted={check_result.credits_deducted}"
        )
        
    except Exception as e:
        logger.error(f"Credit check failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to check user quota")
    
    # GENERATE ICON
    try:
        result = await IconService.generate_icon(
            prompt=request.prompt,
            tier=tier,
            lighting=request.lighting,
            complexity=request.complexity,
            backing=request.backing,
        )
        
        logger.info(
            f"Icon generated | tokens={result.total_tokens} | "
            f"cost_zar=R{result.cost_zar:.4f}"
        )
        
    except RuntimeError as e:
        logger.error(f"Icon generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # DEDUCT FROM SUBSCRIPTION OR CREDITS
    try:
        deduction_result = await CreditService.deduct_action(
            user_state,
            ActionType.ICON_GENERATE,
            quantity=1
        )
        
        if not deduction_result.allowed:
            logger.error(
                f"Deduction failed after generation | user={user_id} | "
                f"reason={deduction_result.reason}"
            )
            # Icon was generated but can't be delivered - log for manual review
            raise HTTPException(
                status_code=500,
                detail="Icon generated but quota deduction failed. Contact support."
            )
        
        logger.info(
            f"Icon quota deducted | source={deduction_result.source.value} | "
            f"credits={deduction_result.credits_deducted}"
        )
        
    except Exception as e:
        logger.error(f"Quota deduction failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update quota")
    
    # Return response with quota status
    tier_limit = CreditService.get_tier_limit(tier, "icons")
    icons_used = user_state.icons_used + 1  # Include current generation
    
    return IconGenerateResponse(
        svg=result.svg_content,
        usage={
            "promptTokens": result.prompt_tokens,
            "candidatesTokens": result.candidates_tokens,
            "totalTokens": result.total_tokens,
        },
        cost={
            "usd": round(result.cost_usd, 6),
            "zar": round(result.cost_zar, 4),
        },
        quota={
            "tier": tier,
            "used": icons_used,
            "limit": tier_limit,
            "remaining": max(0, tier_limit - icons_used),
            "source": deduction_result.source.value,
            "credits_deducted": deduction_result.credits_deducted,
        }
    )


@router.get("/quota", response_model=IconQuotaResponse)
async def get_icon_quota(
    user_id: Annotated[str, Depends(get_user_id)],
    x_user_tier: str = Header(default="FREE", alias="X-User-Tier"),
):
    """
    Get user's current icon generation quota status.
    
    Returns how many icons have been used and how many remain.
    """
    tier = x_user_tier.upper()
    
    try:
        user_state = await CreditService.get_user_state(user_id)
        tier_limit = CreditService.get_tier_limit(tier, "icons")
        
        return IconQuotaResponse(
            tier=tier,
            used=user_state.icons_used,
            limit=tier_limit,
            remaining=max(0, tier_limit - user_state.icons_used),
            credit_cost=5,  # Credits per icon
        )
        
    except Exception as e:
        logger.error(f"Failed to get icon quota: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch quota")
