"""
Vertex AI Imagen Service for GOGGA.

Provides image generation, editing, and upscaling using Google's Imagen models.
Tier-based access with usage tracking.

Models:
- Imagen 3.0: Text-to-image generation and editing
- Imagen 2 (imagegeneration@006): Upscaling (Imagen 4 not yet GA)

Enterprise features:
- Exponential backoff with jitter for 429/5xx errors
- Idempotency keys to prevent duplicate costs
- Circuit breaker for sustained failures
- Tier-based watermarking (FREE tier only)
"""

import asyncio
import base64
import logging
import time
from enum import Enum
from typing import Any

import httpx
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request as GoogleAuthRequest
from pydantic import BaseModel, Field

from app.config import get_settings
from app.core.router import UserTier
from app.core.retry import (
    with_retry,
    imagen_circuit,
    check_circuit,
    RetryableError,
)
from app.core.idempotency import (
    imagen_idempotency,
    validate_idempotency_key,
)

logger = logging.getLogger(__name__)


class ImagenOperation(str, Enum):
    """Imagen operation types."""
    CREATE = "create"
    EDIT = "edit"
    UPSCALE = "upscale"


class ImagenRequest(BaseModel):
    """Request model for Imagen operations."""
    prompt: str = Field(..., min_length=1, max_length=2000)
    operation: ImagenOperation = ImagenOperation.CREATE
    # For edit operations (referenceImages pattern)
    source_image: str | None = Field(default=None, description="Base64 source image for editing")
    mask_image: str | None = Field(default=None, description="Base64 mask image for inpainting")
    edit_mode: str = Field(default="EDIT_MODE_INPAINT_INSERTION", description="Edit mode for mask editing")
    # Generation parameters
    aspect_ratio: str = Field(default="1:1", pattern=r"^\d+:\d+$")
    negative_prompt: str | None = None
    sample_count: int = Field(default=1, ge=1, le=4)
    person_generation: str = Field(default="allow_adult")
    safety_setting: str = Field(default="block_medium_and_above")
    # Upscale parameters (x2, x3, x4)
    upscale_factor: str = Field(default="x2", pattern=r"^x[234]$")
    # Idempotency key (UUID v4) to prevent duplicate costs
    idempotency_key: str | None = Field(default=None, description="UUID for request deduplication")


class ImagenResponse(BaseModel):
    """Response model for Imagen operations."""
    success: bool
    operation: ImagenOperation
    images: list[str] = Field(default_factory=list, description="Base64-encoded images")
    prompt: str
    meta: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


# Tier-based limits
IMAGEN_LIMITS = {
    UserTier.FREE: {"create": 1, "edit": 0, "upscale": 0},  # 1 preview/day
    UserTier.JIVE: {"create": 50, "edit": 20, "upscale": 20},
    UserTier.JIGGA: {"create": 200, "edit": 100, "upscale": 50},
}


