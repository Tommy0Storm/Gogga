# GoggaTalk Voice Chat Implementation

## Status: Implemented (Direct Gemini Live API - Option B)

## Reference Pattern
- See `IP/GoggaSpeech.md` for LlamaIndex GeminiLiveVoiceAgent pattern
- Key concepts: asyncio.TaskGroup, Queue-based audio flow, interrupt handling
- **TESTED EXAMPLES**: `gogga-frontend/public/goggatalk-live.html` and `goggatalk-standalone.html`

## Architecture
- Frontend: GoggaTalkButton (SA Flag) → GoggaTalkTerminal → useGoggaTalkDirect hook
- Direct: Browser WebSocket → Gemini Live API (gemini-2.0-flash-live-001, Aoede voice)
- No backend proxy needed - uses NEXT_PUBLIC_GOOGLE_API_KEY

## Key Files

### Frontend
- `gogga-frontend/src/components/GoggaTalkButton.tsx` - SA Flag gradient button
- `gogga-frontend/src/components/GoggaTalkTerminal.tsx` - Full terminal UI with controls
- `gogga-frontend/src/hooks/useGoggaTalkDirect.ts` - Direct Gemini Live SDK hook

### Tested Examples (AUTHORITATIVE REFERENCE)
- `gogga-frontend/public/goggatalk-live.html` - Minimal working implementation
- `gogga-frontend/public/goggatalk-standalone.html` - Full React implementation

### Documentation
- `docs/GoggaTalk.md` - Full architecture and flow documentation
- `IP/GoggaSpeech.md` - LlamaIndex pattern reference

## CRITICAL: Gemini Live API Config (from tested examples)

```typescript
{
  model: 'gemini-2.0-flash-live-001',
  callbacks: { onopen, onmessage, onclose, onerror },
  config: {
    responseModalities: [Modality.AUDIO],  // AUDIO ONLY - not [AUDIO, TEXT]!
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
    systemInstruction: GOGGA_SYSTEM_PROMPT,  // Plain string - not { parts: [{text}] }!
    inputAudioTranscription: {},   // Enable user STT
    outputAudioTranscription: {},  // Enable Gogga STT
  }
}
```

## CRITICAL: Audio Sending Format (from tested examples)

```typescript
// CORRECT - use 'media' key:
session.sendRealtimeInput({
  media: {
    data: base64Audio,
    mimeType: 'audio/pcm;rate=16000'
  }
});

// WRONG - do NOT use 'audio' key
```

## Audio Pipeline (Single AudioContext)
1. Single `AudioContext` at 24kHz (RECEIVE_SAMPLE_RATE)
2. `MediaStreamSource` from mic
3. `ScriptProcessorNode` (4096 buffer, 1 channel)
4. In `onopen`: Connect processor, send `{ text: '' }` to activate
5. In `onaudioprocess`: Convert Float32 to Int16, base64 encode, send via `media` key

## Session Pattern (Promise-based)
```typescript
const sessionPromise = ai.live.connect({ model, callbacks, config });
sessionPromiseRef.current = sessionPromise;
// In callbacks use: sessionPromise.then(session => session.sendRealtimeInput(...))
```

## Audio Specs
- Input: 16kHz mono PCM16 (ScriptProcessorNode - TODO: migrate to AudioWorklet)
- Output: 24kHz mono PCM16 (Web Audio API playback)
- Encoding: Base64 over WebSocket

## Transcription Events
- `serverContent.inputTranscription.text` - User's speech-to-text
- `serverContent.outputTranscription.text` - Gogga's speech-to-text
- `serverContent.interrupted` - User interrupted playback
- `serverContent.turnComplete` - Turn finished

## Integration in ChatClient
- State: `goggaTalkVisible` controls terminal visibility
- Button click toggles GoggaTalkTerminal component
- Terminal auto-connects on mount, disconnects on close

## 11 SA Languages Supported
English, Afrikaans, isiZulu, isiXhosa, Sesotho, Setswana, Tshivenda, Xitsonga, siSwati, isiNdebele, Sepedi
