#!/usr/bin/env python3
"""
GoggaTalk - Terminal Voice Chat for Gogga

A terminal-based voice chat application using Gemini Live API.
Features:
- Gogga initiates the conversation first
- Live transcription: Gogga (GREEN), User (WHITE)
- Single Gogga voice (Aoede - warm, friendly)
- Real-time audio streaming
- SA personality integration
- Supports all 11 SA official languages

Usage:
    python gogga_talk.py [--tier jive|jigga]

Requirements:
    pip install google-genai pyaudio rich

Environment:
    GOOGLE_API_KEY - Your Gemini API key
"""

import asyncio
import logging
import os
import sys
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

try:
    import pyaudio
    from google import genai
    from rich.console import Console
    from rich.text import Text
    from rich.panel import Panel
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install google-genai pyaudio rich")
    sys.exit(1)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Audio settings (Gemini Live requirements)
FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000      # Input sample rate
RECEIVE_SAMPLE_RATE = 24000   # Output sample rate  
CHUNK_SIZE = 1024

# Gemini Live model
MODEL = "models/gemini-2.0-flash-exp"

# Gogga's voice - Aoede (warm, expressive, friendly)
# Available: Puck, Charon, Kore, Fenrir, Aoede
GOGGA_VOICE = "Aoede"

# Logging
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("gogga_talk")

# Rich console
console = Console()


class Tier(Enum):
    JIVE = "jive"
    JIGGA = "jigga"


@dataclass
class GoggaConfig:
    """Configuration for GoggaTalk."""
    tier: Tier = Tier.JIVE
    voice: str = GOGGA_VOICE
    show_transcription: bool = True


# =============================================================================
# HIGH QUALITY TEXT ART
# =============================================================================

GOGGA_BANNER = """
[bold white]
    ██████╗  ██████╗  ██████╗  ██████╗  █████╗ 
   ██╔════╝ ██╔═══██╗██╔════╝ ██╔════╝ ██╔══██╗
   ██║  ███╗██║   ██║██║  ███╗██║  ███╗███████║
   ██║   ██║██║   ██║██║   ██║██║   ██║██╔══██║
   ╚██████╔╝╚██████╔╝╚██████╔╝╚██████╔╝██║  ██║
    ╚═════╝  ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝
[/bold white]
[bold cyan]                    ████████╗ █████╗ ██╗     ██╗  ██╗
                    ╚══██╔══╝██╔══██╗██║     ██║ ██╔╝
                       ██║   ███████║██║     █████╔╝ 
                       ██║   ██╔══██║██║     ██╔═██╗ 
                       ██║   ██║  ██║███████╗██║  ██╗
                       ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝[/bold cyan]
"""

SA_FLAG_DIVIDER = """[bold green]▀[/bold green][bold yellow]▀[/bold yellow][bold red]▀[/bold red][bold white]▀[/bold white][bold blue]▀[/bold blue][bold black on white]▀[/bold black on white]""" * 10

LANGUAGES_BANNER = """
[dim]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/dim]

[bold green]  ██████╗ ██████╗ ███████╗ █████╗ ██╗  ██╗    ████████╗ ██████╗ [/bold green]
[bold yellow] ██╔════╝ ██╔══██╗██╔════╝██╔══██╗██║ ██╔╝    ╚══██╔══╝██╔═══██╗[/bold yellow]
[bold red]  ╚█████╗  ██████╔╝█████╗  ███████║█████╔╝        ██║   ██║   ██║[/bold red]
[bold white]  ╚═══██╗ ██╔═══╝ ██╔══╝  ██╔══██║██╔═██╗        ██║   ██║   ██║[/bold white]
[bold blue] ██████╔╝ ██║     ███████╗██║  ██║██║  ██╗       ██║   ╚██████╔╝[/bold blue]
[bold black on white] ╚═════╝  ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝       ╚═╝    ╚═════╝ [/bold black on white]

[bold green]          ███╗   ███╗███████╗    ██╗███╗   ██╗[/bold green]
[bold yellow]          ████╗ ████║██╔════╝    ██║████╗  ██║[/bold yellow]
[bold red]          ██╔████╔██║█████╗      ██║██╔██╗ ██║[/bold red]
[bold white]          ██║╚██╔╝██║██╔══╝      ██║██║╚██╗██║[/bold white]
[bold blue]          ██║ ╚═╝ ██║███████╗    ██║██║ ╚████║[/bold blue]
[bold black on white]          ╚═╝     ╚═╝╚══════╝    ╚═╝╚═╝  ╚═══╝[/bold black on white]

[dim]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/dim]

[bold]     🇿🇦  ANY OF OUR 11 OFFICIAL LANGUAGES  🇿🇦[/bold]

[dim italic]  Afrikaans • English • isiNdebele • isiXhosa • isiZulu
  Sepedi • Sesotho • Setswana • siSwati • Tshivenda • Xitsonga[/dim italic]
"""


# =============================================================================
# GOGGA SYSTEM PROMPT
# =============================================================================

