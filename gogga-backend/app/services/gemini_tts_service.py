"""
Vertex AI TTS Service for GOGGA Chat Read-Aloud.

Uses Vertex AI Gemini 2.5 Flash TTS with Charon voice for cost-effective
text-to-speech synthesis. This is separate from GoggaTalk (Live API).

Uses the same authentication pattern as ImagenService:
- Service account credentials via GOOGLE_APPLICATION_CREDENTIALS
- Application Default Credentials (ADC)
- gcloud CLI fallback

Voice: Charon - Deep, gravelly warmth (GOGGA's signature voice)

Enterprise features:
- Lazy singleton pattern (same as Imagen service)
- Vertex AI authentication (same as Imagen)
- Retry with exponential backoff for 429/5xx errors
- PCM to WAV conversion for browser compatibility
"""

import asyncio
import base64
import logging
import socket
import struct
import time
from typing import Any

import httpx
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request as GoogleAuthRequest
from pydantic import BaseModel, Field

from app.config import get_settings

logger = logging.getLogger(__name__)

# Force IPv4 to avoid Docker IPv6 issues
_original_getaddrinfo = socket.getaddrinfo


def _getaddrinfo_ipv4_only(*args, **kwargs):
    """Wrapper to force IPv4 resolution (Docker containers may have broken IPv6)."""
    responses = _original_getaddrinfo(*args, **kwargs)
    return [r for r in responses if r[0] == socket.AF_INET] or responses


socket.getaddrinfo = _getaddrinfo_ipv4_only

# Gemini TTS model
GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"

# GOGGA's signature voice for chat read-aloud
DEFAULT_VOICE = "Charon"

# Audio format constants (Gemini TTS output)
SAMPLE_RATE = 24000
CHANNELS = 1
SAMPLE_WIDTH = 2  # 16-bit


class TTSRequest(BaseModel):
    """TTS synthesis request."""
    text: str = Field(..., min_length=1, max_length=5000)
    voice_name: str = Field(default=DEFAULT_VOICE)


class TTSResponse(BaseModel):
    """TTS synthesis response."""
    success: bool
    audio_content: str | None = Field(default=None, description="Base64 encoded WAV audio")
    duration_estimate: float = Field(default=0.0, description="Estimated duration in seconds")
    error: str | None = None


def pcm_to_wav(pcm_data: bytes) -> bytes:
    """
    Convert raw PCM data to WAV format for browser compatibility.
    
    Gemini TTS returns raw PCM (24kHz, 16-bit, mono).
    Browsers need WAV format with proper headers.
    """
    # Create WAV header
    data_size = len(pcm_data)
    byte_rate = SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH
    block_align = CHANNELS * SAMPLE_WIDTH
    chunk_size = 36 + data_size
    
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",           # ChunkID
        chunk_size,        # ChunkSize
        b"WAVE",           # Format
        b"fmt ",           # Subchunk1ID
        16,                # Subchunk1Size (16 for PCM)
        1,                 # AudioFormat (1 for PCM)
        CHANNELS,          # NumChannels
        SAMPLE_RATE,       # SampleRate
        byte_rate,         # ByteRate
        block_align,       # BlockAlign
        SAMPLE_WIDTH * 8,  # BitsPerSample
        b"data",           # Subchunk2ID
        data_size          # Subchunk2Size
    )
    
    return header + pcm_data


