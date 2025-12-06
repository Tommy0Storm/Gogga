# GOGGA Tool Calling Implementation

## Last Updated
December 6, 2025

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
- `gogga-backend/app/services/ai_service.py` - Tool calling integration

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

| Tier | Memory | Image | Chart |
|------|--------|-------|-------|
| FREE | ❌ | ✅ (via endpoint) | ❌ |
| JIVE | ❌ | ✅ | ✅ |
| JIGGA | ✅ | ✅ | ✅ |

Note: FREE tier doesn't have tool calling via Cerebras (uses OpenRouter), but can still use the /api/v1/images endpoint.