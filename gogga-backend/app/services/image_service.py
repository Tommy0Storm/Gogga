"""
Image Generation Service - Tier-Based Pipeline.

FREE Tier:
    User → Llama 3.3 FREE (enhance) → LongCat Flash FREE → Image
    
JIVE/JIGGA Tier:
    User → Llama 3.3 FREE (enhance) → FLUX 1.1 Pro → Image

Prompt enhancement is ALWAYS via OpenRouter Llama 3.3 70B FREE.
"""

import logging
import time
from typing import Any, Final

import httpx
from pydantic import BaseModel

from app.config import get_settings
from app.core.router import UserTier, IMAGE_LIMITS
from app.services.openrouter_service import openrouter_service
from app.services.cost_tracker import track_image_usage

logger = logging.getLogger(__name__)

# Constants
DEEPINFRA_API_URL: Final[str] = "https://api.deepinfra.com/v1/openai/images/generations"
DEFAULT_IMAGE_SIZE: Final[str] = "1024x1024"


class ImageGenerationRequest(BaseModel):
    """Request model for image generation."""
    prompt: str
    user_id: str | None = None
    user_tier: UserTier = UserTier.FREE
    size: str = DEFAULT_IMAGE_SIZE
    enhance_prompt: bool = True


class ImageGenerationResponse(BaseModel):
    """Response model for image generation."""
    success: bool = True
    original_prompt: str
    enhanced_prompt: str
    image_data: str  # Base64 for FLUX, content for LongCat
    size: str | None = None
    meta: dict[str, Any] = {}