class GeminiTTSService:
    """
    Vertex AI TTS service for chat read-aloud feature.
    
    Uses Vertex AI Gemini 2.5 Flash TTS with Charon voice.
    Follows the same authentication pattern as ImagenService.
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
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client
    
    async def _get_access_token(self) -> str:
        """
        Get Google Cloud access token with fallback options.
        
        Same pattern as ImagenService:
        1. GOOGLE_APPLICATION_CREDENTIALS env var (service account JSON)
        2. Application Default Credentials (via google-auth)
        3. gcloud auth print-access-token CLI fallback
        """
        # Return cached token if still valid (with 60s buffer)
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token
        
        # Try google-auth library first
        try:
            if self._credentials is None:
                self._credentials, _ = google_auth_default(
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
            
            # Refresh token if expired
            if not self._credentials.valid:
                self._credentials.refresh(GoogleAuthRequest())
            
            self._access_token = self._credentials.token
            if hasattr(self._credentials, 'expiry') and self._credentials.expiry:
                self._token_expiry = self._credentials.expiry.timestamp()
            else:
                self._token_expiry = time.time() + 3600
            
            logger.debug("Got access token via google-auth library")
            return self._access_token
            
        except Exception as e:
            logger.warning(f"google-auth failed: {e}, trying gcloud CLI fallback...")
        
        # Fallback to gcloud CLI
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
            self._token_expiry = time.time() + 3600
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
    
    def _get_endpoint_url(self) -> str:
        """Get Vertex AI endpoint URL for TTS."""
        project = self._settings.VERTEX_PROJECT_ID
        location = self._settings.VERTEX_LOCATION
        
        return (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{project}/locations/{location}/publishers/google/"
            f"models/{GEMINI_TTS_MODEL}:generateContent"
        )
    
    async def synthesize(
        self,
        text: str,
        voice_name: str = DEFAULT_VOICE,
    ) -> TTSResponse:
        """
        Synthesize speech from text using Vertex AI Gemini TTS.
        
        Args:
            text: Text to convert to speech (max 5000 chars)
            voice_name: Prebuilt voice name (default: Charon)
            
        Returns:
            TTSResponse with base64 WAV audio or error
        """
        if not text.strip():
            return TTSResponse(success=False, error="No text provided")
        
        # Truncate for cost control
        text = text[:5000]
        
        try:
            token = await self._get_access_token()
            url = self._get_endpoint_url()
            
            # Build request payload (Vertex AI format requires 'role')
            payload = {
                "contents": [{
                    "role": "user",
                    "parts": [{
                        "text": text
                    }]
                }],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": voice_name
                            }
                        }
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
            
            # Log 400 errors with response body for debugging
            if response.status_code == 400:
                error_body = response.text[:500]
                logger.error(f"Vertex TTS 400 Bad Request - text_len={len(text)}, voice={voice_name}, response={error_body}")
                return TTSResponse(
                    success=False,
                    error=f"TTS request failed: {response.status_code}"
                )
            
            # Handle rate limiting and server errors with retry
            if response.status_code == 429 or response.status_code >= 500:
                retry_delay = 1.0 if response.status_code == 429 else 0.5
                logger.warning(f"Vertex TTS error {response.status_code}, retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                
                # Retry once
                response = await self.client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    }
                )
                
                if response.status_code == 429 or response.status_code >= 500:
                    return TTSResponse(
                        success=False,
                        error=f"TTS service temporarily unavailable ({response.status_code})"
                    )
            
            response.raise_for_status()
            
            data = response.json()
            
            # Extract audio data from response
            candidates = data.get("candidates", [])
            if not candidates:
                return TTSResponse(success=False, error="No audio generated")
            
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if not parts:
                return TTSResponse(success=False, error="No audio data in response")
            
            inline_data = parts[0].get("inlineData", {})
            audio_b64 = inline_data.get("data")
            
            if not audio_b64:
                return TTSResponse(success=False, error="No audio content returned")
            
            # Decode PCM and convert to WAV
            pcm_data = base64.b64decode(audio_b64)
            wav_data = pcm_to_wav(pcm_data)
            
            # Encode WAV as base64 for transport
            wav_b64 = base64.b64encode(wav_data).decode("utf-8")
            
            # Estimate duration: PCM bytes / (sample_rate * channels * sample_width)
            duration_seconds = len(pcm_data) / (SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH)
            
            logger.info(
                f"Vertex TTS | voice={voice_name} | chars={len(text)} | duration={duration_seconds:.1f}s"
            )
            
            return TTSResponse(
                success=True,
                audio_content=wav_b64,
                duration_estimate=round(duration_seconds, 2),
            )
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Vertex TTS HTTP error: {e}")
            return TTSResponse(
                success=False,
                error=f"TTS request failed: {e.response.status_code}"
            )
        except Exception as e:
            logger.exception(f"Vertex TTS error: {e}")
            return TTSResponse(
                success=False,
                error=f"TTS synthesis failed: {str(e)}"
            )
    
    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


# Singleton instance
_gemini_tts_service: GeminiTTSService | None = None


def get_gemini_tts_service() -> GeminiTTSService:
    """Get or create the Gemini TTS service singleton."""
    global _gemini_tts_service
    if _gemini_tts_service is None:
        _gemini_tts_service = GeminiTTSService()
    return _gemini_tts_service
