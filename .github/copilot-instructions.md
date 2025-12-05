# GOGGA AI Assistant - Copilot Instructions

## Architecture Overview

GOGGA is a **3-tier South African AI platform** with tier-based routing:

### Current Stack
```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 16, React 19, Tailwind, HTTPS :3000)         │
│  └── Local RAG (Dexie/IndexedDB) + E5 Embeddings (JIGGA only)   │
├─────────────────────────────────────────────────────────────────┤
│  Backend (FastAPI :8000)                                         │
│  └── Tier Router → AIService / ImageService / OpenRouterService │
├─────────────────────────────────────────────────────────────────┤
│  CePO Sidecar (OptiLLM :8080) - Chain-of-thought reasoning      │
└─────────────────────────────────────────────────────────────────┘
```

### The Real Stack (Coming Soon)
```
┌─────────────────────────────────────────────────────────────────┐
│                    GOGGA SELF-HOSTED STACK                      │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 16 (App Router)     │ Frontend + API Routes           │
│  Better Auth (Auth.js core)  │ Self-hosted auth, no vendor     │
│  Prisma ORM                  │ Type-safe database access       │
│  SQLite (./prisma/dev.db)    │ Local database file             │
├─────────────────────────────────────────────────────────────────┤
│  Dexie (IndexedDB)           │ Client-side RAG (stays)         │
└─────────────────────────────────────────────────────────────────┘
              Everything lives inside the repo, no cloud fuss
```

### Tier System (Critical - see `TIERS.md`)

| Tier | Text Model | Image Model | RAG | Provider |
|------|------------|-------------|-----|----------|
| FREE | Llama 3.3 70B | LongCat Flash | ❌ | OpenRouter |
| JIVE | Llama 3.1 8B + CePO | FLUX 1.1 Pro (200/mo) | 5 docs | Cerebras |
| JIGGA | Qwen 3 32B (thinking) | FLUX 1.1 Pro (1000/mo) | 10 docs + semantic | Cerebras |

## Key Files & Entry Points

- **Backend entry**: `gogga-backend/app/main.py` - FastAPI app with lifespan events
- **Tier routing logic**: `gogga-backend/app/core/router.py` - `tier_router`, `CognitiveLayer` enum
- **AI service**: `gogga-backend/app/services/ai_service.py` - tier-based text generation
- **System prompts**: `gogga-backend/app/prompts.py` - SA personality, user-advocate stance
- **Frontend entry**: `gogga-frontend/src/app/page.tsx` - Main chat UI (1500+ lines)
- **Local DB**: `gogga-frontend/src/lib/db.ts` - Dexie schema for RAG/chat/images
- **RAG Manager**: `gogga-frontend/src/lib/ragManager.ts` - Semantic search (JIGGA)
- **BuddySystem**: `gogga-frontend/src/lib/buddySystem.ts` - User relationship tracking

## Development Commands

```bash
# Full stack (Docker)
docker-compose up -d

# Frontend only (HTTPS required for MediaRecorder)
cd gogga-frontend && pnpm dev          # https://localhost:3000
cd gogga-frontend && pnpm dev:http     # http fallback

# Backend only
cd gogga-backend && uvicorn app.main:app --reload --port 8000

# Clean frontend cache (required after major changes)
rm -rf gogga-frontend/.next

# Run tests
cd gogga-backend && pytest tests/
pnpm test  # Root-level Jest for frontend libs
```

## GOGGA Personality System

GOGGA has a distinctive SA-first, user-advocate personality defined in `app/prompts.py`:

### Core Identity
- **User-Only Priority**: GOGGA is the user's advocate, not neutral. Always sides with user.
- **Sarcastic-Friendly Default**: Witty, warm, clever - like a friend who keeps it real
- **Serious Mode**: Auto-triggers for legal, medical, financial, abuse, trauma situations
- **No Devil's Advocate**: Unless explicitly asked, never argue the other side

