"""
Media API endpoints for GOGGA.

Provides image generation, editing, upscaling, and video generation
using Vertex AI Imagen and Veo models.
"""

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import UserTier, get_current_user_tier
from app.services.imagen_service import (
    ImagenOperation,
    ImagenRequest,
    ImagenResponse,
    IMAGEN_LIMITS,
    imagen_service,
)
from app.services.veo_service import (
    VeoRequest,
    VeoResponse,
    VeoJobStatus,
    VEO_LIMITS,
    veo_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["media"])


# ============================================================================
# Request/Response Models
# ============================================================================

class ImageCreateRequest(BaseModel):
    """Request for text-to-image generation."""
    prompt: str = Field(..., min_length=1, max_length=2000)
    aspect_ratio: str = Field(default="1:1", pattern=r"^\d+:\d+$")
    negative_prompt: str | None = None
    sample_count: int = Field(default=1, ge=1, le=4)
    person_generation: Literal["allow_adult", "dont_allow"] = Field(default="allow_adult")
    safety_setting: Literal["block_few", "block_some", "block_most"] = Field(default="block_some")
    # Idempotency key to prevent duplicate costs
    idempotency_key: str | None = Field(default=None, description="UUID v4 for request deduplication")


class ImageEditRequest(BaseModel):
    """Request for mask-based image editing."""
    prompt: str = Field(..., min_length=1, max_length=2000)
    source_image: str = Field(..., description="Base64-encoded source image")
    mask_image: str | None = Field(default=None, description="Base64-encoded mask")
    edit_mode: Literal[
        "EDIT_MODE_INPAINT_INSERTION",
        "EDIT_MODE_INPAINT_REMOVAL",
        "EDIT_MODE_OUTPAINT",
        "EDIT_MODE_BGSWAP"
    ] = Field(default="EDIT_MODE_INPAINT_INSERTION")
    mask_dilation: float = Field(default=0.03, ge=0, le=1)
    sample_count: int = Field(default=1, ge=1, le=4)
    # Idempotency key to prevent duplicate costs
    idempotency_key: str | None = Field(default=None, description="UUID v4 for request deduplication")


class ImageUpscaleRequest(BaseModel):
    """Request for image upscaling."""
    source_image: str = Field(..., description="Base64-encoded source image")
    upscale_factor: Literal["x2", "x3", "x4"] = Field(default="x2")
    # Idempotency key to prevent duplicate costs
    idempotency_key: str | None = Field(default=None, description="UUID v4 for request deduplication")


class VideoGenerateRequest(BaseModel):
    """Request for video generation (Veo 3.1 API)."""
    prompt: str = Field(..., min_length=1, max_length=2000)
    source_image: str | None = Field(default=None, description="Base64 image for img2vid")
    source_video: str | None = Field(default=None, description="Base64 video for extension")
    storage_uri: str | None = Field(default=None, description="GCS URI for output")
    aspect_ratio: Literal["16:9", "9:16"] = Field(default="16:9")
    duration_seconds: Literal[4, 6, 8] = Field(default=6)
    generate_audio: bool = Field(default=False)
    negative_prompt: str | None = None
    person_generation: Literal["allow_adult", "dont_allow"] = Field(default="allow_adult")
    resolution: Literal["720p", "1080p"] | None = None
    sample_count: int = Field(default=1, ge=1, le=4)
    seed: int | None = None
    use_fast_model: bool = Field(default=False)
    # Idempotency key to prevent duplicate costs
    idempotency_key: str | None = Field(default=None, description="UUID v4 for request deduplication")


class QuotaResponse(BaseModel):
    """Response with user's remaining quota."""
    tier: str
    images: dict[str, int]  # create, edit, upscale remaining
    video_minutes: float
    allow_audio: bool


# ============================================================================
# Image Endpoints
# ============================================================================

