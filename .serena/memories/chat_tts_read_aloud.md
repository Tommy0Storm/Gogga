# Chat TTS (Read Aloud) Implementation

## Status: ✅ Updated Dec 2025

## Overview
Chat TTS uses **Vertex AI Gemini 2.5 Flash TTS** with Charon voice for the "Read Aloud" feature in the chat interface. This is **separate from GoggaTalk** (Live API voice chat).

Uses the **same authentication pattern as Imagen** (service account / ADC / gcloud CLI).

## Voice: Charon
- Deep, gravelly warmth - GOGGA's signature voice
- Same voice used in GoggaTalk for brand consistency
- Available voices: Charon (default), Kore, Puck, Fenrir, Aoede, Zephyr

## Cost Optimization: 50-Word Chunking
- Text split into ~50 word chunks ending at sentence boundaries
- Chunks fetched **sequentially** (not in parallel)
- When user cancels, remaining chunks are NOT fetched
- **Result**: User only pays for what they actually listen to

## Architecture

### Frontend
```
AudioPlayerModal.tsx → useTextToSpeech.ts → /api/v1/tts/synthesize
                                                     ↓
                                         (Next.js API route proxy)
                                                     ↓
                                         Backend /api/v1/tts/synthesize
```

### Backend
```
app/api/v1/tts.py → app/services/gemini_tts_service.py → Vertex AI TTS
                                    ↓
                    (same auth as ImagenService: ADC/service account)
```

## Key Files
| File | Purpose |
|------|---------|
| `gogga-frontend/src/hooks/useTextToSpeech.ts` | Frontend hook with 50-word chunking |
| `gogga-frontend/src/components/AudioPlayerModal.tsx` | UI modal for read aloud |
| `gogga-frontend/src/components/ReadAloudButton.tsx` | Button trigger |
| `gogga-backend/app/api/v1/tts.py` | REST endpoint |
| `gogga-backend/app/services/gemini_tts_service.py` | Vertex AI TTS service (singleton) |

## Audio Format
- **API Response**: PCM (24kHz, 16-bit, mono)
- **To Browser**: WAV (with headers for compatibility)
- **Encoding**: Base64 for JSON transport

## Vertex AI API Format
The Gemini TTS API via Vertex AI **requires a `role` field** in the contents:

```python
payload = {
    "contents": [{
        "role": "user",  # REQUIRED - API returns 400 without this
        "parts": [{"text": text}]
    }],
    "generationConfig": {
        "responseModalities": ["AUDIO"],
        "speechConfig": {
            "voiceConfig": {
                "prebuiltVoiceConfig": {"voiceName": "Charon"}
            }
        }
    }
}
```

## Configuration
Uses same auth as Imagen - no additional env vars needed:
```bash
# Option 1: Service account (recommended for production)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Option 2: ADC (for local dev)
gcloud auth application-default login

# Vertex AI settings (same as Imagen)
VERTEX_PROJECT_ID=your-project-id
VERTEX_LOCATION=us-central1
```

## Docker Networking Fix (Dec 2025)
The TTS service includes an **IPv4 force-resolution fix** because Docker containers may have broken IPv6 connectivity. This is handled automatically in `gemini_tts_service.py`:

```python
# Force IPv4 to avoid Docker IPv6 issues
import socket
_original_getaddrinfo = socket.getaddrinfo

def _getaddrinfo_ipv4_only(*args, **kwargs):
    responses = _original_getaddrinfo(*args, **kwargs)
    return [r for r in responses if r[0] == socket.AF_INET] or responses

socket.getaddrinfo = _getaddrinfo_ipv4_only
```

Without this fix, `google.auth.transport.requests` fails with `Network is unreachable` when IPv6 is tried first.

## Chunking Logic
```typescript
// Split at ~50 words, ending at sentence boundaries
const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
// Accumulate sentences until 50 words reached
// Finalize chunk at sentence end
```

## Cost Comparison
| Provider | Cost |
|----------|------|
| Google Cloud TTS WaveNet | $16/million chars |
| Gemini 2.5 Flash TTS | Much cheaper (pay per request) |

## Tier Access
- **FREE**: No access
- **JIVE**: No access
- **JIGGA**: Full access to Read Aloud feature

## Cancellation Behavior
1. User clicks Read Aloud → Modal opens
2. First chunk (~50 words) starts playing immediately
3. Next chunks fetched sequentially as needed
4. User clicks Stop → Current audio stops, no more chunks fetched
5. **Cost saved**: Unfetched chunks = no API calls = no cost

## Related Features
- **GoggaTalk**: Uses Gemini Live API (separate, bidirectional voice chat)
- **This feature**: Unidirectional read-aloud using Gemini TTS API

---

## Test Plan

### Unit Tests

#### Backend: `tests/test_tts.py`
```python
# 1. Test synthesize endpoint returns WAV audio
# 2. Test empty text returns 400
# 3. Test text truncation at 5000 chars
# 4. Test backward compat: WaveNet voice names → Charon
# 5. Test /voices endpoint returns Charon as default

# 6. Test GeminiTTSService synthesize success
# 7. Test GeminiTTSService handles API errors gracefully
# 8. Test PCM to WAV conversion produces valid header
```

#### Frontend: `__tests__/useTextToSpeech.test.ts`
```typescript
// 1. Test 50-word chunking splits at sentence boundaries
// 2. Test long sentence (>50 words) splits at word boundaries
// 3. Test cleanTextForSpeech removes markdown
// 4. Test cancel stops fetching remaining chunks
// 5. Test WAV audio plays in Audio element
```

### Integration Tests

| Test | Steps | Expected |
|------|-------|----------|
| Read Aloud Modal | 1. Login as JIGGA, 2. Get AI response, 3. Click speaker icon, 4. Verify audio plays | Audio plays with Charon voice |
| Cancel Saves Cost | 1. Start long text, 2. Cancel after 5 seconds, 3. Check network tab | Only 1-2 chunk requests made |
| Voice Consistency | 1. Compare with GoggaTalk voice | Same Charon voice identity |

### Manual Verification Checklist
- [ ] Backend starts without errors
- [ ] Frontend compiles without errors
- [ ] Read Aloud button appears for JIGGA users
- [ ] Audio plays when modal opens
- [ ] Stop button cancels playback immediately
- [ ] Browser network tab shows sequential chunk requests
- [ ] Cancellation stops further network requests
