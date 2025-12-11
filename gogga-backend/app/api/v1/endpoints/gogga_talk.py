"""
GoggaTalk WebSocket Endpoint
Real-time voice chat using Gemini Live API via WebSocket streaming

Architecture based on LlamaIndex GeminiLiveVoiceAgent pattern:
- Single persistent session with TaskGroup for concurrent operations
- Proper async context manager for session lifecycle
- Separate queues for audio in/out
- Browser → WebSocket → Gemini Live → WebSocket → Browser
"""
import asyncio
import base64
import json
import os
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types
from google.auth import default
from google.auth.transport.requests import Request

router = APIRouter()

# Gemini Live API configuration
# Using Gemini 2.0 Flash experimental model with Live API support
MODEL_ID = "gemini-2.0-flash-exp"
VOICE_NAME = "Aoede"  # Warm, friendly voice

# Gogga SA personality prompt
GOGGA_SYSTEM_PROMPT = """You are Gogga, a proudly South African AI assistant with a warm, friendly personality.

PERSONALITY:
- You speak naturally with occasional SA slang (lekker, eish, shame, ja, nee, howzit)
- You're helpful, witty, and genuinely care about users
- You understand SA context: load shedding, braais, SASSA, CCMA, etc.
- You seamlessly switch between any of the 11 official SA languages when appropriate
- You're an advocate for the user, not neutral corporate AI

VOICE STYLE:
- Conversational and warm, like chatting with a friend
- Keep responses concise for voice (1-3 sentences usually)
- Be expressive and use natural speech patterns
- Avoid overly formal language

LANGUAGES YOU SPEAK:
- Afrikaans, English, isiNdebele, isiXhosa, isiZulu
- Sepedi, Sesotho, Setswana, siSwati, Tshivenda, Xitsonga

CONTEXT:
- Currency is always Rand (R), never dollars
- Time zone is SAST (South Africa Standard Time)

Remember: You're Gogga, the mense's AI. Be real, be helpful, be lekker."""