@router.post("/images/generate", response_model=ImagenResponse)
async def generate_image(
    request: ImageCreateRequest,
    user_tier: Annotated[UserTier, Depends(get_current_user_tier)],
    user_id: str | None = None,
) -> ImagenResponse:
    """
    Generate image(s) from text prompt using Imagen 3.0.
    
    Features:
    - Idempotency: Pass idempotency_key to prevent duplicate costs
    - Tier-based watermark: FREE tier images include SynthID watermark
    - Retry: Automatic retry with exponential backoff for 429/5xx errors
    
    Tier limits:
    - FREE: 1 preview/day (watermarked)
    - JIVE: 50/month
    - JIGGA: 200/month
    """
    limits = IMAGEN_LIMITS[user_tier]
    
    if limits["create"] == 0:
        raise HTTPException(
            status_code=403,
            detail="Image generation not available for FREE tier. Upgrade to JIVE or JIGGA."
        )
    
    imagen_request = ImagenRequest(
        prompt=request.prompt,
        operation=ImagenOperation.CREATE,
        aspect_ratio=request.aspect_ratio,
        negative_prompt=request.negative_prompt,
        sample_count=request.sample_count,
        person_generation=request.person_generation,
        safety_setting=request.safety_setting,
        idempotency_key=request.idempotency_key,
    )
    
    response = await imagen_service.generate(
        request=imagen_request,
        user_id=user_id,
        user_tier=user_tier,
    )
    
    if not response.success:
        raise HTTPException(status_code=500, detail=response.error)
    
    return response


@router.post("/images/edit", response_model=ImagenResponse)
async def edit_image(
    request: ImageEditRequest,
    user_tier: Annotated[UserTier, Depends(get_current_user_tier)],
    user_id: str | None = None,
) -> ImagenResponse:
    """
    Edit an image using mask-based editing (inpaint, outpaint, background swap).
    
    Supported modes:
    - EDIT_MODE_INPAINT_INSERTION: Add elements to masked areas
    - EDIT_MODE_INPAINT_REMOVAL: Remove elements from masked areas
    - EDIT_MODE_OUTPAINT: Extend image canvas
    - EDIT_MODE_BGSWAP: Replace background
    
    Features:
    - Idempotency: Pass idempotency_key to prevent duplicate costs
    - Retry: Automatic retry with exponential backoff for 429/5xx errors
    
    Tier limits:
    - FREE: Not available
    - JIVE: 20/month
    - JIGGA: 100/month
    """
    limits = IMAGEN_LIMITS[user_tier]
    
    if limits["edit"] == 0:
        raise HTTPException(
            status_code=403,
            detail="Image editing not available for your tier. Upgrade to JIVE or JIGGA."
        )
    
    imagen_request = ImagenRequest(
        prompt=request.prompt,
        operation=ImagenOperation.EDIT,
        source_image=request.source_image,
        mask_image=request.mask_image,
        edit_mode=request.edit_mode,
        sample_count=request.sample_count,
        idempotency_key=request.idempotency_key,
    )
    
    response = await imagen_service.edit(
        request=imagen_request,
        user_id=user_id,
        user_tier=user_tier,
    )
    
    if not response.success:
        raise HTTPException(status_code=500, detail=response.error)
    
    return response


@router.post("/images/upscale", response_model=ImagenResponse)
async def upscale_image(
    request: ImageUpscaleRequest,
    user_tier: Annotated[UserTier, Depends(get_current_user_tier)],
    user_id: str | None = None,
) -> ImagenResponse:
    """
    Upscale an image using Imagen 4.0 upscaling.
    
    Features:
    - Idempotency: Pass idempotency_key to prevent duplicate costs
    - Retry: Automatic retry with exponential backoff for 429/5xx errors
    
    Tier limits:
    - FREE: Not available
    - JIVE: 20/month
    - JIGGA: 50/month
    """
    limits = IMAGEN_LIMITS[user_tier]
    
    if limits["upscale"] == 0:
        raise HTTPException(
            status_code=403,
            detail="Image upscaling not available for your tier. Upgrade to JIVE or JIGGA."
        )
    
    imagen_request = ImagenRequest(
        prompt="upscale",
        operation=ImagenOperation.UPSCALE,
        source_image=request.source_image,
        upscale_factor=request.upscale_factor,
        idempotency_key=request.idempotency_key,
    )
    
    response = await imagen_service.upscale(
        request=imagen_request,
        user_id=user_id,
        user_tier=user_tier,
    )
    
    if not response.success:
        raise HTTPException(status_code=500, detail=response.error)
    
    return response


# ============================================================================
# Video Endpoints
# ============================================================================

