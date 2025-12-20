# GoggaTalk Voice Chat Implementation

## Status: Updated with Screen Share + Unique Voice (Dec 2025)

## Model Update
- **Old**: `gemini-2.0-flash-live-001`
- **New**: `gemini-2.5-flash-native-audio-preview-12-2025`

## Reference Pattern
- See `IP/GoggaSpeech.md` for LlamaIndex GeminiLiveVoiceAgent pattern
- Key concepts: asyncio.TaskGroup, Queue-based audio flow, interrupt handling
- **TESTED EXAMPLES**: `gogga-frontend/public/goggatalk-live.html` and `goggatalk-standalone.html`

## Architecture
- Frontend: GoggaTalkButton (SA Flag) → GoggaTalkTerminal → useGoggaTalkDirect hook
- Backend: GoggaTalkAgent class with asyncio.TaskGroup for concurrent audio tasks
- Direct: Browser WebSocket → Gemini Live API
- Uses `GOOGLE_API_KEY` (backend) / `NEXT_PUBLIC_GOOGLE_API_KEY` (frontend)

## ⚠️ Gap Analysis: Camera/Video Support (Dec 2025)

### Current Implementation vs Reference

| Feature | Reference (`IP/GoggaSpeech.md`) | Current (`useGoggaTalkDirect.ts`) |
|---------|--------------------------------|-----------------------------------|
| Screen Share | ✅ `mss` library | ✅ `getDisplayMedia()` |
| Camera/Webcam | ✅ `cv2.VideoCapture(0)` | ❌ **MISSING** |
| Video Mode Toggle | ✅ camera / screen / none | ❌ screen only |
| Mobile Camera | ✅ front/back toggle | ❌ **MISSING** |
| Frame Rate | 2 FPS | 1 FPS |
| Resolution | 512px max | 1024px max |

### Missing Features to Implement

1. **Camera Support**
```typescript
// Add to useGoggaTalkDirect.ts
const startCamera = async (facingMode: 'user' | 'environment' = 'user') => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { max: 1024 }, height: { max: 768 } }
  });
  // Capture frames at 1 FPS, resize, send as JPEG
};
```

2. **Video Mode Toggle**
```typescript
type VideoMode = 'none' | 'camera' | 'screen';
const [videoMode, setVideoMode] = useState<VideoMode>('none');
```

3. **Mobile Camera Toggle**
```typescript
const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
const toggleCamera = () => setFacingMode(f => f === 'user' ? 'environment' : 'user');
```

### Current Strengths (Keep)
- ✅ Robust audio processing (noise gate 0.02 RMS, echo cancellation)
- ✅ Transcription buffering for user and Gogga
- ✅ Session resumption via `lastHandleRef`
- ✅ Context window compression (25k trigger tokens)
- ✅ VAD settings (PREFIX 0.25s, SUFFIX 0.5s, TIMEOUT 3s)

## Key Files

### Frontend
- `gogga-frontend/src/components/GoggaTalkButton.tsx` - SA Flag gradient button
- `gogga-frontend/src/components/GoggaTalkTerminal.tsx` - Full terminal UI with controls
- `gogga-frontend/src/hooks/useGoggaTalkDirect.ts` - Direct Gemini Live SDK hook

### Backend
- `gogga-backend/app/tools/gogga_talk.py` - Terminal CLI voice chat with PyAudio

### Tested Examples (AUTHORITATIVE REFERENCE)
- `gogga-frontend/public/goggatalk-live.html` - Minimal working implementation
- `gogga-frontend/public/goggatalk-standalone.html` - Full React implementation

### Documentation
- `docs/GoggaTalk.md` - Full architecture and flow documentation
- `IP/GoggaSpeech.md` - LlamaIndex pattern reference

## CRITICAL: Gemini Live API Config (Dec 2025)

### Frontend (TypeScript)
```typescript
const sessionPromise = ai.live.connect({
  model: 'gemini-2.5-flash-native-audio-preview-12-2025',
  callbacks: { onopen, onmessage, onclose, onerror },
  config: {
    responseModalities: [Modality.AUDIO],  // AUDIO ONLY
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
    systemInstruction: GOGGA_SYSTEM_PROMPT,  // Plain string
    inputAudioTranscription: {},   // Enable user STT
    outputAudioTranscription: {},  // Enable Gogga STT
  }
});
```

### Backend (Python)
```python
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

async with self.client.aio.live.connect(model=MODEL, config=config) as session:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(self._send_audio())
        tg.create_task(self.audio.capture_audio())
        tg.create_task(self._receive_responses())
        tg.create_task(self.audio.play_audio())

# CRITICAL: Use send_realtime_input for native audio
await self.session.send_realtime_input(audio=msg)
```

## Audio Sending Format

### Frontend
```typescript
// CORRECT - use 'media' key:
session.sendRealtimeInput({
  media: {
    data: base64Audio,
    mimeType: 'audio/pcm;rate=16000'
  }
});
```

### Backend
```python
# CORRECT - use audio= kwarg with send_realtime_input:
await self.session.send_realtime_input(audio={"data": data, "mime_type": "audio/pcm"})
```

## Audio Specs
- Input: 16kHz mono PCM16
- Output: 24kHz mono PCM16
- Encoding: Base64 over WebSocket

## Screen Share Support (Dec 2025)

### Critical: 2-Minute Limit for Audio+Video
Without `contextWindowCompression`, audio+video sessions disconnect after 2 minutes!

**Solution implemented:**
```typescript
contextWindowCompression: {
  slidingWindow: {},
  triggerTokens: 25000,  // ~80% of 32k context limit
},
```

### Frame Rate for Screen Share
- Captures at 1 FPS (1 frame per second)
- Sends as JPEG at 70% quality
- Max resolution: 1024px width (scaled)

### Available Voices
- **Charon** - Deep, gravelly warmth (GOGGA DEFAULT)
- **Kore** - Natural, professional
- **Puck** - Upbeat, energetic
- **Fenrir** - Serious, firm
- **Aoede** - Melodic, soft

## Echo Cancellation Warning ⚠️
The native audio model does NOT include built-in echo cancellation.
**Headphones recommended** to prevent feedback loops.

Frontend mitigations:
- `echoCancellation: true` in getUserMedia
- `noiseSuppression: true` in getUserMedia
- UI warning: "🎧 Headphones recommended"

## 11 SA Languages Supported
English, Afrikaans, isiZulu, isiXhosa, Sesotho, Setswana, Tshivenda, Xitsonga, siSwati, isiNdebele, Sepedi
