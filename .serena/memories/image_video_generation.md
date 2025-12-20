# Image & Video Generation Integration

## Status: ✅ ENTERPRISE-GRADE (Dec 2025, Updated Jan 2025)

## Overview
Full integration of Vertex AI Imagen (v3/v4) and Veo (3.1) for image and video generation with tier-based access.

## AI-Callable Tools (NEW Jan 2025)
| Tool | Tiers | Description |
|------|-------|-------------|
| `generate_image` | ALL | Create images via Pollinations/FLUX (FREE) or Imagen 3.0 (JIVE/JIGGA) |
| `upscale_image` | JIVE/JIGGA | Upscale images x2/x3/x4 using Imagen 4 Ultra |
| `edit_image` | JIVE/JIGGA | Mask-based editing: inpaint, remove, bgswap, outpaint |
| `generate_video` | JIVE/JIGGA | Text-to-video using Veo 3.1 |

## Pricing (USD → ZAR at R18.50)
| Service | Per-Unit Cost | ZAR |
|---------|---------------|-----|
| Imagen v3 (create/edit) | $0.04/image | R0.74 |
| Imagen v4 Ultra (upscale) | $0.06/image | R1.11 |
| Veo 3.1 Video Only | $0.20/sec | R3.70 |
| Veo 3.1 Video + Audio | $0.40/sec | R7.40 |

## Tier Allowances
| Tier | Images | Edits | Upscale | Video | Video+Audio |
|------|--------|-------|---------|-------|-------------|
| FREE | 1 preview/day (watermarked) | Demo only | ❌ | 3-sec sample | ❌ |
| JIVE (R49) | 50/mo | 20/mo | V3 only, 20/mo | 5 min/mo | 2 min/mo |
| JIGGA (R149) | 200/mo | 100/mo | V3+V4, 50/mo | 20 min/mo | 10 min/mo |

## API Endpoints (LIVE)
```
POST /api/v1/media/images/generate  - Text-to-image (Imagen 3)
POST /api/v1/media/images/edit      - Mask-based edit (Imagen 3)
POST /api/v1/media/images/upscale   - V3/V4 upscale (Imagen 4)
POST /api/v1/media/videos/generate  - Text/image-to-video (Veo 3.1)
GET  /api/v1/media/videos/{id}/status - Poll job status
GET  /api/v1/media/videos/{id}/result - Get completed video
GET  /api/v1/media/quota            - Remaining allowances
GET  /api/v1/media/health           - Service health check
```

## Backend Services
| File | Purpose |
|------|---------|
| `app/services/imagen_service.py` | Imagen v3/v4 generate, edit, upscale |
| `app/services/veo_service.py` | Veo 3.1 text2vid, img2vid, polling |
| `app/services/gcs_service.py` | GCS download/signed URLs for videos |
| `app/api/v1/endpoints/media.py` | 8 API endpoints |

## Frontend Components (4,186 lines)
```
src/components/MediaCreator/
├── index.tsx              - Main entry with Image/Video Studio cards
├── ImageStudio/
│   ├── index.tsx          - Tab container (Create/Edit/Upscale)
│   ├── CreateImage.tsx    - Text-to-image with style presets
│   ├── EditImage.tsx      - 3-step mask editing workflow
│   ├── MaskEditor.tsx     - Canvas brush/eraser tool
│   ├── UpscaleChoice.tsx  - V3 vs V4 Ultra picker
│   └── ImageViewer.tsx    - AI actions panel, SynthID badge, thumbnails
├── VideoStudio/
│   ├── index.tsx          - State machine (form→progress→player)
│   ├── VideoForm.tsx      - All Veo 3.1 parameters
│   ├── VideoProgress.tsx  - Polling with minimize option
│   ├── VideoPlayer.tsx    - Custom player with download
│   └── SampleGallery.tsx  - SA-themed examples for FREE tier
└── shared/
    ├── types.ts           - UserTier, Request/Response types
    ├── api.ts             - API client functions
    ├── TierGate.tsx       - Feature access control
    ├── CostEstimate.tsx   - ZAR/USD cost display
    ├── WatermarkOverlay.tsx - FREE tier watermark
    ├── UpgradePrompt.tsx  - Contextual upgrade CTAs
    └── index.ts           - Barrel exports
```

## Vertex AI Models
| Purpose | Model ID |
|---------|----------|
| Image Generate | `imagen-3.0-generate-002` |
| Image Edit | `imagen-3.0-capability-001` |
| Image Upscale | `imagen-4.0-upscale-preview` |
| Video Generate | `veo-3.1-generate-001` |
| Video Fast | `veo-3.1-fast-generate-001` |

## Edit Modes (Imagen 3)
- `EDIT_MODE_INPAINT_INSERTION` - Add objects from prompt
- `EDIT_MODE_INPAINT_REMOVAL` - Remove objects, fill background
- `EDIT_MODE_BGSWAP` - Replace background, preserve foreground
- `EDIT_MODE_OUTPAINT` - Extend image canvas in any direction (Dec 2025)

## Enterprise Features (Dec 2025)

### Retry with Exponential Backoff (`app/core/retry.py`)
```python
RetryConfig(
    initial_delay_ms=1000,  # 1 second
    multiplier=2.0,         # Exponential growth
    max_delay_ms=8000,      # 8 second cap
    jitter_max_ms=250,      # Prevent thundering herd
    max_attempts=5,
)
```
- Retries on HTTP 429 (rate limit) and 5xx (server errors)
- Network timeouts and connection errors are retried
- `@with_retry` decorator on all generate/edit/upscale methods

### Circuit Breaker (`app/core/retry.py`)
| Service | Failure Threshold | Reset Timeout |
|---------|-------------------|---------------|
| Imagen | 5 consecutive | 30 seconds |
| Veo | 3 consecutive | 60 seconds |

### Idempotency Keys (`app/core/idempotency.py`)
- UUID v4 keys prevent duplicate API costs on retries
- Frontend auto-generates keys via `crypto.randomUUID()`
- Server-side cache: 1hr TTL (images), 2hr TTL (videos)
- Max 10,000 cached entries with LRU eviction

### Tier-Based Watermarking
- FREE tier: `addWatermark: true` → SynthID invisible watermark
- JIVE/JIGGA: Full-quality without watermarks
- ImageViewer shows SynthID badge when detected

## Key Implementation Details

### Authentication
- Uses Google Cloud ADC (Application Default Credentials)
- Same auth as other Vertex AI services

### GCS Integration
- Veo outputs videos to GCS buckets (Google requirement)
- `gcs_service.py` generates signed URLs for browser access
- Falls back to base64 download if needed
- 24-hour URL expiry

### Long-Running Operations
- Veo uses `:predictLongRunning` endpoint
- Frontend polls every 3 seconds
- "Run in Background" option available

### Cost Tracking
- All operations tracked in cost_tracker
- ZAR conversion at R18.50/$1
- Per-tier quota enforcement

## Entry Points
1. ToolShed → Media Creator card → Image/Video Studio
2. Chat → `/image` or `/video` commands (planned)

## SA-Specific Features
- All pricing in Rands (ZAR)
- Sample gallery with SA themes (Table Mountain, Kruger, Drakensberg)
- Seamless language support for prompts
- europe-west4 GCS region (closest to SA)