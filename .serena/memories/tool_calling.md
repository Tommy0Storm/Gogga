# GoggaToolShed - Enterprise Tool Calling

## Architecture Document
Full documentation: `IP/Tooling.md`

# GOGGA Tool Calling Implementation

## Cerebras API Requirement (CRITICAL)
Cerebras API requires `"additionalProperties": False` in ALL tool parameter schemas including nested objects.
- Fixed in `math_definitions.py` (6 tools)  
- Fixed in `definitions.py` (6 tool schemas)
- For chart data items: Must use fixed keys (`value`, `value2`, `value3`, etc.) for multi-series
- Without this, Cerebras returns 422 error: "'additionalProperties' is required to be supplied and set to false."

## Last Updated
December 8, 2025 (Math Tools + Two-Pass Tool Calling)

## Two-Pass Tool Calling (JIGGA Math + Charts)

When math tools are used, the streaming endpoint uses TWO LLM calls:

1. **First call**: With all tools enabled (math + chart/image)
   - If `math_*` tool is called, execute on backend
   - Collect any `other_tool_calls` (charts, images) but don't execute yet

2. **Second call**: With ONLY non-math tools (charts, images)
   - Feed math results to LLM for interpretation  
   - LLM can then call `create_chart` to visualize results
   - Tool calls captured and forwarded to frontend

**Backend file**: `gogga-backend/app/services/ai_service.py`
- Method: `generate_response_with_tools_stream()`
- Non-streaming second call to capture tool_calls properly
- Combines first-pass `other_tool_calls` + second-pass tool calls

**Frontend normalization**: `gogga-frontend/src/app/ChatClient.tsx`
- Backend sends: `{function: {name, arguments}, id}`
- toolHandler expects: `{name, arguments, id}`
- Normalization converts between formats before `executeToolCalls()`

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

### Math Tools (Backend-Executed)
5. `math_statistics` - Descriptive statistics (mean, median, std dev, outliers) - JIVE+
6. `math_financial` - Financial calculations (compound interest, NPV, IRR, amortization) - JIVE+
7. `math_sa_tax` - SA income tax calculator (2024/25 brackets) - All tiers
8. `math_conversion` - Unit conversions (currency, length, weight) - All tiers
9. `math_probability` - Probability calculations (binomial, normal, permutations) - JIVE+
10. `math_fraud_analysis` - Fraud detection (Benford's Law, anomalies) - JIGGA only

## Tool Availability by Tier

| Tier | Memory | Image (Tool) | Chart | Math Tools | Image Button |
|------|--------|--------------|-------|------------|--------------|
| FREE | ❌ | ❌ | ❌ | Tax, Conversion | Pollinations.ai |
| JIVE | ❌ | Pollinations + AI Horde (dual) | ✅ | + Stats, Financial, Probability | GOGGA Pro (FLUX) |
| JIGGA | ✅ | Pollinations + AI Horde (dual) | ✅ | + Fraud, Regression | GOGGA Pro (FLUX) |

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

## HD Quality Settings

All image prompts automatically get quality suffix:
`, masterpiece, best quality, hyperdetailed, highly detailed, sharp focus, HD, 4K, ultra high resolution`

**Pollinations.ai Settings:**
- `enhance=true` - AI enhancement
- `nologo=true` - No watermarks
- `width=1024&height=1024` - HD resolution

**AI Horde Settings:**
- `steps=20` - Higher quality
- `cfg_scale=7.5` - Better prompt adherence
- `censor_nsfw=false` - Disabled overly aggressive filter (GOGGA has own moderation)
- Negative prompt: lowres, blurry, watermark, etc.

## Auto-Image Injection

For CePO (JIVE) and Qwen thinking (JIGGA) responses:
- Triggers every 2nd or 3rd response
- Only for informal/educational content (school, projects, tutorials, history, science, etc.)
- Excludes legal, medical, abuse topics
- Inserts Pollinations FLUX images at natural paragraph breaks
- Images appear seamlessly within content (same thumbnail size as tool-generated)

**File:** `gogga-frontend/src/lib/autoImageInjector.ts`

## Display Improvements

- Removed "Memory Updated:" prefix - results speak for themselves
- Provider badge shows engine: "FLUX" (Pollinations) or "Horde" (AI Horde)
- Thumbnails use `object-contain` to show full image without cropping

---

## GoggaToolShed UI (December 2025)

Enterprise-grade tool management interface for JIVE/JIGGA tiers.

### Frontend Components

| File | Purpose |
|------|---------|
| `gogga-frontend/src/lib/toolshedStore.ts` | Zustand store with panel state, tools, forcedTool, executionHistory |
| `gogga-frontend/src/components/toolshed/ToolShedPanel.tsx` | Slide-out panel with category tabs and tool list |
| `gogga-frontend/src/components/toolshed/ToolCard.tsx` | Tool display with examples, parameter form, force button |
| `gogga-frontend/src/components/toolshed/ForcedToolBadge.tsx` | Badge showing forced tool above chat input |
| `gogga-frontend/src/components/toolshed/ToolShedButton.tsx` | Button to open panel (with indicator dot when forced) |
| `gogga-frontend/src/components/toolshed/index.ts` | Component exports |

### Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/tools` | GET | List available tools by tier with category, description, parameters |
| `/api/v1/chat` | POST | Added `force_tool` parameter to TieredChatRequest |

### Force Tool Flow

1. User opens ToolShed panel (Ctrl+Shift+T or header button)
2. User clicks "Force" on a tool card
3. `forcedTool` stored in Zustand: `{ tool, params }`
4. ForcedToolBadge displays above input area
5. Request includes `force_tool: forcedTool?.tool?.name`
6. Backend injects system prompt: `"MANDATORY: You MUST call the '{force_tool}' tool..."`
7. Tool is called and results returned

### Store Methods

```typescript
// toolshedStore.ts
openPanel()      // Open ToolShed panel
closePanel()     // Close ToolShed panel
togglePanel()    // Toggle panel state
fetchTools(tier) // Load tools from backend
forceTool(tool, params) // Set forced tool
clearForcedTool() // Clear forced tool
logExecution(entry) // Add to execution history
```

### Tool Categories

- **Math & Finance**: statistics, financial, probability, sa_tax, conversion
- **Visualization**: create_chart
- **Creative**: generate_image
- **Memory**: remember, recall, forget (JIGGA only)

### ChatClient Integration

```typescript
// Imports
import { ToolShedPanel, ForcedToolBadge, ToolShedButton } from '@/components/toolshed';
import { useToolShed } from '@/lib/toolshedStore';

// Hook usage
const { isOpen, openPanel, closePanel, forcedTool, clearForcedTool } = useToolShed();

// In header (JIVE/JIGGA only)
{tier !== 'FREE' && <ToolShedButton onClick={openPanel} hasForcedTool={!!forcedTool} />}

// Above input
{forcedTool && <ForcedToolBadge tool={forcedTool.tool} onClear={clearForcedTool} />}

// Panel overlay
<ToolShedPanel isOpen={isOpen} onClose={closePanel} tier={tier} />

// Request payload
{ force_tool: forcedTool?.tool?.name }
```