"""
## Documentation
Quickstart: https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_LiveAPI.py

## Setup

To install the dependencies for this script, run:

```
pip install google-genai opencv-python pyaudio pillow mss
```
"""

import os
import asyncio
import base64
import io
import traceback

import cv2
import pyaudio
import PIL.Image
import mss

import argparse

from google import genai
from google.genai import types

FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025"

DEFAULT_MODE = "camera"

client = genai.Client(
    http_options={"api_version": "v1beta"},
    api_key=os.environ.get("GEMINI_API_KEY"),
)


CONFIG = types.LiveConnectConfig(
    response_modalities=[
        "AUDIO",
    ],
    media_resolution="MEDIA_RESOLUTION_MEDIUM",
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Zephyr")
        )
    ),
    context_window_compression=types.ContextWindowCompressionConfig(
        trigger_tokens=25600,
        sliding_window=types.SlidingWindow(target_tokens=12800),
    ),
)

pya = pyaudio.PyAudio()


class AudioLoop:
    def __init__(self, video_mode=DEFAULT_MODE):
        self.video_mode = video_mode

        self.audio_in_queue = None
        self.out_queue = None

        self.session = None

        self.send_text_task = None
        self.receive_audio_task = None
        self.play_audio_task = None

    async def send_text(self):
        while True:
            text = await asyncio.to_thread(
                input,
                "message > ",
            )
            if text.lower() == "q":
                break
            await self.session.send(input=text or ".", end_of_turn=True)

    def _get_frame(self, cap):
        # Read the frameq
        ret, frame = cap.read()
        # Check if the frame was read successfully
        if not ret:
            return None
        # Fix: Convert BGR to RGB color space
        # OpenCV captures in BGR but PIL expects RGB format
        # This prevents the blue tint in the video feed
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = PIL.Image.fromarray(frame_rgb)  # Now using RGB frame
        img.thumbnail([1024, 1024])

        image_io = io.BytesIO()
        img.save(image_io, format="jpeg")
        image_io.seek(0)

        mime_type = "image/jpeg"
        image_bytes = image_io.read()
        return {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}

    async def get_frames(self):
        # This takes about a second, and will block the whole program
        # causing the audio pipeline to overflow if you don't to_thread it.
        cap = await asyncio.to_thread(
            cv2.VideoCapture, 0
        )  # 0 represents the default camera

        while True:
            frame = await asyncio.to_thread(self._get_frame, cap)
            if frame is None:
                break

            await asyncio.sleep(1.0)

            await self.out_queue.put(frame)

        # Release the VideoCapture object
        cap.release()

    def _get_screen(self):
        sct = mss.mss()
        monitor = sct.monitors[0]

        i = sct.grab(monitor)

        mime_type = "image/jpeg"
        image_bytes = mss.tools.to_png(i.rgb, i.size)
        img = PIL.Image.open(io.BytesIO(image_bytes))

        image_io = io.BytesIO()
        img.save(image_io, format="jpeg")
        image_io.seek(0)

        image_bytes = image_io.read()
        return {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}

    async def get_screen(self):

        while True:
            frame = await asyncio.to_thread(self._get_screen)
            if frame is None:
                break

            await asyncio.sleep(1.0)

            await self.out_queue.put(frame)

    async def send_realtime(self):
        while True:
            msg = await self.out_queue.get()
            await self.session.send(input=msg)

    async def listen_audio(self):
        mic_info = pya.get_default_input_device_info()
        self.audio_stream = await asyncio.to_thread(
            pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=SEND_SAMPLE_RATE,
            input=True,
            input_device_index=mic_info["index"],
            frames_per_buffer=CHUNK_SIZE,
        )
        if __debug__:
            kwargs = {"exception_on_overflow": False}
        else:
            kwargs = {}
        while True:
            data = await asyncio.to_thread(self.audio_stream.read, CHUNK_SIZE, **kwargs)
            await self.out_queue.put({"data": data, "mime_type": "audio/pcm"})

    async def receive_audio(self):
        "Background task to reads from the websocket and write pcm chunks to the output queue"
        while True:
            turn = self.session.receive()
            async for response in turn:
                if data := response.data:
                    self.audio_in_queue.put_nowait(data)
                    continue
                if text := response.text:
                    print(text, end="")

            # If you interrupt the model, it sends a turn_complete.
            # For interruptions to work, we need to stop playback.
            # So empty out the audio queue because it may have loaded
            # much more audio than has played yet.
            while not self.audio_in_queue.empty():
                self.audio_in_queue.get_nowait()

    async def play_audio(self):
        stream = await asyncio.to_thread(
            pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=RECEIVE_SAMPLE_RATE,
            output=True,
        )
        while True:
            bytestream = await self.audio_in_queue.get()
            await asyncio.to_thread(stream.write, bytestream)

    async def run(self):
        try:
            async with (
                client.aio.live.connect(model=MODEL, config=CONFIG) as session,
                asyncio.TaskGroup() as tg,
            ):
                self.session = session

                self.audio_in_queue = asyncio.Queue()
                self.out_queue = asyncio.Queue(maxsize=5)

                send_text_task = tg.create_task(self.send_text())
                tg.create_task(self.send_realtime())
                tg.create_task(self.listen_audio())
                if self.video_mode == "camera":
                    tg.create_task(self.get_frames())
                elif self.video_mode == "screen":
                    tg.create_task(self.get_screen())

                tg.create_task(self.receive_audio())
                tg.create_task(self.play_audio())

                await send_text_task
                raise asyncio.CancelledError("User requested exit")

        except asyncio.CancelledError:
            pass
        except ExceptionGroup as EG:
            self.audio_stream.close()
            traceback.print_exception(EG)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        type=str,
        default=DEFAULT_MODE,
        help="pixels to stream from",
        choices=["camera", "screen", "none"],
    )
    args = parser.parse_args()
    main = AudioLoop(video_mode=args.mode)
    asyncio.run(main.run())