GOGGA_SYSTEM_PROMPT = """You are Gogga, a proudly South African AI assistant with a warm, friendly personality.

IMPORTANT: You must INITIATE the conversation first! Greet the user warmly in a South African way.
Start with something like "Howzit! I'm Gogga, your South African AI assistant. What can I help you with today?"

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

Remember: You're Gogga, the mense's AI. Be real, be helpful, be lekker.
START THE CONVERSATION FIRST with a warm greeting!"""


# =============================================================================
# TERMINAL UI
# =============================================================================

class TerminalUI:
    """Rich terminal UI for GoggaTalk."""
    
    def __init__(self, config: GoggaConfig):
        self.config = config
        self.console = Console()
        
    def print_banner(self):
        """Print the GoggaTalk banner with SA flag colors."""
        self.console.print(GOGGA_BANNER)
        self.console.print(SA_FLAG_DIVIDER)
        self.console.print(LANGUAGES_BANNER)
        self.console.print()
        
    def print_status(self, status: str, style: str = "yellow"):
        """Print status update."""
        self.console.print(f"[{style}]● {status}[/{style}]")
        
    def print_gogga(self, text: str):
        """Print Gogga's speech in GREEN."""
        self.console.print(f"[bold green]🦗 GOGGA:[/bold green] [green]{text}[/green]")
        
    def print_user(self, text: str):
        """Print user's speech in WHITE."""
        self.console.print(f"[bold white]🎤 YOU:[/bold white] [white]{text}[/white]")
        
    def print_listening(self):
        """Print listening indicator."""
        self.console.print("[dim cyan]🎤 Listening... (speak now)[/dim cyan]")
        
    def print_gogga_speaking(self):
        """Print Gogga speaking indicator."""
        self.console.print("[dim green]🔊 Gogga is speaking...[/dim green]")
        
    def clear_line(self):
        """Clear current line."""
        print(" " * 80, end="\r")
        
    def print_help(self):
        """Print help information."""
        help_panel = Panel(
            "[bold]Controls:[/bold]\n"
            "  [green]q[/green] + Enter  →  Quit GoggaTalk\n"
            "  [green]Ctrl+C[/green]     →  Force quit\n\n"
            "[bold]Tips:[/bold]\n"
            "  • Speak naturally in any SA language\n"
            "  • Gogga will respond in your language\n"
            "  • Voice: Aoede (warm & friendly)",
            title="[bold cyan]🇿🇦 GoggaTalk Help[/bold cyan]",
            border_style="cyan"
        )
        self.console.print(help_panel)
        self.console.print()


# =============================================================================
# AUDIO INTERFACE  
# =============================================================================

class AudioInterface:
    """Handles audio input/output using PyAudio."""
    
    def __init__(self):
        self.pya = pyaudio.PyAudio()
        self.audio_in_queue: asyncio.Queue = asyncio.Queue()
        self.audio_out_queue: asyncio.Queue = asyncio.Queue(maxsize=5)
        self.input_stream: Optional[pyaudio.Stream] = None
        self.output_stream: Optional[pyaudio.Stream] = None
        self._running = False
        
    async def start(self):
        """Start audio streams."""
        self._running = True
        
        # Get default input device
        try:
            mic_info = self.pya.get_default_input_device_info()
            logger.info(f"Using microphone: {mic_info['name']}")
        except Exception as e:
            logger.error(f"No microphone found: {e}")
            raise RuntimeError("No microphone available")
            
        # Open input stream (microphone)
        self.input_stream = self.pya.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=SEND_SAMPLE_RATE,
            input=True,
            input_device_index=mic_info["index"],
            frames_per_buffer=CHUNK_SIZE,
        )
        
        # Open output stream (speakers)
        self.output_stream = self.pya.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=RECEIVE_SAMPLE_RATE,
            output=True,
        )
        
    async def stop(self):
        """Stop audio streams."""
        self._running = False
        if self.input_stream:
            self.input_stream.close()
        if self.output_stream:
            self.output_stream.close()
        self.pya.terminate()
        
    async def capture_audio(self):
        """Capture audio from microphone and queue it."""
        while self._running:
            try:
                data = await asyncio.to_thread(
                    self.input_stream.read, 
                    CHUNK_SIZE, 
                    exception_on_overflow=False
                )
                await self.audio_out_queue.put({
                    "data": data,
                    "mime_type": "audio/pcm"
                })
            except Exception as e:
                logger.error(f"Audio capture error: {e}")
                await asyncio.sleep(0.01)
                
    async def play_audio(self):
        """Play audio from queue through speakers."""
        while self._running:
            try:
                audio_data = await self.audio_in_queue.get()
                await asyncio.to_thread(self.output_stream.write, audio_data)
            except Exception as e:
                logger.error(f"Audio playback error: {e}")


# =============================================================================
# GOGGA TALK AGENT
# =============================================================================

