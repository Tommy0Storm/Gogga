# GOGGA Architecture Details

## Storage Architecture (Dual-Database)

GOGGA uses **two separate databases** that never connect directly:

| Database | Purpose | Scope | Persistence |
|----------|---------|-------|-------------|
| **SQLite** (Prisma) | Identity & billing | Server instance | Until deleted |
| **Dexie** (IndexedDB) | User content | Per-browser, per-device | User controlled |

### SQLite (Server-Side)
- User identity (email, id)
- Login tokens (magic links)
- Auth logs (connection audit)
- Subscriptions (tier, status, PayFast token)

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
| JIVE | Cerebras Qwen 32B | Cerebras Qwen 235B | FLUX 1.1 Pro (200/mo) |
| JIGGA | Cerebras Qwen 32B | Cerebras Qwen 235B | FLUX 1.1 Pro (1000/mo) |

### 235B Triggers (JIVE and JIGGA)
- **Complex keywords**: constitutional, legal, compliance, statutory, litigation, etc.
- **Extended output**: comprehensive analysis, detailed report, thorough review, etc.
- **African languages**: Zulu, Xhosa, Sotho, Tswana, Venda, Tsonga, etc.

### CePO/OptiLLM Status
- **CePO sidecar**: REMOVED (Dec 2025)
- **OptiLLM enhancements**: Implemented directly in code (`optillm_enhancements.py`)
- **Techniques**: SPL, Re-Read (re2), CoT Reflection, Planning Mode

### Pricing (USD per Million Tokens)

| Tier | Input | Output | Image |
|------|-------|--------|-------|
| FREE | $0.00 | $0.00 | $0.00 |
| JIVE (32B) | $0.40 | $0.80 | $0.04 |
| JIVE (235B) | $0.60 | $1.20 | $0.04 |
| JIGGA (32B) | $0.40 | $0.80 | $0.04 |
| JIGGA (235B) | $0.60 | $1.20 | $0.04 |

### Files
- `app/core/router.py`: `route_request()`, `TierRouter.classify_intent()`, `JIVE_COMPLEX`, `JIGGA_COMPLEX`
- `app/services/ai_service.py`: Handles `JIVE_TEXT`, `JIVE_COMPLEX`, `JIGGA_THINK`, `JIGGA_COMPLEX`
- `app/config.py`: `MODEL_JIVE`, `MODEL_JIGGA`, `MODEL_JIGGA_235B`
- `app/services/optillm_enhancements.py`: SPL, Re-Read, CoT Reflection, Planning

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
