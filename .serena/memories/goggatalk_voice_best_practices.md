# GoggaTalk Voice Chat - Best Practices & Design Document

## Overview
GoggaTalk is Gogga's bidirectional voice chat feature using Google's Gemini Live API (native audio model). This document captures best practices learned from implementation and debugging.

---

## Architecture

### Audio Pipeline
```
[Microphone] → [Input AudioContext @ hardware rate] → [Gain (2.2x)] → [ScriptProcessor]
     ↓                                                                        ↓
[Resample to 16kHz] → [Base64 PCM] → [Gemini Live WebSocket] → [Base64 PCM response]
                                                                        ↓
                          [Output AudioContext @ 24kHz] ← [Decode PCM] ←
                                    ↓
                              [Speakers]
```

### Key Components
- **Model**: `gemini-2.5-flash-native-audio-preview-12-2025`
- **Voice**: Kore (natural female voice)
- **Input Sample Rate**: Hardware native (44.1kHz/48kHz) → resampled to 16kHz
- **Output Sample Rate**: 24kHz (Gemini's output format)
- **Main Hook**: `gogga-frontend/src/hooks/useGoggaTalkDirect.ts`

---

## Critical Best Practices

### 1. Echo Prevention (CRITICAL)
**Problem**: When Gogga speaks through speakers, the mic picks up the audio, causing Gemini to detect "user speech" and trigger the `interrupted` event, cutting off playback.

**Solution**: Auto-mute mic input while audio is playing:
```typescript
processor.onaudioprocess = (e) => {
  // Skip sending audio if Gogga is currently speaking
  if (activeSourcesRef.current.size > 0) return;
  // ... rest of audio processing
};
```

**Alternative**: Recommend headphones in the UI (already implemented).

### 2. AudioContext Resume (Browser Policy)
**Problem**: Browsers suspend AudioContext until user interaction due to autoplay policies.

**Solution**: Resume before playing audio:
```typescript
if (outputCtx.state === 'suspended') {
  await outputCtx.resume();
}
```

### 3. Separate AudioContexts for Firefox
**Problem**: Firefox requires MediaStreamSource's AudioContext to match hardware sample rate.

**Solution**: Use TWO separate AudioContexts:
- **Input AudioContext**: Default (hardware) sample rate for mic capture
- **Output AudioContext**: 24kHz for Gemini playback

```typescript
const inputCtx = new AudioContext();  // Hardware rate
const outputCtx = new AudioContext({ sampleRate: 24000 });  // Gemini rate
```

### 4. Proper Resampling
**Problem**: Gemini expects 16kHz input, but hardware captures at 44.1/48kHz.

**Solution**: Linear interpolation resampling:
```typescript
const resample = (inputData: Float32Array, fromRate: number, toRate: number): Float32Array => {
  const ratio = fromRate / toRate;
  const outputLength = Math.round(inputData.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const floor = Math.floor(srcIndex);
    const t = srcIndex - floor;
    output[i] = inputData[floor] * (1 - t) + inputData[floor + 1] * t;
  }
  return output;
};
```

### 5. Noise Gate
**Problem**: Background noise triggers constant audio sending, wasting bandwidth.

**Solution**: RMS-based noise gate:
```typescript
const NOISE_GATE_THRESHOLD = 0.02;
let sumSquares = 0;
for (let i = 0; i < inputData.length; i++) {
  sumSquares += inputData[i] * inputData[i];
}
const rms = Math.sqrt(sumSquares / inputData.length);
if (rms < NOISE_GATE_THRESHOLD) return;  // Skip quiet audio
```

### 6. VAD Configuration
**Recommended settings** for natural conversation:
```typescript
automaticActivityDetection: {
  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,  // Detect quiet speech
  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,  // Wait longer before cutting
  silenceDurationMs: 1500,  // 1.5s silence before end of turn
  prefixPaddingMs: 300,  // Capture 300ms before detected speech
}
```

### 7. Audio Scheduling
**Problem**: Audio chunks arrive asynchronously and need seamless playback.

**Solution**: Schedule buffers sequentially using `nextStartTime`:
```typescript
nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
bufferSource.start(nextStartTimeRef.current);
nextStartTimeRef.current += buffer.duration;
```

**Reset on turn complete**:
```typescript
if (msg.serverContent?.turnComplete) {
  nextStartTimeRef.current = 0;
}
```

### 8. sendRealtimeInput Format
**CRITICAL**: Use `media` key, not `audio`:
```typescript
session.sendRealtimeInput({
  media: {
    data: base64Audio,
    mimeType: 'audio/pcm;rate=16000'
  }
});
```

### 9. Native Audio Model Quirks
- **DO NOT set languageCode** - Native audio models auto-detect language
- **Use voiceName only**: `voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }`

---

## Transcript Handling

### Buffering Strategy
Gemini sends incremental transcriptions. Buffer them to avoid fragmented display:

```typescript
if (inputTranscription.finished) {
  const fullText = bufferRef.current + inputTranscription.text;
  addTranscript('user', fullText.trim());
  bufferRef.current = '';
} else {
  bufferRef.current += inputTranscription.text;
  // Fallback flush after 1.5s silence
  setTimeout(() => { /* flush buffer */ }, 1500);
}
```

---

## Debugging Tips

1. **Console logging**: Log first 500 chars of each message:
   ```typescript
   console.log('[GoggaTalk] Received:', JSON.stringify(msg).substring(0, 500));
   ```

2. **Check for `interrupted: true`** - This means echo or VAD triggered

3. **Verify AudioContext state**: Should be "running", not "suspended"

4. **Check `activeSourcesRef.current.size`**: Should increase during playback

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No audio playback | AudioContext suspended | Call `resume()` before playing |
| Audio cuts off mid-sentence | Echo causing interruption | Mute mic during playback |
| Fragmented transcripts | Incremental transcription | Buffer until `finished: true` |
| Firefox mic errors | Sample rate mismatch | Use separate AudioContexts |
| "Only detecting bits of voice" | Noise gate too high | Lower `NOISE_GATE_THRESHOLD` |
| Poor voice quality | Low input gain | Increase gain (currently 2.2x) |

---

## December 2025 Fixes Applied

1. **Echo Prevention**: Added check `if (activeSourcesRef.current.size > 0) return` to skip mic input while playing
2. **AudioContext Resume**: Added `await outputCtx.resume()` before playing audio chunks
3. **Turn Complete Reset**: Reset `nextStartTimeRef.current = 0` on turn complete
4. **Connection Mutex** (Dec 17): Added `isConnectingRef` to prevent multiple simultaneous connections
5. **Connection Debounce** (Dec 17): Added 2-second debounce using `lastConnectTimeRef` 
6. **Stale State Fix** (Dec 17): Changed guard from `isConnected` (stale state) to `isSessionOpenRef.current` (ref)
7. **Lock Release in Callbacks** (Dec 17): Added `isConnectingRef.current = false` in onopen, onclose, onerror, and catch

### Root Cause of Duplicate Transcription
Multiple simultaneous WebSocket connections were being created because:
- The `isConnected` state was stale in the async closure
- Rapid button clicks created multiple connections
- Each connection sent audio independently, causing "can can you you please please" transcription

---

## References
- [Gemini Live API Cookbook](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_LiveAPI.ipynb)
- [Google GenAI JS SDK](https://github.com/google-gemini/js-genai)

---

*Last Updated: December 2025*