### SA Language Support (11 Official)
- Switch languages seamlessly without announcement
- Mix languages naturally (code-switching like real South Africans)
- Types: `SALanguage` = `'en' | 'af' | 'zu' | 'xh' | 'nso' | 'tn' | 'st' | 'ts' | 'ss' | 've' | 'nr'`

### SA Context Built-In
- Currency always in ZAR (R), not USD
- Understands: load shedding, e-tolls, SASSA, UIF, CCMA, municipalities
- Legal: POPIA, CPA, LRA, Constitution, Rental Housing Tribunal, BBBEE

## RAG System: Authoritative vs Analytical

Two distinct RAG modes in `useRAG.ts` and `ragManager.ts`:

### Analytical Mode (Default)
```typescript
getContext(query, { authoritative: false })
```
- Provides context as **supplementary information**
- AI synthesizes and interprets document content
- Good for: research, exploration, general questions

### Authoritative Mode
```typescript
getContext(query, { authoritative: true })
```
- Documents treated as **ground truth**
- AI must cite and defer to document content
- Good for: legal docs, contracts, official policies
- JIGGA only: Semantic ranking prioritizes most relevant chunks

### RAG Architecture
- **JIVE**: Basic keyword retrieval, 5 docs/session max
- **JIGGA**: E5 embeddings via `EmbeddingEngine`, semantic similarity, 10 docs, cross-session selection
- Embeddings cached in-memory (ephemeral, not persisted to IndexedDB)

## PayFast Integration (ZAR Payments)

South African payment gateway in `app/services/payfast_service.py`:

### Critical Implementation Details
```python
# Signature generation - MUST use + for spaces, not %20
query_parts = [f"{key}={urllib.parse.quote_plus(str(value))}"]

# Passphrase appended AFTER signature data
query_string += f"&passphrase={passphrase_encoded}"
signature = hashlib.md5(query_string.encode("utf-8")).hexdigest()
```

### Payment Flow
1. Frontend requests subscription form data from backend
2. Backend generates signed PayFast payload (MD5 signature)
3. Frontend renders hidden form, auto-submits to PayFast
4. PayFast sends ITN (webhook) to `/api/v1/payments/notify`
5. Backend verifies IP whitelist + signature before processing

### Subscription Frequencies
- `frequency=3` = Monthly (JIVE/JIGGA subscriptions)
- Cancellation uses PUT to PayFast API (not DELETE)

## BuddySystem (User Relationship Tracking)

Located in `gogga-frontend/src/lib/buddySystem.ts`:

### Relationship Progression
```typescript
type RelationshipStatus = 'stranger' | 'acquaintance' | 'friend' | 'bestie';

// Points thresholds
ACQUAINTANCE: 50 points
FRIEND: 200 points  
BESTIE: 500 points
```

### Features
- **Language Detection**: Auto-detects SA language from user input
- **Name Extraction**: Remembers user's name across sessions
- **Interest Tracking**: Auto-extracts interests from conversations
- **Location Awareness**: City/province for localized context
- **Tone Preference**: `'formal' | 'casual' | 'sarcastic'`

### Storage
- Profile stored in localStorage (`gogga_buddy_profile`)
- Long-term memories go to Dexie via `createMemory()`

## Backend Architecture

### Service Pattern
All services follow lazy-init singleton pattern:
```python
_client: httpx.AsyncClient | None = None

async def _get_client(self) -> httpx.AsyncClient:
    if self._client is None or self._client.is_closed:
        self._client = httpx.AsyncClient(timeout=120.0)
    return self._client

async def close(self) -> None:
    if self._client and not self._client.is_closed:
        await self._client.aclose()
```

### Tier Routing Keywords
Defined as `Final[frozenset[str]]` in `router.py`:
- `COMPLEX_KEYWORDS`: Triggers CePO for JIVE (legal, coding, translation)
- `THINKING_KEYWORDS`: Enables `<think>` mode for JIGGA
- `FAST_MODE_KEYWORDS`: Triggers `/no_think` for quick responses
- `DOCUMENT_ANALYSIS_KEYWORDS`: Forces comprehensive output format