class ImagenService:
    """
    Vertex AI Imagen service for image generation, editing, and upscaling.
    
    Uses REST API with Google Cloud authentication.
    """
    
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._settings = get_settings()
        self._access_token: str | None = None
        self._token_expiry: float = 0
        self._credentials = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Lazy initialization of HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=180.0)
        return self._client
    
    async def _get_access_token(self) -> str:
        """
        Get Google Cloud access token with fallback options.
        
        Priority:
        1. GOOGLE_APPLICATION_CREDENTIALS env var (service account JSON)
        2. Application Default Credentials (via google-auth)
        3. gcloud auth print-access-token CLI fallback
        """
        # Return cached token if still valid (with 60s buffer)
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token
        
        # Try google-auth library first (handles ADC, service accounts, workload identity)
        try:
            if self._credentials is None:
                self._credentials, _ = google_auth_default(
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
            
            # Refresh token if expired
            if not self._credentials.valid:
                self._credentials.refresh(GoogleAuthRequest())
            
            self._access_token = self._credentials.token
            # Set expiry based on credential's expiry or default to 1 hour
            if hasattr(self._credentials, 'expiry') and self._credentials.expiry:
                self._token_expiry = self._credentials.expiry.timestamp()
            else:
                self._token_expiry = time.time() + 3600
            
            logger.debug("Got access token via google-auth library")
            return self._access_token
            
        except Exception as e:
            logger.warning(f"google-auth failed: {e}, trying gcloud CLI fallback...")
        
        # Fallback to gcloud CLI (works when user has done `gcloud auth login`)
        try:
            proc = await asyncio.create_subprocess_exec(
                "gcloud", "auth", "print-access-token",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            
            if proc.returncode != 0:
                raise RuntimeError(f"gcloud CLI failed: {stderr.decode()}")
            
            self._access_token = stdout.decode().strip()
            self._token_expiry = time.time() + 3600  # Tokens valid for 1 hour
            logger.debug("Got access token via gcloud CLI fallback")
            return self._access_token
            
        except FileNotFoundError:
            raise RuntimeError(
                "Failed to authenticate with Google Cloud. "
                "Either: 1) Set GOOGLE_APPLICATION_CREDENTIALS to a service account key, "
                "2) Run 'gcloud auth application-default login', or "
                "3) Install gcloud CLI and run 'gcloud auth login'"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to get Google Cloud access token: {e}")
    
    def _get_endpoint_url(self, operation: ImagenOperation) -> str:
        """Get Vertex AI endpoint URL for operation."""
        project = self._settings.VERTEX_PROJECT_ID
        location = self._settings.VERTEX_LOCATION
        
        if operation == ImagenOperation.CREATE:
            model = self._settings.IMAGEN_V3_MODEL
        elif operation == ImagenOperation.EDIT:
            model = self._settings.IMAGEN_V3_EDIT_MODEL
        else:  # UPSCALE
            model = self._settings.IMAGEN_V4_UPSCALE_MODEL
        
        return (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{project}/locations/{location}/publishers/google/"
            f"models/{model}:predict"
        )
    
    async def generate(
        self,
        request: ImagenRequest,
        user_id: str | None = None,
        user_tier: UserTier = UserTier.FREE,
    ) -> ImagenResponse:
        """
        Generate image(s) from text prompt using Imagen 3.0.
        
        Features:
        - Idempotency: Duplicate requests return cached response
        - Retry: Automatic retry with exponential backoff for 429/5xx
        - Circuit breaker: Blocks requests after sustained failures
        - Tier-based watermark: FREE tier gets SynthID watermark
        
        Args:
            request: Image generation request
            user_id: User identifier for tracking
            user_tier: User's subscription tier
            
        Returns:
            ImagenResponse with generated images
        """
        # Check idempotency cache first
        idem_key = validate_idempotency_key(request.idempotency_key)
        if idem_key:
            cached = await imagen_idempotency.get(idem_key)
            if cached:
                logger.info("Returning cached response for idempotency key: %s", idem_key[:8])
                return cached
        
        # Check circuit breaker
        check_circuit(imagen_circuit)
        
        logger.info(
            "Imagen CREATE | user=%s | tier=%s | prompt=%s...",
            user_id or "anonymous",
            user_tier.value,
            request.prompt[:50]
        )
        
        try:
            response = await self._generate_with_retry(request, user_tier)
            
            # Record success for circuit breaker
            imagen_circuit.record_success()
            
            # Cache successful response
            if idem_key and response.success:
                await imagen_idempotency.set(idem_key, response)
            
            return response
            
        except Exception as e:
            imagen_circuit.record_failure()
            logger.exception("Imagen generation failed: %s", str(e))
            return ImagenResponse(
                success=False,
                operation=ImagenOperation.CREATE,
                prompt=request.prompt,
                error=str(e),
            )
    
    @with_retry(operation_name="imagen_generate")
    async def _generate_with_retry(
        self,
        request: ImagenRequest,
        user_tier: UserTier,
    ) -> ImagenResponse:
        """Internal generate with retry decorator applied."""
        token = await self._get_access_token()
        url = self._get_endpoint_url(ImagenOperation.CREATE)
        
        # Tier-based watermark: FREE tier always gets SynthID watermark
        add_watermark = user_tier == UserTier.FREE
        
        # Match official Imagen 3.0 API spec
        payload = {
            "instances": [{
                "prompt": request.prompt,
            }],
            "parameters": {
                "sampleCount": request.sample_count,
                "aspectRatio": request.aspect_ratio,
                "safetySetting": request.safety_setting,
                "personGeneration": request.person_generation,
                "addWatermark": add_watermark,
            }
        }
        
        if request.negative_prompt:
            payload["parameters"]["negativePrompt"] = request.negative_prompt
        
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
        response.raise_for_status()
        
        data = response.json()
        predictions = data.get("predictions", [])
        
        images = []
        for pred in predictions:
            if "bytesBase64Encoded" in pred:
                images.append(pred["bytesBase64Encoded"])
        
        return ImagenResponse(
            success=True,
            operation=ImagenOperation.CREATE,
            images=images,
            prompt=request.prompt,
            meta={
                "tier": user_tier.value,
                "model": self._settings.IMAGEN_V3_MODEL,
                "aspect_ratio": request.aspect_ratio,
                "num_requested": request.sample_count,
                "num_generated": len(images),
                "has_watermark": user_tier == UserTier.FREE,
                "cost_usd": self._settings.COST_IMAGEN_V3_CREATE * len(images),
                "cost_zar": self._settings.COST_IMAGEN_V3_CREATE * len(images) * self._settings.ZAR_USD_RATE,
            }
        )
    
    async def edit(
        self,
        request: ImagenRequest,
        user_id: str | None = None,
        user_tier: UserTier = UserTier.FREE,
    ) -> ImagenResponse:
        """
        Edit an existing image using Imagen 3.0 with mask-based editing.
        
        Supported edit modes:
        - EDIT_MODE_INPAINT_INSERTION: Add new elements to masked areas
        - EDIT_MODE_INPAINT_REMOVAL: Remove objects from masked areas
        - EDIT_MODE_OUTPAINT: Extend image canvas (for aspect ratio changes)
        - EDIT_MODE_BGSWAP: Replace background
        
        Features:
        - Idempotency: Duplicate requests return cached response
        - Retry: Automatic retry with exponential backoff for 429/5xx
        - Circuit breaker: Blocks requests after sustained failures
        
        Args:
            request: Edit request with source_image, mask_image, and prompt
            user_id: User identifier
            user_tier: User's subscription tier
            
        Returns:
            ImagenResponse with edited images
        """
        if not request.source_image:
            return ImagenResponse(
                success=False,
                operation=ImagenOperation.EDIT,
                prompt=request.prompt,
                error="source_image is required for edit operation",
            )
        
        # Check idempotency cache first
        idem_key = validate_idempotency_key(request.idempotency_key)
        if idem_key:
            cached = await imagen_idempotency.get(idem_key)
            if cached:
                logger.info("Returning cached edit response for key: %s", idem_key[:8])
                return cached
        
        # Check circuit breaker
        check_circuit(imagen_circuit)
        
        logger.info(
            "Imagen EDIT | user=%s | tier=%s | mode=%s | prompt=%s...",
            user_id or "anonymous",
            user_tier.value,
            request.edit_mode,
            request.prompt[:50]
        )
        
        try:
            response = await self._edit_with_retry(request, user_tier)
            
            imagen_circuit.record_success()
            
            if idem_key and response.success:
                await imagen_idempotency.set(idem_key, response)
            
            return response
            
        except Exception as e:
            imagen_circuit.record_failure()
            logger.exception("Imagen edit failed: %s", str(e))
            return ImagenResponse(
                success=False,
                operation=ImagenOperation.EDIT,
                prompt=request.prompt,
                error=str(e),
            )
    
    @with_retry(operation_name="imagen_edit")
    async def _edit_with_retry(
        self,
        request: ImagenRequest,
        user_tier: UserTier,
    ) -> ImagenResponse:
        """Internal edit with retry decorator applied."""
        token = await self._get_access_token()
        url = self._get_endpoint_url(ImagenOperation.EDIT)
        
        # Match official Imagen 3.0 capability API spec
        # Uses referenceImages array with REFERENCE_TYPE_RAW and REFERENCE_TYPE_MASK
        reference_images = [
            {
                "referenceType": "REFERENCE_TYPE_RAW",
                "referenceId": 1,
                "referenceImage": {"bytesBase64Encoded": request.source_image}
            }
        ]
        
        # Add mask for inpaint/outpaint operations
        if request.mask_image:
            reference_images.append({
                "referenceType": "REFERENCE_TYPE_MASK",
                "referenceId": 2,
                "referenceImage": {"bytesBase64Encoded": request.mask_image},
                "maskImageConfig": {
                    "maskMode": "MASK_MODE_USER_PROVIDED",
                    "dilation": 0.03  # Slight dilation for smoother edges
                }
            })
        
        payload = {
            "instances": [{
                "prompt": request.prompt,
                "referenceImages": reference_images,
            }],
            "parameters": {
                "editMode": request.edit_mode,
                "sampleCount": request.sample_count,
                "safetySetting": request.safety_setting,
                "personGeneration": request.person_generation,
            }
        }
        
        response = await self.client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
        )
        
        if response.status_code == 429 or response.status_code >= 500:
            raise RetryableError(
                f"API error: {response.status_code}",
                status_code=response.status_code,
            )
        response.raise_for_status()
        
        data = response.json()
        predictions = data.get("predictions", [])
        
        images = [p["bytesBase64Encoded"] for p in predictions if "bytesBase64Encoded" in p]
        
        return ImagenResponse(
            success=True,
            operation=ImagenOperation.EDIT,
            images=images,
            prompt=request.prompt,
            meta={
                "tier": user_tier.value,
                "model": self._settings.IMAGEN_V3_EDIT_MODEL,
                "edit_mode": request.edit_mode,
                "num_generated": len(images),
                "cost_usd": self._settings.COST_IMAGEN_V3_CREATE * len(images),
                "cost_zar": self._settings.COST_IMAGEN_V3_CREATE * len(images) * self._settings.ZAR_USD_RATE,
            }
        )
    
    async def upscale(
        self,
        request: ImagenRequest,
        user_id: str | None = None,
        user_tier: UserTier = UserTier.FREE,
    ) -> ImagenResponse:
        """
        Upscale an image using Imagen 4.0 upscaling.
        
        Features:
        - Idempotency: Duplicate requests return cached response
        - Retry: Automatic retry with exponential backoff for 429/5xx
        - Circuit breaker: Blocks requests after sustained failures
        - Tier-based pricing: JIGGA gets Imagen 4 quality
        
        Args:
            request: Upscale request with source_image
            user_id: User identifier
            user_tier: User's subscription tier (JIGGA gets v4 Ultra)
            
        Returns:
            ImagenResponse with upscaled image
        """
        if not request.source_image:
            return ImagenResponse(
                success=False,
                operation=ImagenOperation.UPSCALE,
                prompt=request.prompt,
                error="source_image is required for upscale operation",
            )
        
        # Check idempotency cache first
        idem_key = validate_idempotency_key(request.idempotency_key)
        if idem_key:
            cached = await imagen_idempotency.get(idem_key)
            if cached:
                logger.info("Returning cached upscale response for key: %s", idem_key[:8])
                return cached
        
        # Check circuit breaker
        check_circuit(imagen_circuit)
        
        logger.info(
            "Imagen UPSCALE | user=%s | tier=%s | factor=%s",
            user_id or "anonymous",
            user_tier.value,
            request.upscale_factor
        )
        
        try:
            response = await self._upscale_with_retry(request, user_tier)
            
            imagen_circuit.record_success()
            
            if idem_key and response.success:
                await imagen_idempotency.set(idem_key, response)
            
            return response
            
        except Exception as e:
            imagen_circuit.record_failure()
            logger.exception("Imagen upscale failed: %s", str(e))
            return ImagenResponse(
                success=False,
                operation=ImagenOperation.UPSCALE,
                prompt=request.prompt or "upscale",
                error=str(e),
            )
    
    @with_retry(operation_name="imagen_upscale")
    async def _upscale_with_retry(
        self,
        request: ImagenRequest,
        user_tier: UserTier,
    ) -> ImagenResponse:
        """Internal upscale with retry decorator applied."""
        token = await self._get_access_token()
        url = self._get_endpoint_url(ImagenOperation.UPSCALE)
        
        # Match official Imagen 4.0 upscale API spec
        payload = {
            "instances": [{
                "prompt": "Upscale the image",  # Required per API docs
                "image": {"bytesBase64Encoded": request.source_image},
            }],
            "parameters": {
                "mode": "upscale",
                "upscaleConfig": {
                    "upscaleFactor": request.upscale_factor  # "x2", "x3", or "x4"
                }
            }
        }
        
        response = await self.client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
        )
        
        if response.status_code == 429 or response.status_code >= 500:
            raise RetryableError(
                f"API error: {response.status_code}",
                status_code=response.status_code,
            )
        response.raise_for_status()
        
        data = response.json()
        predictions = data.get("predictions", [])
        
        images = [p["bytesBase64Encoded"] for p in predictions if "bytesBase64Encoded" in p]
        
        # JIGGA gets v4 pricing, JIVE gets v3 pricing
        cost = (
            self._settings.COST_IMAGEN_V4_UPSCALE 
            if user_tier == UserTier.JIGGA 
            else self._settings.COST_IMAGEN_V3_CREATE
        )
        
        return ImagenResponse(
            success=True,
            operation=ImagenOperation.UPSCALE,
            images=images,
            prompt=request.prompt or "upscale",
            meta={
                "tier": user_tier.value,
                "model": self._settings.IMAGEN_V4_UPSCALE_MODEL,
                "upscale_factor": request.upscale_factor,
                "cost_usd": cost,
                "cost_zar": cost * self._settings.ZAR_USD_RATE,
            }
        )
    
    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


# Singleton instance
imagen_service = ImagenService()

__all__ = [
    "ImagenService",
    "ImagenRequest",
    "ImagenResponse",
    "ImagenOperation",
    "IMAGEN_LIMITS",
    "imagen_service",
]
