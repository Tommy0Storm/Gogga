"""
Image Generation Service - Tier-Based Pipeline.

FREE Tier (via /api/v1/images endpoint):
    User → Qwen 235B FREE (enhance) → Pollinations.ai → Image
    
JIVE/JIGGA Tier (via tool calling):
    AI calls generate_image tool → Pollinations.ai → Image
    
GOGGA PRO (Image Button - Paid Subscribers):
    User → Qwen 235B FREE (enhance) → FLUX 1.1 Pro → Premium Image

Prompt enhancement is ALWAYS via OpenRouter Qwen 3 235B FREE.

Named after Irma Stern, pioneering South African expressionist painter (1894-1966).
"""

import asyncio
import logging
import os
import time
import urllib.parse
from typing import Any, Final

import httpx
from pydantic import BaseModel

from app.config import get_settings
from app.core.router import UserTier, IMAGE_LIMITS
from app.services.openrouter_service import openrouter_service
from app.services.cost_tracker import track_image_usage

logger = logging.getLogger(__name__)

# AI Horde API endpoints (free, community-powered)
AI_HORDE_API_URL: Final[str] = "https://aihorde.net/api/v2"
AI_HORDE_API_KEY: Final[str] = os.getenv("AI_HORDE_API_KEY", "0000000000")  # Registered key or anonymous
AI_HORDE_POLL_INTERVAL: Final[float] = 2.0  # seconds between status checks
AI_HORDE_TIMEOUT: Final[float] = 30.0  # Reasonable timeout for registered users

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
    image_data: str  # Primary image URL/data
    image_urls: list[str] = []  # All successful image URLs (for dual generation)
    size: str | None = None
    meta: dict[str, Any] = {}


