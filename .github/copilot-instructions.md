# GOGGA AI Assistant - Copilot Instructions

## Architecture: 3-Tier SA AI Platform

```
Frontend (Next.js 16 :3000)  →  Backend (FastAPI :8000)  →  CePO (OptiLLM :8080)
     │ Dexie/IndexedDB                 │ Tier Router
     └─ Client RAG                     └─ AI/Image Services
```

### Dual Database Strategy
- **SQLite (Prisma)**: Server-side auth & subscriptions (`gogga-frontend/prisma/schema.prisma`)
- **Dexie (IndexedDB)**: Client-side chat, RAG, images (`gogga-frontend/src/lib/db.ts`)

### Tier Routing (`gogga-backend/app/core/router.py`)
| Tier | Text Model | Image | Provider |
|------|------------|-------|----------|
| FREE | Llama 3.3 70B | LongCat Flash (50/mo) | OpenRouter |
| JIVE | Llama 3.1 8B + CePO | FLUX 1.1 Pro (200/mo) | Cerebras |
| JIGGA | Qwen 3 32B think/no_think | FLUX 1.1 Pro (1000/mo) | Cerebras |

## Key Entry Points

| Area | File | Notes |
|------|------|-------|
| Backend API | `gogga-backend/app/main.py` | FastAPI lifespan events |
| Tier Router | `gogga-backend/app/core/router.py` | Keyword-based routing logic |
| AI Service | `gogga-backend/app/services/ai_service.py` | Cerebras/OpenRouter integration |
| System Prompts | `gogga-backend/app/prompts.py` | SA personality, identity firewall |
| Frontend Entry | `gogga-frontend/src/app/page.tsx` | Imports ChatClient, session handling |
| Frontend Chat | `gogga-frontend/src/app/ChatClient.tsx` | Main chat UI (~1500 lines) |
| Auth Config | `gogga-frontend/src/auth.ts` | NextAuth v5 passwordless tokens |
| RAG System | `gogga-frontend/src/lib/ragManager.ts` | E5 embeddings (JIGGA only) |
| BuddySystem | `gogga-frontend/src/lib/buddySystem.ts` | User relationship tracking |

## RAG System: Authoritative vs Analytical

```typescript
// Analytical (default) - AI synthesizes document content
getContext(query, { authoritative: false })

// Authoritative - Documents as ground truth, must cite (JIGGA only)
getContext(query, { authoritative: true })
```
- **JIVE**: Keyword retrieval, 5 docs/session max
- **JIGGA**: E5 semantic embeddings, 10 docs, cross-session selection

## BuddySystem (User Relationship)

```typescript
type RelationshipStatus = 'stranger' | 'acquaintance' | 'friend' | 'bestie';
// Thresholds: 50 → acquaintance, 200 → friend, 500 → bestie
```
- Detects SA language, extracts name/interests/location
- Profile in localStorage (`gogga_buddy_profile`), memories in Dexie

## API Endpoints (all `/api/v1`)

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/chat` | POST | Main chat (requires `user_tier`) |
| `/chat/enhance` | POST | Prompt enhancement (all tiers) |
| `/images/generate` | POST | Tier-limited image gen |
| `/payments/subscribe` | POST | PayFast subscription |
| `/payments/notify` | POST | PayFast ITN webhook |

## Development Commands

```bash
docker-compose up -d                              # Full stack
cd gogga-frontend && pnpm dev                     # HTTPS frontend (voice recording)
cd gogga-frontend && pnpm dev:http                # HTTP fallback
cd gogga-backend && uvicorn app.main:app --reload # Backend only
rm -rf gogga-frontend/.next                       # Clean frontend cache

# Testing
cd gogga-backend && pytest tests/ -v              # Backend tests
pnpm test                                         # Jest (root) - RAG tests
```

## Critical Patterns

### Backend Service Pattern (lazy singleton)
```python
_client: httpx.AsyncClient | None = None
async def _get_client(self) -> httpx.AsyncClient:
    if self._client is None or self._client.is_closed:
        self._client = httpx.AsyncClient(timeout=120.0)
    return self._client
```

### Qwen Thinking Mode - NEVER use temp=0
```python
QWEN_THINKING_SETTINGS = {"temperature": 0.6, "top_p": 0.95, "top_k": 20}
THINK_PATTERN = re.compile(r'<think(?:ing)?>(.*?)</think(?:ing)?>', re.DOTALL)
```

### PayFast Signature (ZAR payments)
```python
# MUST use quote_plus (+ for spaces), not quote (%20)
query_parts = [f"{key}={urllib.parse.quote_plus(str(value))}"]
query_string += f"&passphrase={passphrase_encoded}"
signature = hashlib.md5(query_string.encode("utf-8")).hexdigest()
```

### Keyword Routing (`router.py` frozensets)
- `COMPLEX_KEYWORDS`: Legal/coding → CePO for JIVE
- `THINKING_KEYWORDS`: Deep analysis → `<think>` mode for JIGGA
- `FAST_MODE_KEYWORDS`: Quick responses → `/no_think` for JIGGA
- `EXTENDED_OUTPUT_KEYWORDS`: Long-form requests → 8000 tokens

## SA-Specific Requirements

- **Currency**: Always ZAR (R), never USD
- **Languages**: 11 official - switch seamlessly, never announce
- **Context**: Load shedding, SASSA, CCMA, POPIA, CPA, LRA, BBBEE
- **Personality**: User-advocate (not neutral), sarcastic-friendly default
- **Serious Mode**: Auto-triggers for legal/medical/financial/abuse topics

## Common Gotchas

1. **Qwen temp=0** causes infinite loops - always use 0.6+
2. **HTTPS required** for frontend voice recording (MediaRecorder API)
3. **CePO timeout** is 120s for complex reasoning chains
4. **IndexedDB limits**: 100MB total, 15MB per document
5. **Image limits**: Monthly caps enforced per tier
6. **Clean .next** after major frontend changes: `rm -rf gogga-frontend/.next`

## Testing Files

- `gogga-backend/tests/test_routing.py` - Tier router, keyword detection
- `gogga-backend/tests/test_payments.py` - PayFast signature verification
- `gogga-frontend/src/lib/rag.test.ts` - RAG chunking/search tests
- Root `__mocks__/` for: `flexsearch`, `jszip`, `@huggingface/transformers`