class ImageService:
    """
    Tier-based image generation service.
    
    FREE: OpenRouter LongCat Flash (free, unlimited-ish)
    JIVE: DeepInfra FLUX 1.1 Pro (capped at 200/month)
    JIGGA: DeepInfra FLUX 1.1 Pro (capped at 1000/month)
    
    Prompt enhancement is ALWAYS via Llama 3.3 70B FREE.
    """
    
    def __init__(self) -> None:
        self._flux_client: httpx.AsyncClient | None = None
        self._settings = get_settings()
    
    @property
    def flux_client(self) -> httpx.AsyncClient:
        """Lazy initialization of FLUX HTTP client."""
        if self._flux_client is None:
            self._flux_client = httpx.AsyncClient(
                timeout=120.0,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._settings.DEEPINFRA_API_KEY}",
                }
            )
        return self._flux_client
    
    async def generate_image(
        self,
        prompt: str,
        user_id: str | None = None,
        user_tier: UserTier = UserTier.FREE,
        size: str = DEFAULT_IMAGE_SIZE,
        enhance_prompt: bool = True,
    ) -> ImageGenerationResponse:
        """
        Generate an image based on user tier.
        
        FREE: Llama → LongCat
        JIVE/JIGGA: Llama → FLUX
        
        Args:
            prompt: Image description
            user_id: User identifier
            user_tier: User's subscription tier
            size: Image dimensions (FLUX only)
            enhance_prompt: Whether to enhance prompt first
            
        Returns:
            ImageGenerationResponse with image data
        """
        if user_tier == UserTier.FREE:
            return await self._generate_free(prompt, user_id, enhance_prompt)
        else:
            return await self._generate_flux(prompt, user_id, user_tier, size, enhance_prompt)
    
    async def _generate_free(
        self,
        prompt: str,
        user_id: str | None,
        enhance_prompt: bool
    ) -> ImageGenerationResponse:
        """
        FREE tier: Llama 3.3 → LongCat Flash.
        
        Uses OpenRouter's free models entirely.
        Cost: $0.00 (still tracked for usage limits)
        """
        start_time = time.perf_counter()
        original_prompt = prompt
        enhancement_meta = {}
        
        logger.info(
            "FREE image pipeline | user=%s | enhance=%s",
            user_id or "anonymous",
            enhance_prompt
        )
        
        # Step 1: Enhance prompt with Llama (if enabled)
        if enhance_prompt:
            try:
                enhancement = await openrouter_service.enhance_prompt(prompt)
                prompt = enhancement["enhanced_prompt"]
                enhancement_meta = enhancement["meta"]
            except Exception as e:
                logger.warning("Prompt enhancement failed: %s", e)
                enhancement_meta = {"error": str(e)}
        
        # Step 2: Generate with LongCat
        result = await openrouter_service.generate_image_free(
            prompt=prompt,
            user_id=user_id,
            enhance=False  # Already enhanced above
        )
        
        total_latency = time.perf_counter() - start_time
        
        # Track FREE tier image usage (cost: $0.00, but tracked for limits)
        cost_data = await track_image_usage(
            user_id=user_id or "anonymous",
            tier="free",
            generator="longcat",
            image_count=1
        )
        
        return ImageGenerationResponse(
            success=True,
            original_prompt=original_prompt,
            enhanced_prompt=prompt,
            image_data=result["content"],
            size=None,  # LongCat doesn't have size
            meta={
                "tier": "free",
                "pipeline": "llama-longcat",
                "enhancement": enhancement_meta,
                "generation_model": self._settings.OPENROUTER_MODEL_LONGCAT,
                "latency_seconds": round(total_latency, 3),
                "cost_usd": cost_data["usd"],
                "cost_zar": cost_data["zar"],
                "limit": IMAGE_LIMITS[UserTier.FREE]
            }
        )
    
    async def _generate_flux(
        self,
        prompt: str,
        user_id: str | None,
        user_tier: UserTier,
        size: str,
        enhance_prompt: bool
    ) -> ImageGenerationResponse:
        """
        JIVE/JIGGA tier: Llama 3.3 → FLUX 1.1 Pro.
        
        Uses OpenRouter for enhancement, DeepInfra for generation.
        Cost: $0.04 per image
        """
        start_time = time.perf_counter()
        original_prompt = prompt
        enhancement_meta = {}
        
        logger.info(
            "FLUX image pipeline | user=%s | tier=%s | size=%s | enhance=%s",
            user_id or "anonymous",
            user_tier.value,
            size,
            enhance_prompt
        )
        
        # Step 1: Enhance prompt with Llama FREE (if enabled)
        if enhance_prompt:
            try:
                enhancement = await openrouter_service.enhance_prompt(prompt)
                prompt = enhancement["enhanced_prompt"]
                enhancement_meta = enhancement["meta"]
                
                logger.info(
                    "Prompt enhanced | original=%d chars | enhanced=%d chars",
                    len(original_prompt), len(prompt)
                )
            except Exception as e:
                logger.warning("Prompt enhancement failed: %s", e)
                enhancement_meta = {"error": str(e)}
        
        # Step 2: Generate with FLUX
        payload = {
            "model": self._settings.DEEPINFRA_IMAGE_MODEL,
            "prompt": prompt,
            "size": size,
            "n": 1,
            "response_format": "b64_json",
        }
        
        if user_id:
            payload["user"] = user_id
        
        try:
            response = await self.flux_client.post(DEEPINFRA_API_URL, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get("data") or len(data["data"]) == 0:
                raise ValueError("No image data in response")
            
            image_data = data["data"][0]
            total_latency = time.perf_counter() - start_time
            
            # Track image cost ($0.04 per FLUX image)
            cost_data = await track_image_usage(
                user_id=user_id or "anonymous",
                tier=user_tier.value,
                generator="flux",
                image_count=1
            )
            
            logger.info(
                "FLUX image complete | user=%s | tier=%s | latency=%.2fs | cost=$%.4f",
                user_id or "anonymous",
                user_tier.value,
                total_latency,
                cost_data["usd"]
            )
            
            return ImageGenerationResponse(
                success=True,
                original_prompt=original_prompt,
                enhanced_prompt=prompt,
                image_data=image_data.get("b64_json", ""),
                size=size,
                meta={
                    "tier": user_tier.value,
                    "pipeline": "llama-flux",
                    "enhancement": enhancement_meta,
                    "generation_model": self._settings.DEEPINFRA_IMAGE_MODEL,
                    "latency_seconds": round(total_latency, 3),
                    "cost_usd": cost_data["usd"],
                    "cost_zar": cost_data["zar"],
                    "limit": IMAGE_LIMITS[user_tier]
                }
            )
            
        except httpx.HTTPStatusError as e:
            logger.error(
                "FLUX API error | status=%d | response=%s",
                e.response.status_code,
                e.response.text[:200]
            )
            raise
        except Exception as e:
            logger.exception("FLUX generation failed: %s", str(e))
            raise
    
    async def close(self) -> None:
        """Close HTTP clients."""
        if self._flux_client:
            await self._flux_client.aclose()
            self._flux_client = None


# Singleton instance
image_service = ImageService()

# Re-export
__all__ = ["image_service", "ImageService", "ImageGenerationRequest", "ImageGenerationResponse"]