class ImageService:
    """
    Tier-based image generation service.
    
    FREE: OpenRouter LongCat Flash (free, unlimited-ish)
    JIVE: DeepInfra FLUX 1.1 Pro (capped at 200/month)
    JIGGA: DeepInfra FLUX 1.1 Pro (capped at 1000/month)
    
    Prompt enhancement is ALWAYS via Qwen 3 235B FREE.
    """
    
    def __init__(self) -> None:
        self._flux_client: httpx.AsyncClient | None = None
        self._horde_client: httpx.AsyncClient | None = None
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

    @property
    def horde_client(self) -> httpx.AsyncClient:
        """Lazy initialization of AI Horde HTTP client."""
        if self._horde_client is None:
            self._horde_client = httpx.AsyncClient(
                timeout=AI_HORDE_TIMEOUT,
                headers={
                    "Content-Type": "application/json",
                    "apikey": AI_HORDE_API_KEY,
                    "Client-Agent": "Gogga:1.0:gogga@southafrica.ai",
                }
            )
        return self._horde_client
    
    async def generate_image(
        self,
        prompt: str,
        user_id: str | None = None,
        user_tier: UserTier = UserTier.FREE,
        size: str = DEFAULT_IMAGE_SIZE,
        enhance_prompt: bool = True,
        use_premium: bool = False,
    ) -> ImageGenerationResponse:
        """
        Generate an image based on user tier.
        
        FREE: Qwen 235B → Pollinations.ai (free)
        JIVE/JIGGA (tool call): Pollinations.ai (free)
        JIVE/JIGGA (button, use_premium=True): GOGGA Pro (FLUX 1.1)
        
        Args:
            prompt: Image description
            user_id: User identifier
            user_tier: User's subscription tier
            size: Image dimensions (GOGGA Pro only)
            enhance_prompt: Whether to enhance prompt first
            use_premium: Use GOGGA Pro (FLUX) instead of Pollinations
            
        Returns:
            ImageGenerationResponse with image data
        """
        if user_tier == UserTier.FREE:
            return await self._generate_free(prompt, user_id, enhance_prompt)
        elif use_premium:
            # GOGGA Pro - Premium FLUX generation (image button)
            return await self._generate_flux(prompt, user_id, user_tier, size, enhance_prompt)
        else:
            # Default to Pollinations for tool calling
            return await self._generate_free(prompt, user_id, enhance_prompt)

    async def _generate_horde_image(self, prompt: str) -> str | None:
        """
        Generate image via AI Horde (community-powered, free).
        
        Returns image URL on success, None on failure (silently handles errors).
        Includes retry logic for 429 rate limits.
        """
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                # Step 1: Submit async generation request
                # Using smaller size (512x512 < 588x588 limit) and low steps to avoid kudos requirement
                generate_payload = {
                    "prompt": prompt,
                    "params": {
                        "cfg_scale": 7,
                        "sampler_name": "k_euler",
                        "height": 512,
                        "width": 512,
                        "steps": 15,  # Low steps to avoid kudos upfront requirement
                        "karras": True,
                        "n": 1
                    },
                    "nsfw": False,
                    "censor_nsfw": True,
                    "trusted_workers": False,  # Allow all workers for faster processing
                    "models": [],  # Empty = any model, faster queue
                    "r2": True,  # Return URL instead of base64
                    "shared": False,
                    "slow_workers": True  # Allow slow workers for availability
                }
                
                response = await self.horde_client.post(
                    f"{AI_HORDE_API_URL}/generate/async",
                    json=generate_payload
                )
                
                if response.status_code == 429:
                    # Rate limited - wait and retry
                    retry_after = int(response.headers.get("Retry-After", 5))
                    logger.debug("AI Horde rate limited, retrying in %ds (attempt %d/%d)", retry_after, attempt + 1, max_retries)
                    await asyncio.sleep(retry_after)
                    continue
                
                if response.status_code != 202:
                    logger.debug("AI Horde submit failed: %s", response.text)
                    return None
                
                result = response.json()
                request_id = result.get("id")
                if not request_id:
                    return None
                
                logger.debug("AI Horde request submitted: %s", request_id)
                
                # Step 2: Poll for completion (with timeout)
                start = time.monotonic()
                while time.monotonic() - start < AI_HORDE_TIMEOUT:
                    check_response = await self.horde_client.get(
                        f"{AI_HORDE_API_URL}/generate/check/{request_id}"
                    )
                    
                    if check_response.status_code != 200:
                        await asyncio.sleep(AI_HORDE_POLL_INTERVAL)
                        continue
                    
                    check_data = check_response.json()
                    if check_data.get("finished", 0) >= 1:
                        break
                    if check_data.get("faulted"):
                        logger.debug("AI Horde generation faulted")
                        return None
                        
                    await asyncio.sleep(AI_HORDE_POLL_INTERVAL)
                else:
                    # Timeout - cancel request silently
                    logger.debug("AI Horde timeout, cancelling request")
                    await self.horde_client.delete(
                        f"{AI_HORDE_API_URL}/generate/status/{request_id}"
                    )
                    return None
                
                # Step 3: Get completed image
                status_response = await self.horde_client.get(
                    f"{AI_HORDE_API_URL}/generate/status/{request_id}"
                )
                
                if status_response.status_code != 200:
                    return None
                
                status_data = status_response.json()
                generations = status_data.get("generations", [])
                
                if generations and generations[0].get("img"):
                    image_url = generations[0]["img"]
                    logger.info("AI Horde image generated successfully")
                    return image_url
                
                return None
                
            except Exception as e:
                # Silent failure - don't let Horde errors affect user experience
                logger.debug("AI Horde error (silent): %s", e)
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)  # Brief pause before retry
                    continue
                return None
        
        return None
    
    async def _generate_free(
        self,
        prompt: str,
        user_id: str | None,
        enhance_prompt: bool
    ) -> ImageGenerationResponse:
        """
        FREE tier: Dual generation (Pollinations.ai + AI Horde)
        
        Calls both generators in parallel. Returns all successful images.
        If one fails, silently returns just the other. User never sees errors.
        
        Uses OpenRouter for enhancement + dual free generators.
        Cost: $0.00 (completely free, no API keys needed)
        """
        start_time = time.perf_counter()
        original_prompt = prompt
        enhancement_meta = {}
        
        logger.info(
            "FREE image pipeline (dual: Pollinations + AI Horde) | user=%s | enhance=%s",
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
        
        # Step 2: Generate with BOTH providers in parallel
        # Pollinations is instant (URL-based), Horde is async (may take 10-60s)
        encoded_prompt = urllib.parse.quote(prompt)
        pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}"
        
        # Fire AI Horde request in parallel (returns None on failure/timeout)
        horde_task = asyncio.create_task(self._generate_horde_image(prompt))
        
        # Collect all successful image URLs
        image_urls = [pollinations_url]  # Pollinations always "succeeds" (URL-based)
        
        # Wait for Horde with timeout (don't block user forever)
        try:
            horde_url = await asyncio.wait_for(horde_task, timeout=AI_HORDE_TIMEOUT + 5)
            if horde_url:
                image_urls.append(horde_url)
                logger.info("Both Pollinations and AI Horde succeeded")
            else:
                logger.debug("AI Horde returned None (silent fallback to Pollinations only)")
        except asyncio.TimeoutError:
            logger.debug("AI Horde timed out (silent fallback to Pollinations only)")
        except Exception as e:
            logger.debug("AI Horde error (silent): %s", e)
        
        total_latency = time.perf_counter() - start_time
        
        # Track FREE tier image usage (cost: $0.00, but tracked for limits)
        cost_data = await track_image_usage(
            user_id=user_id or "anonymous",
            tier="free",
            generator="pollinations+horde" if len(image_urls) > 1 else "pollinations",
            image_count=len(image_urls)
        )
        
        return ImageGenerationResponse(
            success=True,
            original_prompt=original_prompt,
            enhanced_prompt=prompt,
            image_data=image_urls[0],  # Primary image (Pollinations - always first)
            image_urls=image_urls,  # All successful images
            size=None,  # Auto-sized
            meta={
                "tier": "free",
                "pipeline": "llama-dual-free",
                "enhancement": enhancement_meta,
                "generators": ["pollinations"] + (["ai-horde"] if len(image_urls) > 1 else []),
                "image_count": len(image_urls),
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
        GOGGA PRO: Premium image generation with FLUX 1.1 Pro.
        
        Named after Irma Stern, pioneering SA expressionist painter.
        Uses OpenRouter for enhancement, DeepInfra for generation.
        Cost: $0.04 per image (JIVE/JIGGA subscribers only)
        """
        start_time = time.perf_counter()
        original_prompt = prompt
        enhancement_meta = {}
        
        logger.info(
            "GOGGA PRO (FLUX) | user=%s | tier=%s | size=%s | enhance=%s",
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
        
        # Step 2: Generate with FLUX 1.1 Pro (premium quality)
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
                "GOGGA PRO complete | user=%s | tier=%s | latency=%.2fs | cost=$%.4f",
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
                    "pipeline": "gogga-pro",
                    "generator": "GOGGA Pro (FLUX 1.1)",
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
                "GOGGA PRO API error | status=%d | response=%s",
                e.response.status_code,
                e.response.text[:200]
            )
            raise
        except Exception as e:
            logger.exception("GOGGA PRO generation failed: %s", str(e))
            raise
    
    async def close(self) -> None:
        """Close HTTP clients."""
        if self._flux_client:
            await self._flux_client.aclose()
            self._flux_client = None
        if self._horde_client:
            await self._horde_client.aclose()
            self._horde_client = None


# Singleton instance
image_service = ImageService()

# Re-export
__all__ = ["image_service", "ImageService", "ImageGenerationRequest", "ImageGenerationResponse"]