@router.post("/videos/generate", response_model=VeoResponse)
async def generate_video(
    request: VideoGenerateRequest,
    user_tier: Annotated[UserTier, Depends(get_current_user_tier)],
    user_id: str | None = None,
) -> VeoResponse:
    """
    Start video generation using Veo 3.1. Returns immediately with job_id.
    Poll /videos/{job_id}/status for progress (job_id is a Vertex AI operation name with slashes).
    
    Features:
    - Idempotency: Pass idempotency_key to prevent duplicate costs
    - Retry: Automatic retry with exponential backoff for 429/5xx errors
    - Long-running: Returns job_id immediately, poll for completion
    
    Tier limits:
    - FREE: Not available
    - JIVE: 5 min/month
    - JIGGA: 20 min/month
    """
    limits = VEO_LIMITS[user_tier]
    
    # Check if user can generate videos
    if request.generate_audio and not limits["allow_audio"]:
        raise HTTPException(
            status_code=403,
            detail="Video+audio not available for your tier. Upgrade to JIVE or JIGGA."
        )
    
    if limits["video_minutes"] == 0:
        raise HTTPException(
            status_code=403,
            detail="Video generation not available for FREE tier. Upgrade to JIVE or JIGGA."
        )
    
    veo_request = VeoRequest(
        prompt=request.prompt,
        source_image=request.source_image,
        source_video=request.source_video,
        storage_uri=request.storage_uri,
        aspect_ratio=request.aspect_ratio,
        duration_seconds=request.duration_seconds,
        generate_audio=request.generate_audio,
        negative_prompt=request.negative_prompt,
        person_generation=request.person_generation,
        resolution=request.resolution,
        sample_count=request.sample_count,
        seed=request.seed,
        use_fast_model=request.use_fast_model,
        idempotency_key=request.idempotency_key,
    )
    
    response = await veo_service.generate(
        request=veo_request,
        user_id=user_id,
        user_tier=user_tier,
    )
    
    if not response.success:
        raise HTTPException(status_code=500, detail=response.error)
    
    return response


@router.get("/videos/{job_id:path}/status", response_model=VeoResponse)
async def get_video_status(job_id: str) -> VeoResponse:
    """
    Check status of a video generation job.
    
    The job_id is a Vertex AI operation name which contains slashes, e.g.:
    projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{uuid}
    
    Returns:
    - status: pending, running, completed, failed
    - progress_percent: 0-100 while running
    - video_url: GCS URL when completed
    """
    response = await veo_service.check_status(job_id)
    return response


@router.get("/videos/{job_id:path}/result", response_model=VeoResponse)
async def get_video_result(
    job_id: str,
    wait: bool = Query(default=False, description="Wait for completion"),
    timeout: int = Query(default=300, ge=30, le=600),
) -> VeoResponse:
    """
    Get video generation result.
    
    The job_id is a Vertex AI operation name which contains slashes, e.g.:
    projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{uuid}
    
    Args:
        job_id: Operation name from generate response
        wait: If true, wait for completion (up to timeout)
        timeout: Max wait time in seconds
    """
    if wait:
        response = await veo_service.wait_for_completion(
            job_id=job_id,
            timeout=float(timeout),
        )
    else:
        response = await veo_service.check_status(job_id)
    
    if response.status == VeoJobStatus.FAILED:
        raise HTTPException(status_code=500, detail=response.error)
    
    return response


# ============================================================================
# Quota Endpoint
# ============================================================================

@router.get("/quota", response_model=QuotaResponse)
async def get_quota(
    user_tier: Annotated[UserTier, Depends(get_current_user_tier)],
    user_id: str | None = None,
) -> QuotaResponse:
    """
    Get remaining media quota for current billing period.
    
    TODO: Implement actual usage tracking from database.
    Currently returns tier limits as placeholder.
    """
    imagen_limits = IMAGEN_LIMITS[user_tier]
    veo_limits = VEO_LIMITS[user_tier]
    
    # TODO: Subtract actual usage from database
    return QuotaResponse(
        tier=user_tier.value,
        images={
            "create": imagen_limits["create"],
            "edit": imagen_limits["edit"],
            "upscale": imagen_limits["upscale"],
        },
        video_minutes=float(veo_limits["video_minutes"]),
        allow_audio=veo_limits["allow_audio"],
    )


# ============================================================================
# Health Check
# ============================================================================

@router.get("/health")
async def media_health() -> dict[str, str]:
    """Health check for media services."""
    return {
        "status": "healthy",
        "imagen": "ready",
        "veo": "ready",
    }
