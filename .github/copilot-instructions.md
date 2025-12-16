# GOGGA AI Assistant - Copilot Instructions

## MCP Tools (MANDATORY)

> **Check Serena memories first** (`#oraios/serena`) - `.serena/memories/` has 50+ project docs
> **Use context7** (`#context7`) for external library docs (Next.js, FastAPI, RxDB, etc.)

## Architecture: SA AI Platform (Dec 2025)

```
Frontend (Next.js 16 :3000)  →  Backend (FastAPI :8000)
     │ RxDB/IndexedDB                  │ Tier Router
     └─ Client RAG                     └─ AI/Image Services
```
**Note**: CePO sidecar REMOVED - OptiLLM enhancements now in `optillm_enhancements.py`

### Dual Database Strategy
- **SQLite (Prisma 7)**: Server-side auth & subscriptions (`gogga-frontend/prisma/schema.prisma`)
- **RxDB (IndexedDB)**: Client-side chat, RAG, images, GoggaSmart (`gogga-frontend/src/lib/db.ts`)
  - **Dexie is DEPRECATED** - legacy backup at `db-dexie-legacy.ts`
  - Use `generateId()` for RxDB primary keys
  - All Date fields must use `.toISOString()` (RxDB requires JSON-serializable data)

### Tier Routing (`gogga-backend/app/core/router.py`)
| Tier | Default Model | Complex/Legal Model | Image | Provider |
|------|---------------|---------------------|-------|----------|
| FREE | Qwen 235B | Qwen 235B | Pollinations (50/mo) | OpenRouter |
| JIVE (R49) | Qwen 32B | Qwen 235B | FLUX 1.1 Pro (200/mo) | Cerebras |
| JIGGA (R149) | Qwen 32B | Qwen 235B | FLUX 1.1 Pro (1000/mo) | Cerebras |

**JIVE & JIGGA are IDENTICAL in features** - only token/image limits differ.

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Next.js + Turbopack | 16.0.10 |
| React | React 19 | 19.2.3 |
| Styling | Tailwind CSS | 4.1.17 |
| Auth | NextAuth | 5.0.0-beta.30 |
| Client DB | RxDB | 16.21.1 |
| Backend | FastAPI (Python) | 3.14 |

## Key Entry Points

| Area | File |
|------|------|
| Tier Router | `gogga-backend/app/core/router.py` |
| AI Service | `gogga-backend/app/services/ai_service.py` |
| OptiLLM | `gogga-backend/app/services/optillm_enhancements.py` |
| Math Tools | `gogga-backend/app/tools/math_definitions.py` |
| Config | `gogga-backend/app/config.py` |
| Frontend Chat | `gogga-frontend/src/app/ChatClient.tsx` |
| Client DB | `gogga-frontend/src/lib/db.ts` (RxDB - NOT Dexie) |
| RxDB Schemas | `gogga-frontend/src/lib/rxdb/schemas.ts` |
| RAG Manager | `gogga-frontend/src/lib/ragManager.ts` |
| BuddySystem | `gogga-frontend/src/lib/buddySystem.ts` |
| GoggaSmart | `gogga-frontend/src/lib/goggaSmart.ts` |

## Development Commands

```bash
docker-compose up -d                              # Full stack
cd gogga-frontend && pnpm dev                     # HTTPS frontend (voice)
cd gogga-frontend && pnpm dev:http                # HTTP fallback
cd gogga-backend && uvicorn app.main:app --reload # Backend only
rm -rf gogga-frontend/.next                       # Clean cache (required often!)

# Testing
cd gogga-backend && pytest tests/ -v              # Backend (69 tests)
```

**Dev URLs** (local dev, LAN IP auto-detected):
- Frontend: `https://192.168.0.130:3000` (run `pnpm dev` - auto-detects LAN IP)
- Backend: `http://localhost:8000`
- Admin: `https://192.168.0.130:3000?admin=true` (or `Ctrl+Shift+A`)

## Critical Patterns

### Qwen Thinking Mode - NEVER use temp=0
```python
# temp=0 causes infinite loops! Always use 0.6+
QWEN_THINKING_SETTINGS = {"temperature": 0.6, "top_p": 0.95, "top_k": 20}
```

### OptiLLM Enhancement Tiers
| Tier | Techniques |
|------|------------|
| FREE | SPL, Re-Read |
| JIVE | + CoT Reflection |
| JIGGA | + Planning, Empathy |

### 235B Triggers (keyword routing)
- **Complex**: `constitutional`, `legal`, `compliance`, `litigation`
- **Extended output**: `comprehensive analysis`, `detailed report`
- **African languages**: Zulu, Xhosa, Sotho, Tswana auto-route to 235B

### Backend Service Pattern (lazy singleton)
```python
_client: httpx.AsyncClient | None = None
async def _get_client(self) -> httpx.AsyncClient:
    if self._client is None or self._client.is_closed:
        self._client = httpx.AsyncClient(timeout=120.0)
    return self._client
```

### PayFast Signature (ZAR payments)
```python
# MUST use quote_plus (+ for spaces), not quote (%20)
query_parts = [f"{key}={urllib.parse.quote_plus(str(value))}"]
signature = hashlib.md5(query_string.encode("utf-8")).hexdigest()
```

## SA-Specific Requirements

- **Currency**: Always ZAR (R), never USD
- **Languages**: 11 official - switch seamlessly, never announce
- **Context**: Load shedding, SASSA, CCMA, POPIA, CPA, LRA, BBBEE
- **Personality**: User-advocate (not neutral), sarcastic-friendly default
- **Serious Mode**: Auto-triggers for legal/medical/financial/abuse

## Code Style

### Python (Backend)
- Type hints required on all functions
- Google-style docstrings
- Custom exceptions inherit `GoggaException`
- async/await for all I/O

### TypeScript (Frontend)
- `'use client'` for client components
- Tailwind only (monochrome palette: `primary-50` to `primary-950`)
- Icons: Lucide React, black only
- Font: Quicksand (400, 700)

## Common Gotchas

1. **Qwen temp=0** → infinite loops (use 0.6+)
2. **HTTPS required** for voice recording (MediaRecorder API)
3. **Clean .next** after major changes: `rm -rf gogga-frontend/.next`
4. **Next.js 16 LAN bug** → bind to specific IP (auto-detected by `pnpm dev`)
5. **RxDB Date fields** → use `.toISOString()`, not `new Date()` objects
6. **RxDB primary keys** → use `generateId()` from `db.ts` for `id` field
7. **IndexedDB limits**: 100MB total, 15MB per document

## Key Memories (`.serena/memories/`)

| Memory | Content |
|--------|---------|
| `architecture.md` | Tier routing, math delegation |
| `tech_stack.md` | Dependencies, versions |
| `rxdb_implementation.md` | RxDB schemas, vector search, migrations |
| `network_configuration.md` | LAN IP auto-detection, Next.js 16 bug workaround |
| `gogga_smart.md` | Self-improving AI, skill management |
| `optillm_enhancements.md` | SPL, Re-Read, CoT, Planning |
| `persona.md` | BuddySystem, SA personality |
| `payfast_integration.md` | Payment signature, webhooks |
| `tool_calling.md` | Math tools, executor |
