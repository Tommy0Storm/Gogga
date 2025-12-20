# GOGGA Media Generation System

## Technical Design Document
**Version:** 2.0 (Enterprise)  
**Date:** December 2025  
**Status:** ✅ Enterprise-Grade Implementation

---

## 1. Overview

GOGGA's Media Generation System provides AI-powered image and video creation using Google's Vertex AI services:
- **Imagen 3/4** for image generation, editing, and upscaling
- **Veo 3.1** for video generation with optional audio

### Key Features
- Tier-based access control (FREE/JIVE/JIGGA)
- Real-time cost estimation in ZAR
- Long-running operation support for videos
- SA-themed sample gallery for FREE tier enticement

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              MediaCreator Component                      │   │
│  │  ┌──────────────────┐  ┌──────────────────┐            │   │
│  │  │   ImageStudio    │  │   VideoStudio    │            │   │
│  │  │  • CreateImage   │  │  • VideoForm     │            │   │
│  │  │  • EditImage     │  │  • VideoProgress │            │   │
│  │  │  • MaskEditor    │  │  • VideoPlayer   │            │   │
│  │  │  • UpscaleChoice │  │  • SampleGallery │            │   │
│  │  └──────────────────┘  └──────────────────┘            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  /api/v1/media/*                          │  │
│  │  • POST /images/generate    • POST /videos/generate      │  │
│  │  • POST /images/edit        • GET  /videos/{id}/status   │  │
│  │  • POST /images/upscale     • GET  /videos/{id}/result   │  │
│  │  • GET  /quota              • GET  /health               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │imagen_service│  │ veo_service  │  │ gcs_service  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Vertex AI (us-central1)                      │  │
│  │  • imagen-3.0-generate-002     (image create)            │  │
│  │  • imagen-3.0-capability-001   (image edit)              │  │
│  │  • imagen-4.0-upscale-preview  (image upscale)           │  │
│  │  • veo-3.1-generate-001        (video create)            │  │
│  │  • veo-3.1-fast-generate-001   (video fast)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Cloud Storage (europe-west4)                      │  │
│  │  • gogga-media-outputs bucket for Veo videos             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Pricing Structure

### Cost Per Operation (USD)
| Service | Cost |
|---------|------|
| Imagen 3 Generate | $0.04/image |
| Imagen 3 Edit | $0.04/image |
| Imagen 4 Upscale | $0.06/image |
| Veo 3.1 Video Only | $0.20/second |
| Veo 3.1 Video + Audio | $0.40/second |

### ZAR Conversion (R18.50 = $1)
| Service | ZAR Cost |
|---------|----------|
| Image Create | R0.74/image |
| Image Edit | R0.74/image |
| Image Upscale | R1.11/image |
| Video (5s) | R18.50 |
| Video + Audio (5s) | R37.00 |

### Tier Allowances
| Feature | FREE | JIVE (R49/mo) | JIGGA (R149/mo) |
|---------|------|---------------|-----------------|
| Image Create | 1/day (watermarked) | 50/month | 200/month |
| Image Edit | Demo only | 20/month | 100/month |
| Image Upscale | ❌ | V3 (x2, x3): 20/mo | V3+V4 (x4): 50/mo |
| Video Create | 3s sample | 5 min/month | 20 min/month |
| Video + Audio | ❌ | 2 min/month | 10 min/month |

---

## 4. API Reference

### 4.1 Image Generation

#### POST `/api/v1/media/images/generate`
Generate images from text prompts using Imagen 3.

**Request:**
```json
{
  "prompt": "A majestic lion in the Kruger National Park at sunset",
  "aspect_ratio": "16:9",
  "sample_count": 2,
  "negative_prompt": "blurry, low quality",
  "person_generation": "allow_adult",
  "safety_setting": "block_some"
}
```

**Response:**
```json
{
  "success": true,
  "images": [
    {
      "data": "base64...",
      "mime_type": "image/png"
    }
  ],
  "meta": {
    "model": "imagen-3.0-generate-002",
    "cost_usd": 0.08,
    "cost_zar": 1.48
  }
}
```

### 4.2 Image Editing

#### POST `/api/v1/media/images/edit`
Edit images using masks with Imagen 3.

**Edit Modes:**
- `EDIT_MODE_INPAINT_INSERTION` - Add objects from prompt
- `EDIT_MODE_INPAINT_REMOVAL` - Remove objects, fill background
- `EDIT_MODE_BGSWAP` - Replace background only
- `EDIT_MODE_OUTPAINT` - Extend image canvas in any direction

**Request:**
```json
{
  "prompt": "A colorful parrot",
  "source_image": "base64...",
  "mask_image": "base64...",
  "edit_mode": "EDIT_MODE_INPAINT_INSERTION",
  "mask_dilation": 0.01
}
```

### 4.3 Image Upscaling

#### POST `/api/v1/media/images/upscale`
Upscale images to higher resolutions using Imagen 4.

**Upscale Factors:**
- `x2` - ~2048px (2K)
- `x3` - ~3072px (3K)
- `x4` - ~4096px (4K) - JIGGA only

**Request:**
```json
{
  "source_image": "base64...",
  "upscale_factor": "x4"
}
```

### 4.4 Video Generation

#### POST `/api/v1/media/videos/generate`
Generate videos from text or images using Veo 3.1.

**Request:**
```json
{
  "prompt": "Drone flight over Table Mountain at sunrise",
  "duration_seconds": 8,
  "aspect_ratio": "16:9",
  "generate_audio": true,
  "resolution": "1080p",
  "reference_image": "base64..."
}
```

**Response (Long-Running):**
```json
{
  "success": true,
  "job_id": "op-12345",
  "status": "pending",
  "estimated_seconds": 180
}
```

#### GET `/api/v1/media/videos/{job_id}/status`
Poll video generation status.

**Response:**
```json
{
  "job_id": "op-12345",
  "status": "running",
  "progress_percent": 45,
  "elapsed_seconds": 82
}
```

#### GET `/api/v1/media/videos/{job_id}/result`
Get completed video.

**Response:**
```json
{
  "success": true,
  "video_url": "https://storage.googleapis.com/...",
  "video_data": "base64...",
  "duration_seconds": 8,
  "meta": {
    "cost_usd": 3.20,
    "cost_zar": 59.20,
    "generate_audio": true
  }
}
```

### 4.5 Quota Check

#### GET `/api/v1/media/quota`
Get remaining monthly allowances.

**Response:**
```json
{
  "tier": "jive",
  "images": { "used": 23, "limit": 50 },
  "edits": { "used": 5, "limit": 20 },
  "upscales": { "used": 10, "limit": 20 },
  "video_seconds": { "used": 180, "limit": 300 },
  "video_audio_seconds": { "used": 60, "limit": 120 }
}
```

---

## 5. Enterprise Features (Dec 2025)

### 5.1 Retry with Exponential Backoff

Located in `app/core/retry.py`. Provides resilient API calls with automatic retries.

```python
# Configuration (per production spec)
RetryConfig(
    initial_delay_ms=1000,  # 1 second initial delay
    multiplier=2.0,         # 2x exponential growth
    max_delay_ms=8000,      # 8 second maximum cap
    jitter_max_ms=250,      # Random 0-250ms to prevent thundering herd
    max_attempts=5,         # 5 total attempts before failure
)
```

**Retry Conditions:**
- HTTP 429 (Rate Limited)
- HTTP 5xx (Server Errors)
- Network timeouts and connection errors
- `asyncio.TimeoutError`

**Usage:**
```python
@with_retry(operation_name="imagen_generate")
async def _generate_with_retry(self, request, user_tier):
    # This method will automatically retry on transient failures
    ...
```

### 5.2 Circuit Breaker Pattern

Prevents cascading failures when services are experiencing sustained issues.

| Service | Failure Threshold | Reset Timeout |
|---------|-------------------|---------------|
| Imagen  | 5 consecutive     | 30 seconds    |
| Veo     | 3 consecutive     | 60 seconds    |

**Behavior:**
1. Circuit **CLOSED**: Normal operation, requests pass through
2. Circuit **OPEN**: After N consecutive failures, all requests immediately fail with 503
3. Circuit **RESET**: After timeout, one request allowed through to test recovery

### 5.3 Idempotency Keys

Located in `app/core/idempotency.py`. Prevents duplicate API costs on retries.

**Flow:**
1. Frontend generates UUID v4 key via `crypto.randomUUID()`
2. Key sent with request in `idempotency_key` field
3. Server checks cache for existing response
4. On cache hit: Return cached response (no API call)
5. On cache miss: Execute request, cache response

**Cache Configuration:**
| Service | TTL | Max Entries |
|---------|-----|-------------|
| Imagen  | 1 hour | 10,000 |
| Veo     | 2 hours | 10,000 |

**Key Validation:**
- Must be valid UUID v4 format
- Lowercase normalized
- Invalid keys are ignored (request proceeds without caching)

### 5.4 Tier-Based Watermarking

FREE tier images receive SynthID invisible watermark for AI content identification.

```python
# In imagen_service.py
add_watermark = user_tier == UserTier.FREE
# Passed to Vertex AI API
```

**Frontend Detection:**
- `ImageViewer` component displays SynthID badge when `hasWatermark=true`
- Export button text changes to "Download with SynthID watermark"

---

## 6. Frontend Components

### 6.1 Component Hierarchy
```
MediaCreator/
├── index.tsx              # Entry point with studio cards
├── ImageStudio/
│   ├── index.tsx          # Tab container
│   ├── CreateImage.tsx    # Text-to-image form
│   ├── EditImage.tsx      # Upload → Mask → Edit workflow
│   ├── MaskEditor.tsx     # Canvas brush tool
│   ├── UpscaleChoice.tsx  # V3 vs V4 selector
│   └── ImageViewer.tsx    # AI actions panel, SynthID badge, thumbnails
├── VideoStudio/
│   ├── index.tsx          # State machine container
│   ├── VideoForm.tsx      # Generation parameters
│   ├── VideoProgress.tsx  # Polling UI with minimize
│   ├── VideoPlayer.tsx    # Custom player
│   └── SampleGallery.tsx  # SA examples
└── shared/
    ├── types.ts           # TypeScript definitions
    ├── api.ts             # API client with idempotency
    ├── TierGate.tsx       # Access control
    ├── CostEstimate.tsx   # Price display
    ├── WatermarkOverlay.tsx # FREE tier watermark
    └── UpgradePrompt.tsx  # Upgrade CTAs
```

### 6.2 Key UX Flows

#### Image Creation Flow
```
[Enter Prompt] → [Select Style Preset] → [Choose Aspect Ratio]
      ↓
[View Cost Estimate] → [Generate] → [View Results]
      ↓
[Download] | [Edit] | [Upscale]
```

#### Image Editing Flow
```
[Upload Image] → [Draw Mask with Brush Tool] → [Select Edit Mode]
      ↓
[Enter Prompt] → [Generate] → [Compare Before/After]
      ↓
[Download] | [Edit Again]
```

#### Video Creation Flow
```
[Enter Prompt] → [Optional: Upload Reference Image]
      ↓
[Set Duration (5-8s)] → [Toggle Audio] → [Select Resolution]
      ↓
[View Cost Estimate] → [Generate]
      ↓
[Poll Progress] ←──── [Run in Background Option]
      ↓
[Video Player] → [Download MP4]
```

---

## 7. Technical Implementation

### 6.1 Authentication
- Uses Google Cloud Application Default Credentials (ADC)
- Token refresh handled automatically by services
- Same credentials as other Vertex AI services

### 6.2 GCS Integration
Veo outputs videos to Google Cloud Storage (Google requirement).

```python
# gcs_service.py handles:
1. parse_gcs_uri("gs://bucket/path") → (bucket, path)
2. generate_signed_url() → 24-hour browser-accessible URL
3. download_as_base64() → fallback if signed URL fails
```

### 6.3 Long-Running Operations
Veo video generation is asynchronous:

```
Client                    Backend                   Vertex AI
  │                         │                          │
  │─── POST /generate ─────►│                          │
  │                         │─── predictLongRunning ──►│
  │                         │◄── operation_id ─────────│
  │◄── job_id, "pending" ───│                          │
  │                         │                          │
  │─── GET /status ────────►│                          │
  │                         │─── GET operation ───────►│
  │                         │◄── progress % ───────────│
  │◄── "running", 45% ──────│                          │
  │                         │                          │
  │─── GET /status ────────►│                          │
  │                         │◄── completed + GCS URL ──│
  │                         │─── generate_signed_url ──│
  │◄── video_url ───────────│                          │
```

### 6.4 Error Handling
```python
# Standardized error responses
{
  "success": false,
  "error": "Content policy violation",
  "error_code": "SAFETY_BLOCKED"
}

# Error codes:
- QUOTA_EXCEEDED: Monthly limit reached
- TIER_RESTRICTED: Feature not available for tier
- SAFETY_BLOCKED: Content policy violation
- GENERATION_FAILED: AI model error
- TIMEOUT: Long-running operation timeout
```

---

## 8. Configuration

### 7.1 Environment Variables
```bash
# Required
GCP_PROJECT_ID=gogga-ai
VERTEX_AI_LOCATION=us-central1

# Optional (defaults shown)
VEO_OUTPUT_BUCKET=gogga-media-outputs
GCS_SIGNED_URL_EXPIRY_HOURS=24
```

### 7.2 Config Constants (config.py)
```python
# Model IDs
IMAGEN_V3_MODEL = "imagen-3.0-generate-002"
IMAGEN_V3_EDIT_MODEL = "imagen-3.0-capability-001"
IMAGEN_V4_UPSCALE_MODEL = "imagen-4.0-upscale-preview"
VEO_MODEL = "veo-3.1-generate-001"
VEO_FAST_MODEL = "veo-3.1-fast-generate-001"

# Pricing (USD)
COST_IMAGEN_V3_CREATE = 0.04
COST_IMAGEN_V3_EDIT = 0.04
COST_IMAGEN_V4_UPSCALE = 0.06
COST_VEO_VIDEO_ONLY = 0.20
COST_VEO_VIDEO_AUDIO = 0.40

# ZAR conversion
ZAR_USD_RATE = 18.50
```

---

## 9. Security Considerations

1. **Tier Enforcement**: All endpoints validate user tier via `X-User-Tier` header
2. **Quota Tracking**: Operations logged and counted against monthly limits
3. **Content Safety**: Vertex AI's built-in safety filters enabled
4. **GCS Access**: Signed URLs expire after 24 hours
5. **Rate Limiting**: Standard API rate limits apply

---

## 10. Future Enhancements

### Planned
- [ ] Chat integration: `/image` and `/video` commands
- [ ] Batch generation queue
- [ ] Image-to-image style transfer
- [ ] Video extension (continue existing video)

### Considered
- [ ] Custom model fine-tuning
- [ ] User asset library
- [ ] Collaborative editing
- [ ] Mobile-optimized UI

---

## 10. Related Documentation

- [Vertex AI Imagen Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)
- [Vertex AI Veo Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/video/overview)
- [GOGGA Tier System](./TIERS.md)
- [GOGGA Architecture](./ARCHITECTURE.md)
