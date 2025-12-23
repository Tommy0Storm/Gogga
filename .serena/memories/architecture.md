# GOGGA Architecture Details

## Distributed Infrastructure (Dec 2025)

GOGGA runs across **two Ubuntu servers** for optimized resource allocation:

| Server | IP | Role | Services |
|--------|-----|------|----------|
| **Primary** | 192.168.0.130 | Main stack, VS Code host | Frontend, Backend, Admin, Proxy |
| **Worker** | 192.168.0.198 | AI workloads, shared storage | CePO, cAdvisor, NFS DEV-Drive |

Windows VS Code connects to **Primary only** (10.0.0.1 → 192.168.0.130 via SSH).
Primary controls Worker via Docker context (`tcp://192.168.0.129:2376`).

See `.serena/memories/distributed_infrastructure.md` for full setup details.

---

## Storage Architecture (Dual-Database)

GOGGA uses **two separate databases** that never connect directly:

| Database | Purpose | Scope | Persistence |
|----------|---------|-------|-------------|
| **SQLite** (Prisma 7) | Identity & billing | Server instance | Until deleted |
| **RxDB** (IndexedDB) | User content | Per-browser, per-device | User controlled |

### SQLite ↔ RxDB Correlation (Dec 2025 Audit)

**Key Finding**: The two databases are intentionally separate with minimal correlation:

| Data Type | SQLite (Server) | RxDB (Client) | Sync Method |
|-----------|-----------------|---------------|-------------|
| User Identity | `User.id` (cuid) | `userId` field | Via NextAuth session |
| Tier | `Subscription.tier` | `localStorage.gogga_tier` | Session callback refresh |
| Usage Tokens | `Usage`, `UsageSummary` | `tokenUsage` | Dual-write (both updated) |
| Chat History | ❌ None | `chatSessions`, `chatMessages` | Client-only |
| RAG Docs | ❌ None | `documents`, `documentChunks` | Client-only |
| Credits | `Subscription.credits` | ❌ None | Server authoritative |
| Admin State | `User.isAdmin` | ❌ None | Server-only |

**Session ID Formats** (Consolidated Dec 24, 2025):
- Format: `session-{base36_timestamp}-{random}` 
- Canonical implementation: `lib/db.ts:generateSessionId()`
- RxDB mirrors same format for consistency

**Tier Sync Flow**:
1. User logs in → JWT contains tier from `Subscription`
2. Session callback (`auth.ts:197-207`) fetches fresh tier from DB
3. Client stores in `localStorage.gogga_tier`
4. RxDB documents use tier from localStorage

### SQLite (Server-Side)
- User identity (email, id)
- Login tokens (magic links)
- Auth logs (connection audit)
- Subscriptions (tier, status, PayFast token)
- Usage tracking (tokens, costs, billing)
- Admin features (vouchers, adjustments)

### RxDB (Client-Side, Per-User-Per-Device) - Dec 2025 Migration
**Primary:** `lib/db.ts` - RxDB shim with Dexie API compatibility
**Backup:** `lib/db-dexie-legacy.ts` - Original Dexie implementation

Collections:
- Chat sessions & messages
- RAG documents & chunks (with session-scoped activeSessions[])
- Generated images
- User preferences
- Memory contexts (authoritative facts)
- GoggaSmart skills
- Token usage tracking
- RAG metrics & system logs

---

## Tier-Based Cognitive Routing (Dec 2025 - UNIFIED QWEN)

### CRITICAL: JIVE and JIGGA are IDENTICAL in features
Only difference: monthly token/image limits

| Tier | General/Chat/Math | Complex/Legal/Extended | Images |
|------|-------------------|------------------------|--------|
| FREE | OpenRouter Qwen 235B FREE | OpenRouter Qwen 235B FREE | Pollinations (50/mo) |
| JIVE | Cerebras Qwen 32B | Cerebras Qwen 235B | Imagen 3.0 (200/mo) |
| JIGGA | Cerebras Qwen 32B | Cerebras Qwen 235B | Imagen 3.0 (1000/mo) |

### 235B Triggers (JIVE and JIGGA)
- **Complex keywords**: constitutional, legal, compliance, statutory, litigation, etc.
- **Extended output**: comprehensive analysis, detailed report, thorough review, etc.
- **African languages**: Zulu, Xhosa, Sotho, Tswana, Venda, Tsonga, etc.