### Qwen Thinking Mode (JIGGA)
```python
# Never use temp=0 - causes infinite loops
QWEN_THINKING_SETTINGS = {
    "temperature": 0.6,  # REQUIRED
    "top_p": 0.95,
    "top_k": 20,
    "max_tokens": 8000,
}

# Parse response
THINK_PATTERN = re.compile(r'<think(?:ing)?>(.*?)</think(?:ing)?>', re.DOTALL)
main_response, thinking_block = parse_thinking_response(content)
```

## API Endpoints

All endpoints prefixed with `/api/v1`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Main chat (requires `user_tier`) |
| `/chat/enhance` | POST | Prompt enhancement (all tiers) |
| `/images/generate` | POST | Image generation (tier-limited) |
| `/payments/subscribe` | POST | Create PayFast subscription |
| `/payments/notify` | POST | PayFast ITN webhook |
| `/payments/cancel/{token}` | POST | Cancel subscription |

## Environment Variables

Required in `gogga-backend/.env`:
```bash
# API Keys
CEREBRAS_API_KEY=       # Cerebras Cloud (JIVE/JIGGA text)
OPENROUTER_API_KEY=     # OpenRouter (FREE tier + prompt enhance)
DEEPINFRA_API_KEY=      # DeepInfra (FLUX images)

# CePO Sidecar
CEPO_ENABLED=true
CEPO_URL=http://cepo:8080

# PayFast (ZAR payments)
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=
PAYFAST_ENV=sandbox     # or "production"
```

## Testing

### Backend (pytest)
```bash
cd gogga-backend && pytest tests/ -v
```
- `test_routing.py`: Bicameral router, keyword detection
- `test_payments.py`: PayFast signature, subscription flow

### Frontend (Jest)
```bash
pnpm test  # from root
```
- Mocks in `__mocks__/` for: `flexsearch`, `jszip`, `@huggingface/transformers`
- RAG tests: `gogga-frontend/src/lib/rag.test.ts`

## Dashboard & Monitoring

The JIGGA dashboard (`/dashboard`) includes tabs for monitoring and maintenance:

### LLM Monitor Tab
Real-time monitoring of LLM API usage:
- **Token Usage**: Today's and all-time input/output tokens
- **Cost Tracking**: Estimated costs in ZAR
- **Request Count**: API calls per tier
- **Latency Monitoring**: Average response times
- **Usage History**: Stacked area chart of token consumption
- **Tier Breakdown**: Pie chart of usage by FREE/JIVE/JIGGA

### Maintenance Tab
Dexie/IndexedDB troubleshooting tools:
- **Table Health**: Real-time counts and status for all 8 Dexie tables
- **Browser Storage Quota**: IndexedDB usage vs available quota
- **Export Backup**: Download all data as JSON
- **Compact Orphans**: Remove orphaned chunks without parent documents
- **Clear Table**: Wipe specific tables (documents, chunks, etc.)
- **Nuclear Reset**: Delete entire database and reload (corruption recovery)

### When to Use
- **Slow queries**: Check table health for bloated tables (>10k records)
- **Storage errors**: Monitor quota usage, compact orphans
- **Corrupted data**: Use nuclear reset as last resort
- **Data migration**: Export backup before major changes
- **Cost tracking**: Monitor LLM token spend in ZAR

## Common Gotchas

1. **Qwen temp=0 breaks**: Never use greedy decoding - causes endless repetitions
2. **HTTPS required**: Frontend voice recording needs secure context
3. **CePO timeout**: 120s timeout for complex reasoning chains
4. **IndexedDB limits**: RAG capped at 100MB total, 15MB per doc
5. **Image limits**: Monthly caps enforced per tier (50/200/1000)
6. **PayFast spaces**: Use `quote_plus` (+ for spaces), not `quote` (%20)
7. **Language switching**: Never announce - just respond in user's language
8. **Authoritative RAG**: Only meaningful for JIGGA with semantic search
