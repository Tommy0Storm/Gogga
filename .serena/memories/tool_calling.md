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

### save_memory
Saves information to long-term memory (IndexedDB).

```json
{
  "name": "save_memory",
  "parameters": {
    "title": "Short title (max 100 chars)",
    "content": "Detailed content (max 10000 chars)",
    "category": "personal | project | reference | custom",
    "priority": 1-10
  }
}
```

- Source is automatically set to `'gogga'` (AI-created)
- User memories (source='user') cannot be deleted by AI

### delete_memory
Deletes GOGGA-created memories.

```json
{
  "name": "delete_memory", 
  "parameters": {
    "memory_title": "Title to match (partial match)",
    "reason": "Brief reason for deletion"
  }
}
```

- Can only delete memories where `source === 'gogga'`
- User-created memories are protected

## API Changes

### Request (unchanged)
```json
POST /api/v1/chat
{
  "message": "Remember my name is John",
  "user_id": "...",
  "user_tier": "jigga"
}
```

### Response (extended)
```json
{
  "response": "I'll remember that your name is John!",
  "tool_calls": [
    {
      "id": "call_abc123",
      "name": "save_memory",
      "arguments": {
        "title": "User name is John",
        "content": "The user's name is John. Always address them by name.",
        "category": "personal",
        "priority": 9
      }
    }
  ],
  "meta": {
    "has_tool_calls": true,
    "tier": "jigga",
    ...
  }
}
```

## Tier Restrictions

| Tier | Tool Calling |
|------|-------------|
| FREE | ❌ Disabled |
| JIVE | ❌ Disabled |
| JIGGA | ✅ Enabled |

## Cerebras Tool Calling Notes

- Uses OpenAI-compatible `tools` parameter
- Set `"strict": True` in function schema
- Set `parallel_tool_calls: False` for sequential execution
- llama-3.3-70b has multi-turn issues (use qwen-3-32b for JIGGA)

## Frontend Execution Flow

1. ChatClient.tsx receives `data.tool_calls` array
2. Calls `executeToolCalls()` from toolHandler.ts
3. Each tool executes against IndexedDB
4. For name memories, toolHandler deletes old name memories first
5. Results appended to message content
6. `meta.tools_executed = true` flag set

## SPOT Architecture (Single Point of Truth)

- **Dexie (IndexedDB)** is the SPOT for user data
- BuddySystem reads name from Dexie memories via `getUserName()`
- BuddySystem no longer creates memories on name detection (removed from `processUserMessage`)
- Only tool calling or explicit user action in Dashboard creates memories
- This prevents race conditions between regex detection and AI tool calls