### CePO/OptiLLM Status (Dec 2025)
- **CePO sidecar**: ACTIVE - `ghcr.io/algorithmicsuperintelligence/optillm:latest-proxy`
- **Port**: http://cepo:8080 (internal) / http://localhost:8080 (host)
- **Active Approach**: `re2&cot_reflection` (Cerebras-compatible!)
  - `re2` = ReRead (processes query twice)
  - `cot_reflection` = Chain of Thought with `<thinking>`, `<reflection>`, `<output>`
- **OptiLLM enhancements**: Fallback in `optillm_enhancements.py` when CePO unavailable

### ⚠️ Cerebras API Limitations (Do NOT use)
- ❌ `cepo` approach - uses `reasoning_effort` parameter (422 error)
- ❌ `bon` approach - uses `n > 1` parameter (422 error)
- ❌ `thinkdeeper` - OpenAI-specific features

### Pricing (USD per Million Tokens) - Dec 2025 Verified

| Model | Provider | Input | Output |
|-------|----------|-------|--------|
| Qwen 3 235B (FREE) | OpenRouter `:free` | $0.00 | $0.00 |
| Qwen 3 32B | Cerebras | $0.40 | $0.80 |
| Qwen 3 235B | Cerebras | $0.60 | $1.20 |
| Imagen 3.0 | Vertex AI | - | $0.04/img |
| Pollinations | Pollinations | $0.00 | $0.00 |
| Imagen 3.0 | Vertex AI | - | $0.04/img |
| Imagen 4.0 Upscale | Vertex AI | - | $0.06/img |
| Veo 3.1 Video | Vertex AI | - | $0.20/sec |
| Veo 3.1 + Audio | Vertex AI | - | $0.40/sec |

Exchange Rate: R18.50 = $1 USD

### Feature Costs (Dec 2025)

| Feature | Cost | Tiers |
|---------|------|-------|
| Web Search (Serper.dev) | $0.001/query | ALL |
| Legal Search | $0.001/query | JIVE, JIGGA |
| Places Search | $0.001/query | ALL |
| GoggaTalk Voice | $0.015/sec (~$3 in + $12 out /M audio) | JIVE, JIGGA |
| **Chat TTS (Read Aloud)** | Per-request (Gemini 2.5 Flash TTS) | JIGGA |
| RAG Search | Free (client-side) | ALL |
| Math Tools | Free | ALL |
| Chart Gen | Free | ALL |

### Files
- `app/core/router.py`: `TierRouter.classify_intent()`, `JIVE_COMPLEX`, `JIGGA_COMPLEX`
- `app/core/retry.py`: Exponential backoff, circuit breaker, `@with_retry` decorator
- `app/core/idempotency.py`: Request deduplication cache, UUID v4 validation
- `app/services/ai_service.py`: Handles `JIVE_TEXT`, `JIVE_COMPLEX`, `JIGGA_THINK`, `JIGGA_COMPLEX`
- `app/config.py`: `MODEL_JIVE`, `MODEL_JIGGA`, `MODEL_JIGGA_235B`
- `app/services/optillm_enhancements.py`: SPL, Re-Read, CoT Reflection, Planning

### Token Limits (Dec 2025 Audit)
```python
# Qwen 32B (JIVE_TEXT, JIGGA_THINK layers)
QWEN_32B_MAX_TOKENS = 8000      # Extended output (reports, analysis)
QWEN_32B_DEFAULT_TOKENS = 4096   # Normal chat responses

# Qwen 235B (JIVE_COMPLEX, JIGGA_COMPLEX layers)
QWEN_235B_MAX_TOKENS = 32000    # Extended output (max hardware: 40,000)
QWEN_235B_DEFAULT_TOKENS = 8000  # Normal complex queries
```

### Qwen Thinking Mode Settings (NEVER use temp=0)
```python
QWEN_THINKING_SETTINGS = {
    "temperature": 0.6,  # REQUIRED - greedy (0) causes infinite loops
    "top_p": 0.95,
    "top_k": 20,
    "min_p": 0.0,
}
```

---

## Math Tool Delegation