class GoggaTalkAgent:
    """Main GoggaTalk voice agent."""
    
    def __init__(self, config: GoggaConfig):
        self.config = config
        self.ui = TerminalUI(config)
        self.audio = AudioInterface()
        self.client: Optional[genai.Client] = None
        self.session = None
        self._running = False
        self._quit_flag = False
        self._gogga_initiated = False
        
    async def initialize(self):
        """Initialize the Gemini client."""
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
            
        self.client = genai.Client(
            api_key=api_key,
            http_options={"api_version": "v1beta"}
        )
        self.ui.print_status("Connected to Gemini Live API", "green")
        
    def _get_session_config(self) -> Dict[str, Any]:
        """Get session configuration for Gemini Live."""
        return {
            "response_modalities": ["AUDIO", "TEXT"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {
                        "voice_name": self.config.voice
                    }
                }
            },
            "system_instruction": GOGGA_SYSTEM_PROMPT,
        }
        
    async def _initiate_conversation(self):
        """Have Gogga start the conversation first."""
        self.ui.print_status("Gogga is greeting you...", "green")
        # Send a trigger to make Gogga speak first
        await self.session.send(
            input="[SYSTEM: Start the conversation now. Greet the user warmly in your South African style.]",
            end_of_turn=True
        )
        self._gogga_initiated = True
        
    async def _send_audio(self):
        """Send audio to Gemini."""
        # Wait for Gogga to initiate first
        while not self._gogga_initiated:
            await asyncio.sleep(0.1)
            
        while self._running and not self._quit_flag:
            try:
                msg = await asyncio.wait_for(
                    self.audio.audio_out_queue.get(),
                    timeout=0.1
                )
                await self.session.send(input=msg)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Send audio error: {e}")
                
    async def _receive_responses(self):
        """Receive and process responses from Gemini."""
        while self._running and not self._quit_flag:
            try:
                turn = self.session.receive()
                current_text = ""
                
                async for response in turn:
                    if response.server_content:
                        # Handle audio response
                        if data := response.data:
                            self.audio.audio_in_queue.put_nowait(data)
                            
                        # Handle text response (Gogga's transcription) - GREEN
                        if text := response.text:
                            current_text += text
                            
                # Print complete Gogga response in GREEN
                if current_text:
                    self.ui.print_gogga(current_text)
                    
                # Handle user transcription (input_transcription) - WHITE
                if hasattr(response, 'input_transcription') and response.input_transcription:
                    user_text = response.input_transcription.text
                    if user_text:
                        self.ui.print_user(user_text)
                            
            except Exception as e:
                if "cancelled" not in str(e).lower():
                    logger.error(f"Receive error: {e}")
                    
    async def _input_loop(self):
        """Handle keyboard input for quit command."""
        while self._running and not self._quit_flag:
            try:
                text = await asyncio.to_thread(input, "")
                if text.lower() == "q":
                    self._quit_flag = True
                    self.ui.print_status("Shutting down...", "yellow")
                    break
            except EOFError:
                break
                
    async def run(self):
        """Main run loop."""
        try:
            # Print banner first
            self.ui.print_banner()
            
            # Initialize
            await self.initialize()
            await self.audio.start()
            
            self.ui.print_help()
            self.ui.print_status("Starting voice session...", "yellow")
            
            # Connect to Gemini Live
            async with self.client.aio.live.connect(
                model=MODEL,
                config=self._get_session_config()
            ) as session:
                self.session = session
                self._running = True
                
                self.ui.print_status("🟢 Connected!", "green")
                self.ui.console.print()
                
                # Have Gogga initiate the conversation
                await self._initiate_conversation()
                
                # Create task group for concurrent operations
                async with asyncio.TaskGroup() as tg:
                    input_task = tg.create_task(self._input_loop())
                    tg.create_task(self._send_audio())
                    tg.create_task(self.audio.capture_audio())
                    tg.create_task(self._receive_responses())
                    tg.create_task(self.audio.play_audio())
                    
                    # Wait for quit
                    await input_task
                    raise asyncio.CancelledError("User quit")
                    
        except asyncio.CancelledError:
            pass
        except ExceptionGroup as eg:
            for e in eg.exceptions:
                if not isinstance(e, asyncio.CancelledError):
                    logger.error(f"Error: {e}")
        finally:
            self._running = False
            await self.audio.stop()
            self.ui.console.print()
            self.ui.console.print("[bold green]🦗 Gogga:[/bold green] [green]Sala kahle! Totsiens! Hamba kahle! 👋[/green]")
            self.ui.console.print()


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="GoggaTalk - Terminal Voice Chat")
    parser.add_argument(
        "--tier", 
        choices=["jive", "jigga"], 
        default="jive",
        help="Subscription tier (default: jive)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )
    args = parser.parse_args()
    
    if args.debug:
        logging.getLogger("gogga_talk").setLevel(logging.DEBUG)
        
    config = GoggaConfig(
        tier=Tier(args.tier),
        voice=GOGGA_VOICE,
    )
    
    agent = GoggaTalkAgent(config)
    
    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(0)


if __name__ == "__main__":
    main()
