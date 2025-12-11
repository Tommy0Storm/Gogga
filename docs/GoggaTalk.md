# GoggaTalk - Voice Chat System

## Overview

GoggaTalk is Gogga's voice chat feature that enables real-time spoken conversations in any of South Africa's 11 official languages using the Gemini Live API.

## Architecture

> **Reference Pattern**: See `IP/GoggaSpeech.md` for the authoritative LlamaIndex GeminiLiveVoiceAgent pattern that this implementation follows.

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ MediaRecorder   │    │ Web Audio API   │                     │
│  │ (16kHz PCM)     │    │ (24kHz playback)│                     │
│  │   Input         │    │    Output       │                     │
│  └────────┬────────┘    └────────▲────────┘                     │
│           │                      │                               │
│           ▼                      │                               │
│  ┌────────────────────────────────────────┐                     │
│  │     useGoggaTalkDirect Hook            │                     │
│  │  - Direct connection to Gemini Live    │                     │
│  │  - Real-time audio streaming           │                     │
│  │  - Input/Output transcription          │                     │
│  └────────────────┬───────────────────────┘                     │
│                   │                                              │
│  ┌────────────────▼───────────────────────┐                     │
│  │      GoggaTalkTerminal Component       │                     │
│  │  - Terminal UI with SA flag banner     │                     │
│  │  - Shows logs and transcripts          │                     │
│  │  - Connect/Mute controls               │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket (Gemini Live API)
                           │ wss://generativelanguage.googleapis.com
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GEMINI LIVE API                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Model: gemini-2.0-flash-live-001                               │
│  Voice: Aoede (warm, friendly)                                  │
│  Audio: 16kHz input, 24kHz output, PCM format                   │
│  Features: Real-time STT, TTS, bidirectional streaming          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Message Protocol

### Audio Data Format

| Direction | Sample Rate | Format | Encoding |
|-----------|-------------|--------|----------|
| Input (user → Gemini) | 16kHz | PCM Int16 | Base64 |
| Output (Gemini → user) | 24kHz | PCM Int16 | Base64 |

### Gemini Live API Events

| Event | Description |
|-------|-------------|
| `serverContent.modelTurn.parts[].inlineData` | Audio response data |
| `serverContent.inputTranscription.text` | User's speech-to-text |
| `serverContent.outputTranscription.text` | Gogga's speech-to-text |
| `serverContent.interrupted` | User interrupted Gogga |
| `serverContent.turnComplete` | Turn finished |

## Browser Requirements

GoggaTalk uses the Web Audio API and MediaRecorder which require:
- **Chrome** (recommended) - Full support
- **Edge** - Full support  
- **Safari** - Partial support (may need user gesture)
- **Firefox** - Full support
- **HTTPS required** for microphone access

## Language Support

Gemini Live API natively supports all 11 SA official languages:
- English, Afrikaans
- isiZulu, isiXhosa, isiNdebele
- Sepedi, Sesotho, Setswana
- siSwati, Tshivenda, Xitsonga

The model automatically detects and responds in the user's language.

## Files

### Frontend
- `src/hooks/useGoggaTalkDirect.ts` - Core hook for direct Gemini Live API connection
- `src/components/GoggaTalkTerminal.tsx` - Terminal UI component
- `src/components/GoggaTalkButton.tsx` - SA flag toggle button

### Tested Examples (AUTHORITATIVE REFERENCE)
- `public/goggatalk-live.html` - Minimal working implementation
- `public/goggatalk-standalone.html` - Full React implementation

### Reference
- `IP/GoggaSpeech.md` - Pattern from LlamaIndex GeminiLiveVoiceAgent

## Usage

1. Click the SA flag 🇿🇦 button to open GoggaTalk
2. Click **Connect** to establish Gemini Live connection
3. Speak naturally - microphone automatically streams
4. View transcripts in real-time
5. Click **Disconnect** when done

## Configuration

Required environment variable:
```bash
NEXT_PUBLIC_GOOGLE_API_KEY=your-gemini-api-key
```

## Gemini Live API Settings (from tested examples)

**CRITICAL**: These settings are from the tested working examples. Do NOT modify without testing!

```typescript
const sessionPromise = ai.live.connect({
  model: 'gemini-2.0-flash-live-001',
  callbacks: { onopen, onmessage, onclose, onerror },
  config: {
    responseModalities: [Modality.AUDIO],  // AUDIO ONLY - not [AUDIO, TEXT]!
    speechConfig: { 
      voiceConfig: { 
        prebuiltVoiceConfig: { voiceName: 'Aoede' } 
      } 
    },
    systemInstruction: GOGGA_SYSTEM_PROMPT,  // Plain string - NOT { parts: [{text}] }!
    inputAudioTranscription: {},   // Enable user STT
    outputAudioTranscription: {},  // Enable Gogga STT
  }
});
sessionPromiseRef.current = sessionPromise;
```

### CRITICAL: Audio Sending Format

```typescript
// CORRECT - use 'media' key:
sessionPromise.then(session => {
  session.sendRealtimeInput({
    media: {
      data: base64Audio,
      mimeType: 'audio/pcm;rate=16000'
    }
  });
});

// WRONG - do NOT use 'audio' key
```

### Audio Pipeline (Single AudioContext)
1. Single `AudioContext` at 24kHz (RECEIVE_SAMPLE_RATE)
2. `MediaStreamSource` from mic
3. `ScriptProcessorNode` (4096 buffer, 1 channel)
4. In `onopen`: Connect processor, send `{ text: '' }` to activate
5. In `onaudioprocess`: Convert Float32 to Int16, base64, send via `media`
```

## Advantages of Gemini Live API

1. **Native voice AI** - No separate STT/TTS services needed
2. **Real-time bidirectional** - Low latency conversation
3. **High-quality voice** - Aoede voice is warm and natural
4. **Multilingual** - Native support for SA languages
5. **Transcription included** - Both input and output STT built-in
