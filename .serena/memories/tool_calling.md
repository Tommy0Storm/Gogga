# GOGGA Tool Calling Implementation

## Last Updated
December 7, 2025

## Overview
JIGGA tier supports tool calling, allowing the AI to execute functions during conversations.
Tools are defined in the backend but executed on the frontend (client-side IndexedDB).

## Architecture

```
User Message → Backend (ai_service.py)
                  ↓
              Cerebras API (with tools param)
                  ↓
              AI Response with tool_calls
                  ↓
              Frontend (ChatClient.tsx)
                  ↓
              toolHandler.ts executes tools
                  ↓
              Memory saved to IndexedDB
```

## Files

### Backend
- `gogga-backend/app/tools/__init__.py` - Module init
- `gogga-backend/app/tools/definitions.py` - Tool schemas (OpenAI format)
- `gogga-backend/app/tools/executor.py` - Tool execution (dual image generation)
- `gogga-backend/app/api/v1/endpoints/tools.py` - `/api/v1/tools/execute` endpoint
- `gogga-backend/app/services/ai_service.py` - Tool calling integration
- `gogga-backend/app/services/image_service.py` - Image generation with AI Horde

### Frontend
- `gogga-frontend/src/lib/toolHandler.ts` - Tool execution logic
- `gogga-frontend/src/app/ChatClient.tsx` - Tool call handling

## Available Tools

### Memory Tools (JIGGA only)
1. `save_memory` - Save user information to IndexedDB
2. `delete_memory` - Delete AI-created memories

### Universal Tools (All Tiers: FREE, JIVE, JIGGA)
3. `generate_image` - Create images via Pollinations.ai (free)
4. `create_chart` - Create interactive charts (Recharts on frontend)

## Tool Availability by Tier

| Tier | Memory | Image (Tool) | Chart | Image Button |
|------|--------|--------------|-------|--------------|
| FREE | ❌ | ❌ | ❌ | Pollinations.ai |
| JIVE | ❌ | Pollinations + AI Horde (dual) | ✅ | GOGGA Pro (FLUX) |
| JIGGA | ✅ | Pollinations + AI Horde (dual) | ✅ | GOGGA Pro (FLUX) |

## Image Generation Architecture

### Tool Calling (`generate_image` tool) - All Tiers

Dual parallel generation with silent fallback:

| Provider | URL | Speed | Size | Notes |
|----------|-----|-------|------|-------|
| **Pollinations.ai** | `image.pollinations.ai/prompt/{prompt}` | Instant | 1024x1024 | FLUX-based, no API key |
| **AI Horde** | `aihorde.net/api/v2/generate/async` | 10-60s | 512x512 | Community, anon key |

**Flow:**
1. Frontend calls `POST /api/v1/tools/execute` with `{tool_name: "generate_image", arguments: {prompt}}`
2. Backend runs both generators in parallel (`asyncio.create_task()`)
3. Returns all successful images as `{image_url, image_urls: [], providers: []}`
4. Frontend renders multiple images in markdown: `![Generated Image 1](url1)\n\n![Generated Image 2](url2)`
5. If one fails, silently returns the other - user never sees errors

**AI Horde Requirements** (to avoid 403 "KudosUpfront"):
- `apikey: 0000000000` (anonymous)
- `Client-Agent: Gogga:1.0:gogga@southafrica.ai`
- `steps: 15` (max for anonymous)
- `width/height: 512x512` (under 588x588 limit)
- `models: []` (any model), `slow_workers: true`

### Image Button (`/api/v1/images/generate`)

| Mode | Provider | Cost |
|------|----------|------|
| FREE tier | Pollinations.ai | $0.00 |
| JIVE/JIGGA `use_premium=true` | GOGGA Pro (FLUX 1.1 Pro) | $0.04/image |

Named after Irma Stern, pioneering South African expressionist painter (1894-1966).