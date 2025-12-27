"""
Vertex AI Veo Service for GOGGA.

Provides video generation using Google's Veo 3.1 model.
Long-running operation with polling for completion.

Models:
- veo-3.1-generate-001 (standard quality, video+audio)
- veo-3.1-fast-generate-001 (faster, video only)

Enterprise features:
- Exponential backoff with jitter for 429/5xx errors
- Idempotency keys to prevent duplicate costs
- Circuit breaker for sustained failures
- Job persistence for reliable polling resumption
"""

import asyncio
import logging
import time
from enum import Enum
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field

from app.config import get_settings
from app.core.router import UserTier
from app.core.retry import (
    with_retry,
    veo_circuit,
    check_circuit,
    RetryableError,
)
from app.core.idempotency import (
    veo_idempotency,
    validate_idempotency_key,
)

logger = logging.getLogger(__name__)


class VeoOperation(str, Enum):
    """Veo operation types."""
    GENERATE = "generate"


class VeoRequest(BaseModel):
    """Request model for Veo video generation (matches official API spec)."""
    prompt: str = Field(..., min_length=1, max_length=2000)
    # Optional source for image-to-video or video extension
    source_image: str | None = Field(default=None, description="Base64 source image for img2vid")
    source_video: str | None = Field(default=None, description="Base64 source video for extension")
    # GCS storage URI for output
    storage_uri: str | None = Field(default=None, description="GCS URI like gs://bucket/path")
    # Generation parameters per official Veo 3.1 API
    aspect_ratio: Literal["16:9", "9:16"] = Field(default="16:9")
    duration_seconds: Literal[4, 6, 8] = Field(default=6, description="4, 6, or 8 seconds supported by Veo 3.1")
    generate_audio: bool = Field(default=False, description="Generate audio with video")
    negative_prompt: str | None = Field(default=None, max_length=1000)
    person_generation: Literal["allow_adult", "dont_allow"] = Field(default="allow_adult")
    resolution: Literal["720p", "1080p"] | None = Field(default=None, description="Video resolution")
    sample_count: int = Field(default=1, ge=1, le=4)
    seed: int | None = Field(default=None, description="Random seed for reproducibility")
    # Use fast model
    use_fast_model: bool = Field(default=False)
    # Idempotency key (UUID v4) to prevent duplicate costs
    idempotency_key: str | None = Field(default=None, description="UUID for request deduplication")


