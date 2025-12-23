"""
Text-to-Speech API endpoint using Google Cloud TTS.

Uses service account authentication for secure API access.
WaveNet voices for quality at reasonable cost ($16/million chars).
1 million free chars/month for Neural voices.
"""
import os
import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.cloud import texttospeech
from google.oauth2 import service_account

router = APIRouter(prefix="/tts", tags=["tts"])

# Service account credentials path
CREDENTIALS_PATH = os.getenv(
    "GOOGLE_APPLICATION_CREDENTIALS",
    "/app/credentials/general-dev-480621-a3928a694851.json"
)

# Also check local dev path
LOCAL_CREDENTIALS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "credentials",
    "general-dev-480621-a3928a694851.json"
)

# Lazy-loaded client
_tts_client: texttospeech.TextToSpeechClient | None = None


def get_tts_client() -> texttospeech.TextToSpeechClient:
    """Get or create TTS client with service account auth."""
    global _tts_client
    
    if _tts_client is None:
        # Try multiple credential paths
        cred_path = None
        for path in [CREDENTIALS_PATH, LOCAL_CREDENTIALS_PATH]:
            if os.path.exists(path):
                cred_path = path
                break
        
        if cred_path:
            credentials = service_account.Credentials.from_service_account_file(
                cred_path
            )
            _tts_client = texttospeech.TextToSpeechClient(credentials=credentials)
        else:
            # Fall back to default credentials (ADC)
            _tts_client = texttospeech.TextToSpeechClient()
    
    return _tts_client


class TTSRequest(BaseModel):
    """TTS synthesis request."""
    text: str
    voice_name: str = "en-US-Wavenet-D"  # Male WaveNet voice
    language_code: str = "en-US"
    speaking_rate: float = 1.0
    pitch: float = 0.0


class TTSResponse(BaseModel):
    """TTS synthesis response."""
    audio_content: str  # Base64 encoded MP3
    duration_estimate: float  # Rough estimate in seconds


@router.post("/synthesize", response_model=TTSResponse)
async def synthesize_speech(request: TTSRequest) -> TTSResponse:
    """
    Synthesize speech from text using Google Cloud TTS.
    
    Returns base64-encoded MP3 audio.
    Limited to 5000 chars per request for cost control.
    """
    # Limit text length for cost control
    text = request.text[:5000]
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text provided")
    
    try:
        client = get_tts_client()
        
        # Build the synthesis request
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        voice = texttospeech.VoiceSelectionParams(
            language_code=request.language_code,
            name=request.voice_name,
        )
        
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=request.speaking_rate,
            pitch=request.pitch,
        )
        
        # Perform the synthesis
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
        
        # Encode audio to base64
        audio_base64 = base64.b64encode(response.audio_content).decode("utf-8")
        
        # Rough duration estimate: ~150 words per minute, ~5 chars per word
        # So about 750 chars per minute = 12.5 chars per second
        duration_estimate = len(text) / 12.5
        
        return TTSResponse(
            audio_content=audio_base64,
            duration_estimate=duration_estimate,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"TTS synthesis failed: {str(e)}"
        )


@router.get("/voices")
async def list_voices():
    """List available TTS voices."""
    try:
        client = get_tts_client()
        response = client.list_voices()
        
        # Filter to English WaveNet voices for simplicity
        voices = [
            {
                "name": voice.name,
                "language_codes": list(voice.language_codes),
                "gender": texttospeech.SsmlVoiceGender(voice.ssml_gender).name,
            }
            for voice in response.voices
            if "en-" in voice.name and "Wavenet" in voice.name
        ]
        
        return {"voices": voices}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list voices: {str(e)}"
        )