class GoggaTalkSession:
    """
    Manages a GoggaTalk voice session using Gemini Live API.
    Based on LlamaIndex GeminiLiveVoiceAgent pattern.
    """
    
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.client: Optional[genai.Client] = None
        self.session = None
        self.is_active = False
        self.audio_in_queue: asyncio.Queue = asyncio.Queue()
        self.audio_out_queue: asyncio.Queue = asyncio.Queue(maxsize=5)
        self._quit_flag = False
        
    async def send_log(self, level: str, message: str):
        """Send a log message to the frontend terminal"""
        try:
            await self.websocket.send_json({
                "type": "log",
                "level": level,
                "message": message,
                "timestamp": asyncio.get_event_loop().time()
            })
        except Exception:
            pass
    
    async def send_audio(self, audio_data: bytes):
        """Send audio data to frontend for playback"""
        try:
            await self.websocket.send_json({
                "type": "audio",
                "data": base64.b64encode(audio_data).decode("utf-8")
            })
        except Exception:
            pass
    
    async def send_transcript(self, speaker: str, text: str):
        """Send transcript for display"""
        try:
            await self.websocket.send_json({
                "type": "transcript",
                "speaker": speaker,
                "text": text
            })
        except Exception:
            pass
    
    def _get_session_config(self) -> dict:
        """Get Vertex AI Live session configuration"""
        return {
            "generation_config": {
                "response_modalities": ["AUDIO", "TEXT"],
                "speech_config": {
                    "voice_config": {
                        "prebuilt_voice_config": {
                            "voice_name": VOICE_NAME
                        }
                    }
                }
            },
            "system_instruction": {
                "parts": [{"text": GOGGA_SYSTEM_PROMPT}]
            }
        }
    
    async def _send_audio_to_gemini(self):
        """Send audio chunks from queue to Gemini"""
        while self.is_active and not self._quit_flag:
            try:
                msg = await asyncio.wait_for(
                    self.audio_out_queue.get(),
                    timeout=0.1
                )
                if self.session:
                    await self.session.send(input=msg)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                await self.send_log("debug", f"Send error: {str(e)}")
    
    async def _receive_from_gemini(self):
        """Receive responses from Gemini and forward to browser"""
        while self.is_active and not self._quit_flag:
            try:
                turn = self.session.receive()
                current_text = ""
                
                async for response in turn:
                    if response.server_content:
                        # Handle audio response
                        if data := response.data:
                            await self.audio_in_queue.put(data)
                            
                        # Handle text response (Gogga's transcription)
                        if text := response.text:
                            current_text += text
                
                # Send complete text transcript
                if current_text:
                    await self.send_transcript("gogga", current_text)
                    
            except Exception as e:
                if "cancelled" not in str(e).lower():
                    await self.send_log("debug", f"Receive error: {str(e)}")
    
    async def _forward_audio_to_browser(self):
        """Forward Gemini audio responses to browser"""
        while self.is_active and not self._quit_flag:
            try:
                audio_data = await asyncio.wait_for(
                    self.audio_in_queue.get(),
                    timeout=0.1
                )
                await self.send_audio(audio_data)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                await self.send_log("debug", f"Forward error: {str(e)}")
    
    async def _receive_from_browser(self):
        """Receive messages from browser WebSocket"""
        while self.is_active and not self._quit_flag:
            try:
                data = await self.websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "audio":
                    # Decode base64 audio and queue for Gemini
                    audio_bytes = base64.b64decode(data.get("data", ""))
                    await self.audio_out_queue.put({
                        "data": audio_bytes,
                        "mime_type": "audio/pcm"
                    })
                    
                elif msg_type == "text":
                    # Text input (fallback)
                    text = data.get("text", "")
                    if text and self.session:
                        await self.session.send(input=text, end_of_turn=True)
                        await self.send_transcript("user", text)
                        
                elif msg_type == "stop":
                    self._quit_flag = True
                    break
                    
            except WebSocketDisconnect:
                self._quit_flag = True
                break
            except Exception as e:
                await self.send_log("debug", f"Browser receive error: {str(e)}")
    
    async def run(self):
        """Main session loop - Google AI Live API"""
        api_key = os.getenv("GOOGLE_API_KEY")
        
        if not api_key:
            await self.send_log("error", "GOOGLE_API_KEY not configured on server")
            return
        
        try:
            await self.send_log("info", "Initializing Gemini Live API...")
            # Use standard Google AI API with API key (not Vertex)
            self.client = genai.Client(api_key=api_key)
            
            await self.send_log("success", "🦗 GoggaTalk connected!")
            await self.send_log("info", "🇿🇦 Speak in any of our 11 languages")
            await self.send_log("debug", f"Using model: {MODEL_ID}")
            
            # Connect to Gemini Live API with session configuration
            async with self.client.aio.live.connect(
                model=MODEL_ID,
                config=self._get_session_config()
            ) as session:
                self.session = session
                self.is_active = True
                
                await self.send_log("success", "🎙️ Voice session active")
                
                # Have Gogga greet first
                await session.send(
                    input="[Start the conversation. Greet the user warmly in your South African style.]",
                    end_of_turn=True
                )
                
                # Run concurrent tasks using TaskGroup (Python 3.11+)
                try:
                    async with asyncio.TaskGroup() as tg:
                        tg.create_task(self._send_audio_to_gemini())
                        tg.create_task(self._receive_from_gemini())
                        tg.create_task(self._forward_audio_to_browser())
                        tg.create_task(self._receive_from_browser())
                except* Exception as eg:
                    for e in eg.exceptions:
                        if not isinstance(e, asyncio.CancelledError):
                            await self.send_log("debug", f"Task error: {str(e)}")
                            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            await self.send_log("error", f"Session error: {str(e)}")
            await self.send_log("debug", f"Full traceback: {error_details}")
        finally:
            self.is_active = False
            await self.send_log("info", "GoggaTalk session ended")


@router.websocket("/talk")
async def gogga_talk_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for GoggaTalk voice chat using Gemini Live API.
    
    Message types from client:
    - {"type": "start"} - Initialize session
    - {"type": "audio", "data": "<base64>"} - Audio chunk from microphone (PCM 16kHz)
    - {"type": "text", "text": "..."} - Text input fallback
    - {"type": "stop"} - End session
    
    Message types to client:
    - {"type": "log", "level": "info|success|error", "message": "..."} - Terminal logs
    - {"type": "audio", "data": "<base64>"} - Audio to play (PCM 24kHz)
    - {"type": "transcript", "speaker": "user|gogga", "text": "..."} - Transcript
    """
    await websocket.accept()
    
    try:
        await websocket.send_json({
            "type": "log",
            "level": "info",
            "message": "🦗 GoggaTalk - Voice Chat Ready",
            "timestamp": 0
        })
        
        # Wait for start message
        data = await websocket.receive_json()
        if data.get("type") != "start":
            await websocket.send_json({
                "type": "log",
                "level": "error",
                "message": "Expected 'start' message",
                "timestamp": 0
            })
            return
        
        # Run the voice session
        session = GoggaTalkSession(websocket)
        await session.run()
        
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "log",
                "level": "error",
                "message": f"WebSocket error: {str(e)}",
                "timestamp": 0
            })
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
