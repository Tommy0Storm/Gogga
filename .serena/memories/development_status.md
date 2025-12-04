# GOGGA Development Status

## Last Updated: December 3, 2025 (RAG Fixes + CePO Update)

## 🔧 Latest Updates (Dec 3, 2025)

### UI/UX Improvements (Latest Session)

**Token Tracking System:**
- Added `TokenUsage` interface to Dexie (db.ts, schema v3)
- Created `useTokenTracking` hook for persistence and display
- Header shows all-time token count with # icon
- Tracks input/output tokens per tier, daily aggregation
- Functions: `trackTokenUsage()`, `getTodayTokenUsage()`, `getTotalTokenUsage()`

**Admin Mode:**
- **Shortcuts: Ctrl+Shift+A or Ctrl+Alt+A** (Fn key cannot be detected - hardware-level)
- Alternative: Add `?admin=true` to URL
- PromptManager now only visible in admin mode
- Uses event capture phase for reliable keyboard detection

**Error Handling:**
- Added `error.tsx` and `global-error.tsx` for Next.js error boundaries

**Styling:**
- GoggaLogo animated variant: White (#FFFFFF) background circle
- Quicksand font: Minimum 400 weight enforced in globals.css
- Monochrome theme maintained

**GOGGA Personality Overhaul (Dec 3):**
- USER-FIRST PRIORITY: User is #1 and ONLY priority, never play devil's advocate
- TRULY LOCAL: SA currency (Rands), services (SASSA, UIF, CCMA), realities (load shedding, e-tolls)
- SARCASTIC-FRIENDLY: Witty, warm, wonderfully sarcastic by default
- SERIOUS MODE: Auto-disables sarcasm for legal, medical, financial, trauma situations
- User can override with "be serious" or "no jokes"
- Updated: CEPO_IDENTITY_PROMPT, QWEN_IDENTITY_PROMPT, GOGGA_BASE_PROMPT

**Thinking Block (JIGGA Tier):**
- Collapsible UI with Brain icon
- Backend THINK_PATTERN supports both `<think>` and `<thinking>` tags
- Frontend fallback extraction if backend doesn't parse

**Comprehensive Document Mode (Dec 3):**
- Auto-detects analysis/report/document requests via keywords
- Appends structured output instruction to message
- Applies to JIVE CePO and JIGGA thinking modes
- Generic format: Executive Summary, Analysis, Recommendations, Risks, Conclusion
- User's explicit format requests ALWAYS override defaults
- Keywords: analyze, report, document, assessment, proposal, brief, etc.

### RAG System Fixes

**Fixed Issues:**
1. RAG not finding selected documents from other sessions
   - Fix: Changed condition to check both `documents.length` and `selectedDocIds.length`

2. Selected documents not being indexed for search
   - Fix: Added `indexExternalDocument()` function in rag.ts

3. Moved "Browse Docs" button to RAG sidebar

### CePO Status

**Issue:** OptiLLM adds `reasoning_effort` parameter that Cerebras doesn't support.
- **Workaround:** Use direct Cerebras API calls
- **Model for CePO:** `llama3.3-70b` at 2,000 tokens/s

## Tier-Based Architecture

| Tier | Text Model | Speed | Image Generator |
|------|------------|-------|-----------------|
| FREE | OpenRouter Llama 3.3 70B | Standard | LongCat Flash |
| JIVE | Cerebras Llama 3.1 8B (+CePO) | ~2,200 t/s | FLUX 1.1 Pro |
| JIGGA | Cerebras Qwen 3 235B | ~1,400 t/s | FLUX 1.1 Pro |

**CePO Model:** `llama3.3-70b` at 2,000 reasoning tokens/s

## 🚀 Running Services

| Container | Service | Port | Status |
|-----------|---------|------|--------|
| gogga_ui | Frontend (Next.js) | 3000 | ✅ Running |
| gogga_api | Backend (FastAPI) | 8000 | ✅ Healthy |
| gogga_cepo | CePO (optillm) | 8080 | ⚠️ Has issues |

## API Endpoints

- `POST /api/v1/chat` - Tier-based text chat
- `POST /api/v1/chat/enhance` - Universal prompt enhancement
- `GET /api/v1/prompts/` - List all prompts
- `GET /api/v1/prompts/{key}` - Full prompt detail
- `POST /api/v1/images/generate` - Image generation

## ✅ Completed Features

- [x] Centralized system prompts with SA cultural context
- [x] 11 SA language support with seamless switching
- [x] Local RAG with FlexSearch (per-session + cross-session selection)
- [x] Admin Panel (Ctrl+Alt+A or ?admin=true)
- [x] Prompt Manager (Admin mode only)
- [x] Token tracking with Dexie persistence
- [x] Collapsible thinking blocks for JIGGA
- [x] Monochrome UI theme with Quicksand font

## 🔜 Pending

- [ ] Fix CePO OptiLLM reasoning_effort issue
- [ ] Azure Container Apps deployment
- [ ] User authentication
- [ ] Redis session caching