### Architecture: 235B → 32B Delegation
When 235B receives a complex math query:
1. 235B calls `math_delegate` tool with task description
2. `math_delegate` internally calls 32B + SymPy via `python_execute`
3. 32B generates SymPy code → executor runs it → result returns to 235B
4. 235B interprets and explains the mathematical result

### Math Tools
- `math_statistics`: Mean, median, mode, std, variance, percentiles
- `math_financial`: NPV, IRR, loan payments, compound interest
- `python_execute`: SymPy symbolic math execution
- `math_delegate`: 235B → 32B task delegation
- `sequential_think`: Multi-step reasoning chains

### Files
- `app/tools/math_definitions.py`: Tool definitions, `ALL_MATH_TOOL_NAMES`
- `app/tools/executor.py`: `_execute_math_delegation()`, `_execute_python()`
- `app/services/ai_service.py`: Tool filtering, `get_tools_for_tier()`

---

## JIGGA-Exclusive Features

| Feature | Description |
|---------|-------------|
| Semantic RAG | E5 embeddings for vector similarity ranking |
| RAG Authoritative | Quotes directly from documents only |
| RAG Analytics Dashboard | Document usage, query patterns, retrieval stats |
| Cross-Session Selection | Select docs from other sessions |
| **Chat TTS (Read Aloud)** | Vertex AI Gemini 2.5 Flash TTS with Charon voice, 50-word chunking |

---

## Router Audit Fixes (Jan 2025)

### Issues Fixed
1. **JIVE_COMPLEX missing from prompt mapping** → Added to `layer_mapping` dict
2. **Confusing JIGGA_* constant names** → Renamed to `QWEN_32B_*` and `QWEN_235B_*`
3. **Dead code removed**: `RouteConfig`, `get_default_config()`, `route_request()`
4. **ai_service.py streaming** → Fixed to use proper `QWEN_32B_*` constants

### Token Constant Naming (Updated)
```python
# OLD (confusing - implied JIGGA tier only):
JIGGA_MAX_TOKENS = 8000
JIGGA_DEFAULT_TOKENS = 4096
JIGGA_235B_MAX_TOKENS = 32000
JIGGA_235B_DEFAULT_TOKENS = 8000

# NEW (clear - named by model):
QWEN_32B_MAX_TOKENS = 8000
QWEN_32B_DEFAULT_TOKENS = 4096
QWEN_235B_MAX_TOKENS = 32000
QWEN_235B_DEFAULT_TOKENS = 8000

# Legacy aliases preserved for backwards compatibility
JIGGA_MAX_TOKENS = QWEN_32B_MAX_TOKENS  # etc.
```

### Test Infrastructure
- **File**: `tests/test_router_infrastructure.py` (63 tests)
- **Coverage**: Token constants, tier routing, system prompts, keyword detection, edge cases
- **Run**: `cd gogga-backend && source venv314/bin/activate && python -m pytest tests/test_router_infrastructure.py -v`

### Known Issues Fixed (Dec 21, 2025)
- **Empty Response Bug**: `any()` pattern in `ai_service.py:1769-1775` threw TypeError when `tool_calls` was None
- **Symptom**: Math questions returned `responseLength: 0` but `logsCount: 14`
- **Fix**: Use explicit null checks: `hasattr(...) and tool_calls is not None and len(...) > 0 and any(...)`

---

## Enterprise Audit Summary (Dec 2025)

See `.serena/memories/enterprise_audit_dec2025.md` for full details.

### Critical Security Items (Immediate Action)
1. **SEC-001**: API keys exposed in committed .env → Rotate ALL keys
2. **SEC-002**: JWT uses base64, no signature → Implement pyjwt
3. **SEC-003**: Admin endpoints unprotected → Add auth middleware
4. **SEC-005**: Tier bypass via header → Server-side validation only

### Performance Quick Wins
1. **PERF-001**: Increase ThreadPoolExecutor to 64 workers (Cerebras SDK)
2. **PERF-002**: Add request-level idempotency cache
3. **PERF-004**: Skip local OptiLLM when routing to CePO
4. **PERF-005**: Aho-Corasick for pattern matching in router

### POPIA Compliance Gaps
- ❌ No consent tracking at signup
- ❌ No user data deletion API
- ❌ No data retention auto-purge
- ⚠️ AuthLog stores IPs indefinitely