import React, { useState } from 'react';
import { useLiveAPI } from './hooks/useLiveAPI';
import { ConnectionState, DEFAULT_MODEL, PREBUILT_VOICES, VoiceName } from './types';
import { VideoProcessor } from './components/VideoProcessor';
import { AudioVisualizer } from './components/AudioVisualizer';
import { Mic, MicOff, Video, Monitor, X, Play, Loader2, Settings, Terminal } from 'lucide-react';

export default function App() {
  const [videoMode, setVideoMode] = useState<'camera' | 'screen' | 'none'>('none');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Puck');
  const [showLogs, setShowLogs] = useState(false);

  const systemInstruction = `You are Gogga, a unique, gender-neutral, and race-neutral AI entity from South Africa.

**LANGUAGE RULES:**
1. **Primary Language:** You MUST speak **English** as your base language, but always with a **strong, authentic South African accent**.
2. **Code Switching:** You naturally mix in words and phrases from the other 10 official South African languages (isiZulu, isiXhosa, Afrikaans, Sepedi, Setswana, Sesotho, Xitsonga, siSwati, Tshivenda, isiNdebele) for flavor. 
   - Use slang like: 'howzit', 'lekker', 'yebo', 'shame', 'eish', 'sharp sharp', 'now now'.
3. **Prohibition:** Do NOT speak French, Spanish, or any language that is not South African, unless the user specifically asks you to translate something.

**PERSONALITY & VOICE:**
- **Pitch:** Speak with a **higher-pitched, lighter, and youthful tone**. Do not use a deep or low voice.
- **Dynamics:** Your voice must be lively, energetic, and expressive—never monotonic.
- You are helpful, witty, and have a vibrant personality.
- You can see what the user shows you via camera or screen share.
- Keep your responses concise and conversational.`;

  const { 
    connectionState, 
    connect, 
    disconnect, 
    error, 
    volume, 
    sendVideoFrame 
  } = useLiveAPI({
    model: DEFAULT_MODEL,
    voice: selectedVoice,
    systemInstruction: systemInstruction
  });

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const toggleVideo = () => {
    setVideoMode(prev => prev === 'camera' ? 'none' : 'camera');
  };

  const toggleScreen = () => {
    setVideoMode(prev => prev === 'screen' ? 'none' : 'screen');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 w-full max-w-5xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-[1px] rounded-lg">
                <div className="bg-slate-950 p-2 rounded-lg">
                  <Terminal size={24} className="text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-yellow-400">
                  Gogga AI
                </h1>
                <p className="text-slate-400 text-sm">Your South African Multimodal Assistant</p>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                 isConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                 isConnecting ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                 <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : 
                    isConnecting ? 'bg-yellow-500 animate-bounce' : 'bg-slate-500'
                 }`} />
                 {connectionState}
              </div>
           </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
           
           {/* Left: Video Preview */}
           <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden relative shadow-2xl">
              {videoMode !== 'none' ? (
                <VideoProcessor 
                  active={isConnected} 
                  mode={videoMode} 
                  onFrame={sendVideoFrame}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                   <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                     <Video size={32} className="opacity-50" />
                   </div>
                   <p>Camera is off</p>
                </div>
              )}
              
              {/* Overlay Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 p-3 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl">
                 <button 
                   onClick={toggleVideo}
                   className={`p-3 rounded-xl transition-all ${
                     videoMode === 'camera' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                   }`}
                   title="Toggle Camera"
                 >
                   {videoMode === 'camera' ? <Video size={20} /> : <div className="relative"><Video size={20} /><div className="absolute top-0 right-0 w-full h-0.5 bg-red-500 rotate-45 transform origin-center translate-y-2.5"></div></div>}
                 </button>
                 
                 <button 
                   onClick={toggleScreen}
                   className={`p-3 rounded-xl transition-all ${
                     videoMode === 'screen' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                   }`}
                   title="Share Screen"
                 >
                   <Monitor size={20} />
                 </button>
                 
                 <div className="w-px h-8 bg-slate-800 mx-2" />

                 <button
                   onClick={handleConnect}
                   disabled={isConnecting}
                   className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                     isConnected 
                      ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50' 
                      : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
                   }`}
                 >
                   {isConnecting ? (
                     <Loader2 size={20} className="animate-spin" />
                   ) : isConnected ? (
                     <>
                       <X size={20} /> End Session
                     </>
                   ) : (
                     <>
                       <Play size={20} fill="currentColor" /> Start Live
                     </>
                   )}
                 </button>
              </div>
           </div>

           {/* Right: Audio & Settings */}
           <div className="flex flex-col gap-6">
              
              {/* Visualizer Card */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center h-1/2 relative shadow-lg">
                <h3 className="absolute top-4 left-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Audio Stream</h3>
                <AudioVisualizer 
                  inputVolume={volume.input} 
                  outputVolume={volume.output} 
                  isActive={isConnected}
                />
                <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
                  <Mic size={12} className={isConnected ? "text-emerald-500" : ""} />
                  {isConnected ? "Microphone Active" : "Microphone Idle"}
                </div>
              </div>

              {/* Settings Card */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex-1 shadow-lg flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <Settings size={16} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-300">Configuration</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 font-medium ml-1">Voice Personality</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PREBUILT_VOICES.map(voice => (
                        <button
                          key={voice}
                          onClick={() => setSelectedVoice(voice)}
                          disabled={isConnected}
                          className={`text-xs py-2 rounded-lg border transition-all ${
                            selectedVoice === voice 
                              ? 'bg-slate-800 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]' 
                              : 'border-slate-800 text-slate-400 hover:bg-slate-800/50'
                          } ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {voice}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-auto bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs">
                    Error: {error}
                  </div>
                )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}