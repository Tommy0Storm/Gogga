"""
Text-to-Speech API endpoint using Vertex AI Gemini TTS.

Uses Vertex AI with Charon voice for cost-effective chat read-aloud.
Same authentication as Imagen (service account / ADC).

Voice: Charon - Deep, gravelly warmth (GOGGA's signature voice)
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.gemini_tts_service import get_gemini_tts_service

router = APIRouter(prefix="/tts", tags=["tts"])
logger = logging.getLogger(__name__)

# Default voice - Charon for GOGGA identity
DEFAULT_VOICE = "Charon"


class TTSRequest(BaseModel):
    """TTS synthesis request."""
    text: str
    voice_name: str = DEFAULT_VOICE
    language_code: str = "en-US"  # Kept for API compat, not used by Gemini
    speaking_rate: float = 1.0    # Kept for API compat, not used by Gemini
    pitch: float = 0.0            # Kept for API compat, not used by Gemini


class TTSResponse(BaseModel):
    """TTS synthesis response."""
    audio_content: str  # Base64 encoded WAV
    duration_estimate: float  # Rough estimate in seconds


@router.post("/synthesize", response_model=TTSResponse)
async def synthesize_speech(request: TTSRequest) -> TTSResponse:
    """
    Synthesize speech from text using Vertex AI Gemini TTS with Charon voice.
    
    Returns base64-encoded WAV audio.
    Limited to 5000 chars per request for cost control.
    
    Uses same Vertex AI authentication as Imagen (service account / ADC).
    Text is chunked on the frontend for cancellation cost savings.
    """
    text = request.text[:5000]
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text provided")
    
    # Map old WaveNet voice names to Gemini voices for backward compatibility
    voice_name = request.voice_name
    if voice_name.startswith("en-") and "Wavenet" in voice_name:
        voice_name = DEFAULT_VOICE  # Use Charon for all legacy voice requests
    
    try:
        service = get_gemini_tts_service()
        result = await service.synthesize(text=text, voice_name=voice_name)
        
        if not result.success:
            raise HTTPException(
                status_code=500,
                detail=result.error or "TTS synthesis failed"
            )
        
        return TTSResponse(
            audio_content=result.audio_content or "",
            duration_estimate=result.duration_estimate,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"TTS synthesis error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"TTS synthesis failed: {str(e)}"
        )


@router.get("/voices")
async def list_voices():
    """
    List available Gemini TTS voices.
    
    Gemini TTS provides several prebuilt voices with distinct personalities.
    """
    # Gemini TTS prebuilt voices (from official docs)
    voices = [
        {"name": "Charon", "description": "Deep, gravelly warmth (GOGGA default)", "gender": "MALE"},
        {"name": "Kore", "description": "Natural, professional", "gender": "FEMALE"},
        {"name": "Puck", "description": "Upbeat, energetic", "gender": "NEUTRAL"},
        {"name": "Fenrir", "description": "Serious, firm", "gender": "MALE"},
        {"name": "Aoede", "description": "Melodic, soft", "gender": "FEMALE"},
        {"name": "Zephyr", "description": "Calm, balanced", "gender": "NEUTRAL"},
    ]
    
    return {"voices": voices, "default": "Charon"}
