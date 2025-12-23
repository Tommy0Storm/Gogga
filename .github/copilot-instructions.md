# GOGGA AI Assistant - Copilot Instructions

## MCP Tools (MANDATORY)

> **Check Serena memories first** (`#oraios/serena`) - `.serena/memories/` has 50+ project docs
> **Use context7** (`#context7`) for external library docs (Next.js, FastAPI, RxDB, etc.)

## Architecture: SA AI Platform (Dec 2025)

### Distributed Infrastructure
```
Dell Latitude 5520 (VS Code, 192.168.0.x)
     │ SSH
     ├──────────────────────────────────┐
     ▼                                  ▼
MAC-1 PRIMARY (192.168.0.130)        MAC-2 WORKER (192.168.0.198)
├─ Frontend (:3000)                  ├─ CePO (:8080)
├─ Backend (:8000)    ◄─── NFS ────► ├─ DEV-Drive (NFS)
├─ Admin (:3100)       Docker ctx    └─ cAdvisor (:8081)
└─ Proxy (:3001)       ──────────►
```
**Hardware**: 2x Mac Mini (8GB RAM, Ubuntu) with fast NVMe (430MB/s read, 200+MB/s write)
**CePO Sidecar**: OptiLLM with `re2&cot_reflection` approach (Cerebras-compatible)
**Worker Control**: `docker --context gogga-worker ps` from primary
**Shared Storage**: `/mnt/dev-drive` ↔ `/home/hybridwolvin/DEV-Drive`

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
| JIVE (R49) | Qwen 32B | Qwen 235B | Imagen 3.0 (200/mo) | Cerebras |
| JIGGA (R149) | Qwen 32B | Qwen 235B | Imagen 3.0 (1000/mo) | Cerebras |

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
| **Distributed Setup** | `infra/distributed/` |

## Development Commands

```bash
docker-compose up -d                              # Full stack
cd gogga-frontend && pnpm dev                     # HTTPS frontend (voice)
cd gogga-frontend && pnpm dev:http                # HTTP fallback
cd gogga-backend && uvicorn app.main:app --reload # Backend only
rm -rf gogga-frontend/.next                       # Clean cache (required often!)

# Testing
cd gogga-backend && pytest tests/ -v              # Backend (132 tests: 69 original + 63 router)
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
8. **Docker node_modules** → NEVER mount as volume (native modules break)
9. **Docker frontend** → use local dev (`pnpm dev:http`), Docker watch mode flaky
10. **CePO Cerebras** → no `reasoning_effort`, no `n>1` (use `re2&cot_reflection`)
11. **Prisma 7 relations** → Use PascalCase: `include: { Subscription: true }`, NOT `subscription`
12. **Tailwind v4 CSS vars** → Use `bg-(--var-name)` NOT `bg-[var(--var-name)]`
13. **Next.js rewrites + self-signed certs** → Use API routes with `https.Agent({ rejectUnauthorized: false })`
14. **EmailJS env vars** → Use `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` (not hardcoded)
15. **Bug button position** → `bottom-4 left-4` (avoid overlap with admin gear at `bottom-4 right-4`)

## Docker Best Practices (CRITICAL)

### ⚠️ NEVER mount node_modules as a volume!
Native modules (better-sqlite3, sharp) compile platform-specific binaries.
Volume mounts overwrite container binaries with incompatible host binaries.

### ⚠️ Next.js rewrites DON'T work with self-signed HTTPS!
Use API routes with custom `https.Agent` instead:

```typescript
// src/app/api/v1/tools/route.ts
import https from 'https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Use native https module, NOT fetch()
const req = https.request({
  hostname: 'backend',
  port: 8000,
  path: '/api/v1/tools',
  agent: httpsAgent,
}, callback);
```

```yaml
# ❌ WRONG - causes "bindings file not found" errors
volumes:
  - ./app:/app
  - node_modules:/app/node_modules

# ✅ CORRECT - use Docker Compose watch
develop:
  watch:
    - action: sync
      path: ./app/src
      target: /app/src
      ignore:
        - node_modules/
    - action: rebuild
      path: ./app/package.json
```

### Recommended Dev Workflow
```bash
# Frontend - LOCAL (faster, more reliable)
cd gogga-frontend && pnpm dev:http

# Backend/Admin - Docker is fine
docker compose up -d backend admin cepo
```

## Key Memories (`.serena/memories/`)

| Memory | Content |
|--------|---------|
| `architecture.md` | Tier routing, math delegation, audit summary |
| `enterprise_audit_dec2025.md` | **NEW** Full security & performance audit |
| `tech_stack.md` | Dependencies, versions |
| `prisma7_compatibility.md` | PascalCase relations, exactOptionalPropertyTypes |
| `rxdb_implementation.md` | RxDB schemas, vector search, migrations |
| `network_configuration.md` | LAN IP auto-detection, Next.js 16 bug workaround |
| `gogga_smart.md` | Self-improving AI, skill management |
| `optillm_enhancements.md` | SPL, Re-Read, CoT, Planning |
| `cepo_configuration.md` | CePO sidecar, Cerebras-compatible approaches |
| `docker_best_practices.md` | node_modules anti-pattern, Compose watch |
| `distributed_infrastructure.md` | Two-server setup, NFS, Docker contexts |
| `authentication_system.md` | NextAuth v5 passwordless flow |
| `subscription_system.md` | Tiers, credits, PayFast integration |
| `persona.md` | BuddySystem, SA personality |
| `payfast_integration.md` | Payment signature, webhooks |
| `tool_calling.md` | Math tools, executor |

## Security Audit Findings (Dec 2025)

> **CRITICAL**: See `enterprise_audit_dec2025.md` for full audit report

### Immediate Action Required
1. **Rotate ALL API keys** - .env was committed with live keys
2. **Implement JWT signing** - Current tokens are base64 only (no signature)
3. **Protect admin endpoints** - `/admin/*` routes have no authentication
4. **Fix tier bypass** - X-User-Tier header trusted without validation

### Security Best Practices
```python
# ❌ NEVER - accepts any string as valid
async def validate_api_key(api_key: str) -> str:
    if not api_key:
        raise HTTPException(status_code=401)
    return api_key  # No actual validation!

# ✅ CORRECT - validate against stored hashed keys
async def validate_api_key(api_key: str) -> str:
    hashed = hash_api_key(api_key)
    stored = await db.api_keys.find_one({"hash": hashed})
    if not stored or stored.revoked:
        raise HTTPException(status_code=401)
    return api_key
```

## Performance Optimization (Dec 2025)

### Quick Wins
1. **Increase ThreadPoolExecutor** to 64 workers for Cerebras SDK
2. **Add request idempotency cache** to prevent duplicate LLM calls
3. **Skip local OptiLLM** when routing to CePO (avoid double processing)
4. **Remove manual useCallback/useMemo** where React Compiler handles it

### Pattern Matching Optimization
```python
# ❌ SLOW - O(n*m) multiple iterations
def contains_pattern(message: str) -> bool:
    return any(p in message.lower() for p in 80_PATTERNS)

# ✅ FAST - O(n) Aho-Corasick
import ahocorasick
_automaton = ahocorasick.Automaton()
for p in ALL_PATTERNS:
    _automaton.add_word(p, p)
_automaton.make_automaton()

def find_patterns(message: str) -> set[str]:
    return {m[1] for m in _automaton.iter(message.lower())}
```