class VeoJobStatus(str, Enum):
    """Veo job status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class VeoResponse(BaseModel):
    """Response model for Veo operations."""
    success: bool
    job_id: str | None = None
    status: VeoJobStatus = VeoJobStatus.PENDING
    video_url: str | None = None  # GCS URL when complete
    video_data: str | None = None  # Base64 data if downloaded
    prompt: str
    duration_seconds: int = 0
    meta: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


# Tier-based limits (minutes per month)
VEO_LIMITS = {
    UserTier.FREE: {"video_minutes": 0, "allow_audio": False},  # Preview only
    UserTier.JIVE: {"video_minutes": 5, "allow_audio": True},
    UserTier.JIGGA: {"video_minutes": 20, "allow_audio": True},
}


class VeoService:
    """
    Vertex AI Veo service for video generation.
    
    Uses REST API with Google Cloud authentication.
    Long-running operations require polling.
    """
    
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._settings = get_settings()
        self._access_token: str | None = None
        self._token_expiry: float = 0
        # Track active jobs
        self._active_jobs: dict[str, dict[str, Any]] = {}
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Lazy initialization of HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=300.0)  # 5 min timeout for video
        return self._client
    
    async def _get_access_token(self) -> str:
        """Get Google Cloud access token using default credentials."""
        # Return cached token if still valid
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token
        
        try:
            proc = await asyncio.create_subprocess_exec(
                "gcloud", "auth", "print-access-token",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            
            if proc.returncode != 0:
                raise RuntimeError(f"Failed to get access token: {stderr.decode()}")
            
            self._access_token = stdout.decode().strip()
            self._token_expiry = time.time() + 3600
            return self._access_token
            
        except FileNotFoundError:
            raise RuntimeError("gcloud CLI not found. Install Google Cloud SDK.")
    
    def _get_endpoint_url(self, use_fast: bool = False) -> str:
        """Get Vertex AI endpoint URL for Veo."""
        project = self._settings.VERTEX_PROJECT_ID
        location = self._settings.VERTEX_LOCATION
        model = self._settings.VEO_FAST_MODEL if use_fast else self._settings.VEO_MODEL
        
        return (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{project}/locations/{location}/publishers/google/"
            f"models/{model}:predictLongRunning"
        )
    
    def _get_operation_url(self, operation_name: str) -> str:
        """Get URL for checking operation status via fetchPredictOperation."""
        # Extract model from operation name: projects/.../models/{model}/operations/...
        # The fetchPredictOperation endpoint is on the model, not the operation
        location = self._settings.VERTEX_LOCATION
        project = self._settings.VERTEX_PROJECT_ID
        
        # Parse model from operation name
        # Format: projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{uuid}
        parts = operation_name.split("/")
        try:
            models_idx = parts.index("models")
            model = parts[models_idx + 1]
        except (ValueError, IndexError):
            # Fallback to default model
            model = self._settings.VEO_MODEL
        
        return (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{project}/locations/{location}/publishers/google/"
            f"models/{model}:fetchPredictOperation"
        )
    
    async def generate(
        self,
        request: VeoRequest,
        user_id: str | None = None,
        user_tier: UserTier = UserTier.FREE,
    ) -> VeoResponse:
        """
        Start video generation. Returns immediately with job_id.
        Use check_status() to poll for completion.
        
        Features:
        - Idempotency: Duplicate requests return cached response
        - Retry: Automatic retry with exponential backoff for 429/5xx
        - Circuit breaker: Blocks requests after sustained failures
        - Job tracking: Stores job_id for reliable polling
        
        Args:
            request: Video generation request
            user_id: User identifier
            user_tier: User's subscription tier
            
        Returns:
            VeoResponse with job_id for tracking
        """
        # Check idempotency cache first
        idem_key = validate_idempotency_key(request.idempotency_key)
        if idem_key:
            cached = await veo_idempotency.get(idem_key)
            if cached:
                logger.info("Returning cached Veo response for key: %s", idem_key[:8])
                return cached
        
        # Check circuit breaker
        check_circuit(veo_circuit)
        
        logger.info(
            "Veo GENERATE | user=%s | tier=%s | duration=%ds | audio=%s | prompt=%s...",
            user_id or "anonymous",
            user_tier.value,
            request.duration_seconds,
            request.generate_audio,
            request.prompt[:50]
        )
        
        # Check tier limits
        limits = VEO_LIMITS[user_tier]
        if request.generate_audio and not limits["allow_audio"]:
            return VeoResponse(
                success=False,
                status=VeoJobStatus.FAILED,
                prompt=request.prompt,
                error="Video+audio not available for your tier. Upgrade to JIVE or JIGGA.",
            )
        if limits["video_minutes"] == 0:
            return VeoResponse(
                success=False,
                status=VeoJobStatus.FAILED,
                prompt=request.prompt,
                error="Video generation not available for FREE tier. Upgrade to JIVE or JIGGA.",
            )
        
        try:
            response = await self._generate_with_retry(request, user_id, user_tier)
            
            # Record success for circuit breaker
            veo_circuit.record_success()
            
            # Cache successful response (job_id start)
            if idem_key and response.success:
                await veo_idempotency.set(idem_key, response)
            
            return response
            
        except Exception as e:
            veo_circuit.record_failure()
            logger.exception("Veo generation failed: %s", str(e))
            return VeoResponse(
                success=False,
                status=VeoJobStatus.FAILED,
                prompt=request.prompt,
                error=str(e),
            )
    
    @with_retry(operation_name="veo_generate")
    async def _generate_with_retry(
        self,
        request: VeoRequest,
        user_id: str | None,
        user_tier: UserTier,
    ) -> VeoResponse:
        """Internal generate with retry decorator applied."""
        token = await self._get_access_token()
        url = self._get_endpoint_url(use_fast=request.use_fast_model)
        
        # Build instance per official Veo 3.1 API spec
        instance: dict[str, Any] = {
            "prompt": request.prompt,
        }
        
        # Image-to-video using referenceImages array
        # Format: referenceImages[{image: {bytesBase64Encoded, mimeType}, referenceType: "asset"}]
        # NOTE: Veo 3.1 does NOT support "style", only "asset" for subject reference images
        if request.source_image:
            # Detect MIME type from base64 header or default to image/png
            mime_type = "image/png"
            if request.source_image.startswith("/9j/"):
                mime_type = "image/jpeg"
            elif request.source_image.startswith("iVBOR"):
                mime_type = "image/png"
            elif request.source_image.startswith("R0lGOD"):
                mime_type = "image/gif"
            elif request.source_image.startswith("UklGR"):
                mime_type = "image/webp"
            
            instance["referenceImages"] = [{
                "image": {
                    "bytesBase64Encoded": request.source_image,
                    "mimeType": mime_type
                },
                "referenceType": "asset"  # Veo 3.1 only supports "asset", not "style"
            }]
        
        # Video extension
        if request.source_video:
            instance["video"] = {
                "bytesBase64Encoded": request.source_video,
                "mimeType": "video/mp4"
            }
        
        # Build parameters per official API spec
        parameters: dict[str, Any] = {
            "aspectRatio": request.aspect_ratio,
            "durationSeconds": request.duration_seconds,
            "sampleCount": request.sample_count,
            "personGeneration": request.person_generation,
        }
        
        # Optional parameters
        if request.storage_uri:
            parameters["storageUri"] = request.storage_uri
        
        if request.generate_audio:
            parameters["generateAudio"] = True
        
        if request.negative_prompt:
            parameters["negativePrompt"] = request.negative_prompt
        
        if request.resolution:
            parameters["resolution"] = request.resolution
        
        if request.seed is not None:
            parameters["seed"] = request.seed
        
        payload = {
            "instances": [instance],
            "parameters": parameters
        }
        
        response = await self.client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
        )
        
        # Convert HTTP errors to retryable/non-retryable
        if response.status_code == 429 or response.status_code >= 500:
            raise RetryableError(
                f"API error: {response.status_code}",
                status_code=response.status_code,
            )
        
        # Log detailed error for 400 Bad Request
        if response.status_code == 400:
            error_body = response.text[:1000]  # Truncate to avoid log flooding
            logger.error("Veo 400 Bad Request - Response: %s", error_body)
            
        response.raise_for_status()
        
        data = response.json()
        operation_name = data.get("name")
        
        if not operation_name:
            return VeoResponse(
                success=False,
                status=VeoJobStatus.FAILED,
                prompt=request.prompt,
                error="No operation ID returned from API",
            )
        
        # Calculate cost estimate based on audio
        if request.generate_audio:
            cost_per_sec = self._settings.COST_VEO_VIDEO_AUDIO
        else:
            cost_per_sec = self._settings.COST_VEO_VIDEO_ONLY
        
        estimated_cost = cost_per_sec * request.duration_seconds
        
        # Determine which model was used
        model_used = self._settings.VEO_FAST_MODEL if request.use_fast_model else self._settings.VEO_MODEL
        
        # Track job (persists job_id for resumability)
        job_info = {
            "operation_name": operation_name,
            "user_id": user_id,
            "user_tier": user_tier.value,
            "prompt": request.prompt,
            "duration_seconds": request.duration_seconds,
            "generate_audio": request.generate_audio,
            "started_at": time.time(),
            "estimated_cost_usd": estimated_cost,
            "idempotency_key": request.idempotency_key,
        }
        self._active_jobs[operation_name] = job_info
        
        logger.info("Veo job started: %s", operation_name)
        
        return VeoResponse(
            success=True,
            job_id=operation_name,
            status=VeoJobStatus.PENDING,
            prompt=request.prompt,
            duration_seconds=request.duration_seconds,
            meta={
                "tier": user_tier.value,
                "model": model_used,
                "generate_audio": request.generate_audio,
                "estimated_cost_usd": estimated_cost,
                "estimated_cost_zar": estimated_cost * self._settings.ZAR_USD_RATE,
            }
        )
    
    async def check_status(self, job_id: str) -> VeoResponse:
        """
        Check status of a video generation job.
        
        Uses the fetchPredictOperation endpoint (POST with operationName in body)
        as required by Vertex AI Veo API.
        
        Args:
            job_id: The operation name returned from generate()
            
        Returns:
            VeoResponse with current status and video_url if complete
        """
        job_info = self._active_jobs.get(job_id, {})
        
        try:
            token = await self._get_access_token()
            url = self._get_operation_url(job_id)
            
            # Veo requires POST with operationName in body, not GET
            response = await self.client.post(
                url,
                json={"operationName": job_id},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                }
            )
            response.raise_for_status()
            
            data = response.json()
            
            # Check if done
            if data.get("done"):
                # Check for error
                if "error" in data:
                    error = data["error"]
                    logger.error("Veo job failed: %s", error.get("message", "Unknown error"))
                    
                    # Clean up tracking
                    self._active_jobs.pop(job_id, None)
                    
                    return VeoResponse(
                        success=False,
                        job_id=job_id,
                        status=VeoJobStatus.FAILED,
                        prompt=job_info.get("prompt", ""),
                        error=error.get("message", "Video generation failed"),
                    )
                
                # Success - get video URL
                # fetchPredictOperation can return video in multiple formats:
                # - response.videos[].gcsUri (Veo 3.x format)
                # - response.videos[].bytesBase64Encoded (Veo 3.x inline format)
                # - response.predictions[].videoUri (legacy format)
                # - response.predictions[].storageUri (alternative format)
                result = data.get("response", {})
                
                video_url = None
                video_data = None
                
                # Try Veo 3.x format first: response.videos[]
                videos = result.get("videos", [])
                if videos and isinstance(videos, list):
                    first_video = videos[0]
                    # Check for inline base64 data (common with generateVideoResponse)
                    if first_video.get("bytesBase64Encoded"):
                        video_data = first_video["bytesBase64Encoded"]
                        mime_type = first_video.get("mimeType", "video/mp4")
                        logger.info("Video returned as inline base64 (%d bytes, %s)", len(video_data), mime_type)
                    else:
                        # Check for GCS URI
                        video_url = first_video.get("gcsUri") or first_video.get("storageUri")
                
                # Fallback to legacy format: response.predictions[].videoUri
                if not video_url and not video_data:
                    predictions = result.get("predictions", [])
                    if predictions and isinstance(predictions, list):
                        video_url = (
                            predictions[0].get("videoUri") or 
                            predictions[0].get("storageUri") or
                            predictions[0].get("gcsUri")
                        )
                
                # Final fallback: direct storageUri on response
                if not video_url and not video_data:
                    video_url = result.get("storageUri") or result.get("videoUri")
                
                # Check if we have video data (inline base64) or video URL (GCS)
                if video_url or video_data:
                    logger.info("Veo job completed: %s", job_id)
                    
                    # Calculate actual cost
                    duration = job_info.get("duration_seconds", 0)
                    has_audio = job_info.get("generate_audio", False)
                    if has_audio:
                        cost = self._settings.COST_VEO_VIDEO_AUDIO * duration
                    else:
                        cost = self._settings.COST_VEO_VIDEO_ONLY * duration
                    
                    # If we have a GCS URL, try to download or generate signed URL
                    signed_url = None
                    if video_url and not video_data:
                        try:
                            from app.services.gcs_service import gcs_service
                            # Try to generate signed URL for direct browser access
                            signed_url = await gcs_service.generate_signed_url(video_url, expiry_hours=24)
                            if not signed_url:
                                # Fallback: download as base64
                                video_data = await gcs_service.download_as_base64(video_url)
                        except Exception as e:
                            logger.warning("Could not process GCS video: %s", e)
                    
                    # Clean up tracking
                    self._active_jobs.pop(job_id, None)
                    
                    return VeoResponse(
                        success=True,
                        job_id=job_id,
                        status=VeoJobStatus.COMPLETED,
                        video_url=signed_url or video_url,  # Prefer signed URL
                        video_data=video_data,
                        prompt=job_info.get("prompt", ""),
                        duration_seconds=duration,
                        meta={
                            "tier": job_info.get("user_tier", "unknown"),
                            "model": self._settings.VEO_MODEL,
                            "generate_audio": has_audio,
                            "cost_usd": cost,
                            "cost_zar": cost * self._settings.ZAR_USD_RATE,
                            "elapsed_seconds": time.time() - job_info.get("started_at", time.time()),
                            "gcs_uri": video_url,  # Original GCS URI
                        }
                    )
                else:
                    logger.error("No video data in completed response: %s", list(result.keys()))
                    return VeoResponse(
                        success=False,
                        job_id=job_id,
                        status=VeoJobStatus.FAILED,
                        prompt=job_info.get("prompt", ""),
                        error="No video URL or data in response",
                    )
            
            # Still running
            metadata = data.get("metadata", {})
            progress = metadata.get("progressPercent", 0)
            
            return VeoResponse(
                success=True,
                job_id=job_id,
                status=VeoJobStatus.RUNNING,
                prompt=job_info.get("prompt", ""),
                duration_seconds=job_info.get("duration_seconds", 0),
                meta={
                    "progress_percent": progress,
                    "elapsed_seconds": time.time() - job_info.get("started_at", time.time()),
                }
            )
            
        except httpx.HTTPStatusError as e:
            logger.error("Veo status check error: %s", e.response.text[:200])
            return VeoResponse(
                success=False,
                job_id=job_id,
                status=VeoJobStatus.FAILED,
                prompt=job_info.get("prompt", ""),
                error=f"Status check failed: {e.response.status_code}",
            )
        except Exception as e:
            logger.exception("Veo status check failed: %s", str(e))
            return VeoResponse(
                success=False,
                job_id=job_id,
                status=VeoJobStatus.FAILED,
                prompt=job_info.get("prompt", ""),
                error=str(e),
            )
    
    async def wait_for_completion(
        self,
        job_id: str,
        poll_interval: float = 5.0,
        timeout: float = 600.0,
    ) -> VeoResponse:
        """
        Wait for a video generation job to complete.
        
        Args:
            job_id: The operation name
            poll_interval: Seconds between status checks
            timeout: Maximum wait time in seconds
            
        Returns:
            VeoResponse with final status
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            response = await self.check_status(job_id)
            
            if response.status in (VeoJobStatus.COMPLETED, VeoJobStatus.FAILED):
                return response
            
            await asyncio.sleep(poll_interval)
        
        return VeoResponse(
            success=False,
            job_id=job_id,
            status=VeoJobStatus.FAILED,
            prompt=self._active_jobs.get(job_id, {}).get("prompt", ""),
            error=f"Timeout after {timeout} seconds",
        )
    
    def get_active_jobs(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """Get list of active jobs, optionally filtered by user."""
        jobs = []
        for job_id, info in self._active_jobs.items():
            if user_id is None or info.get("user_id") == user_id:
                jobs.append({
                    "job_id": job_id,
                    **info
                })
        return jobs
    
    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


# Singleton instance
veo_service = VeoService()

__all__ = [
    "VeoService",
    "VeoRequest",
    "VeoResponse",
    "VeoJobStatus",
    "VeoAudioMode",
    "VEO_LIMITS",
    "veo_service",
]
