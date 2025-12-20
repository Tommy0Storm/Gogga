# GOGGA Performance Best Practices

## Overview (Updated Dec 2025)

This document captures performance patterns, optimizations, and anti-patterns for the GOGGA platform.

---

## Backend Performance (Python/FastAPI)

### ✅ Implemented Patterns

#### Lazy Singleton HTTP Clients
```python
# CORRECT: Single client per service, lazy init
_client: httpx.AsyncClient | None = None

async def _get_client(self) -> httpx.AsyncClient:
    if self._client is None or self._client.is_closed:
        self._client = httpx.AsyncClient(
            timeout=120.0,
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=50,
            ),
            http2=True,
        )
    return self._client
```

#### Enterprise Retry with Jitter
```python
# Prevents thundering herd, handles transient failures
def get_delay_ms(self, attempt: int) -> int:
    base_delay = self.initial_delay_ms * (self.multiplier ** attempt)
    capped_delay = min(base_delay, self.max_delay_ms)
    jitter = random.randint(0, self.jitter_max_ms)
    return int(capped_delay + jitter)
```

#### Cached Settings Access
```python
# CORRECT: Use the cached getter
from app.config import get_settings
settings = get_settings()

# ❌ WRONG: Direct import bypasses cache
# from app.config import settings
```

---

### 🔴 Critical Optimizations Needed

#### 1. Cerebras SDK Thread Pool

**Problem**: Cerebras SDK is synchronous, wrapped in `asyncio.to_thread()`. Default pool is 8 workers.

```python
# ADD to gogga-backend/app/main.py startup
import asyncio
import concurrent.futures

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Increase thread pool for Cerebras SDK blocking calls
    loop = asyncio.get_event_loop()
    loop.set_default_executor(
        concurrent.futures.ThreadPoolExecutor(max_workers=64)
    )
    
    # ... rest of startup
```

**Impact**: 40-60% latency reduction under concurrent load.

---

#### 2. Request-Level Idempotency Cache

**Problem**: Double-clicks, retries cause duplicate LLM calls.

```python
# ADD to ai_service.py
from app.core.idempotency import IdempotencyCache

_chat_cache = IdempotencyCache(ttl_seconds=300)  # 5 min

async def generate_response(..., request_id: str | None = None):
    if request_id:
        cache_key = f"chat:{user_id}:{request_id}"
        cached = await _chat_cache.get(cache_key)
        if cached:
            logger.info(f"Idempotent hit: {request_id[:8]}")
            return cached
    
    response = await self._call_model(...)
    
    if request_id:
        await _chat_cache.set(cache_key, response)
    
    return response
```

---

#### 3. Skip Double OptiLLM Processing

**Problem**: When CePO is enabled, OptiLLM runs twice (local + CePO).

```python
# MODIFY in ai_service.py
if settings.CEPO_ENABLED and tier in (UserTier.JIVE, UserTier.JIGGA):
    # Skip local OptiLLM - CePO handles enhancement
    logger.debug("Routing to CePO - skipping local OptiLLM")
    return await self._call_cepo_service(messages, system_prompt, model, ...)
else:
    # Apply local OptiLLM for FREE tier or CePO fallback
    system_prompt = self._apply_optillm(system_prompt, tier)
    return await self._call_cerebras(...)
```

**Impact**: 20% token savings on JIVE/JIGGA.

---

#### 4. Aho-Corasick Pattern Matching

**Problem**: Tier router does O(n*m) pattern matching with 80+ keywords.

```python
# REPLACE in router.py
import ahocorasick

# Build automaton once at module load
_pattern_automaton = ahocorasick.Automaton()
_all_patterns = (
    EXTENDED_OUTPUT_KEYWORDS |
    COMPLEX_235B_KEYWORDS |
    SA_BANTU_LANGUAGE_PATTERNS |
    IMAGE_KEYWORDS
)
for pattern in _all_patterns:
    _pattern_automaton.add_word(pattern.lower(), pattern)
_pattern_automaton.make_automaton()

def classify_message_patterns(message: str) -> set[str]:
    """O(n) multi-pattern matching."""
    return {match[1] for match in _pattern_automaton.iter(message.lower())}
```

**Impact**: 10x faster pattern matching.

---

## Frontend Performance (React/Next.js)

### ✅ Implemented Patterns

#### React Compiler
```javascript
// next.config.js
experimental: {
    reactCompiler: true,
}
```

#### RxDB Leader Election
```typescript
// Cross-tab coordination prevents conflicts
const db = await createRxDatabase({
    multiInstance: true,
    eventReduce: true,
});
```

#### WebWorker Embeddings
```typescript
// Parallel processing off main thread
const worker = new Worker('./embeddingWorker.ts');
worker.postMessage({ documents, batchSize: 3 });
```

---

### 🔴 Critical Optimizations Needed

#### 1. Remove Manual Memoization (React Compiler Conflict)

**Problem**: With React Compiler enabled, manual `useCallback`/`useMemo` are redundant.

```typescript
// ❌ BEFORE: Manual memoization (now redundant)
const getWsUrl = useCallback(() => {...}, []);
const addLog = useCallback((...) => {...}, [...]);

// ✅ AFTER: Plain functions (Compiler handles it)
const getWsUrl = () => {...};
const addLog = (...) => {...};
```

**Keep memoization for**:
- Expensive computations passed to third-party libs
- Values in dependency arrays of third-party hooks

---

#### 2. Lazy Date Parsing

**Problem**: Every RxDB document creates 3 Date objects.

```typescript
// ❌ BEFORE: Eager date conversion
function docToDocument(doc: DocumentDoc): Document {
    return {
        lastAccessedAt: new Date(d.lastAccessedAt),  // GC pressure
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
    };
}

// ✅ AFTER: Lazy getters
function docToDocument(doc: DocumentDoc): Document {
    return {
        ...d,
        get lastAccessedAt() { return new Date(d.lastAccessedAt); },
        get createdAt() { return new Date(d.createdAt); },
        get updatedAt() { return new Date(d.updatedAt); },
    };
}
```

---

#### 3. Move localStorage to IndexedDB

**Problem**: `localStorage.getItem()` + `JSON.parse()` blocks main thread.

```typescript
// ❌ BEFORE: Synchronous localStorage
function loadProgress(): PipelineProgress {
    const stored = localStorage.getItem(PIPELINE_CONFIG.PROGRESS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PROGRESS;
}

// ✅ AFTER: Async via RxDB
async function loadProgress(): Promise<PipelineProgress> {
    const db = await getDatabase();
    const doc = await db.userPreferences.findOne('embedding_progress').exec();
    return doc?.value ? JSON.parse(doc.value) : DEFAULT_PROGRESS;
}
```

---

#### 4. Suspense Boundaries

**Problem**: Components load in waterfall instead of parallel.

```tsx
// ✅ ADD Suspense for parallel loading
<Suspense fallback={<RAGLoadingSkeleton />}>
    <StreamingRAGPanel documents={documents} />
</Suspense>

<Suspense fallback={<ImageGridSkeleton />}>
    <ImageGallery sessionId={sessionId} />
</Suspense>
```

---

## Docker/Infrastructure Performance

### Resource Allocation (Recommended)

| Container | Current | Recommended | Reason |
|-----------|---------|-------------|--------|
| gogga_ui | 2GB | 3GB | Next.js 16 + React Compiler |
| gogga_cepo | 1GB | 2GB | OptiLLM multi-step reasoning |
| gogga_api | 512MB | 512MB | Adequate (lightweight) |

```yaml
# docker-compose.override.yml adjustments
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 3G
        reservations:
          memory: 1G
          
  cepo:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

---

### Health Check Tuning

```yaml
# BEFORE: Too slow detection
healthcheck:
    interval: 30s
    timeout: 10s
    retries: 3

# AFTER: Faster failure detection
healthcheck:
    interval: 15s
    timeout: 5s
    retries: 2
    start_period: 45s
```

---

### NFS Considerations

**Problem**: NFS adds 1-5ms latency per file operation.

**Recommendations**:
1. Keep SQLite on local SSD (primary server)
2. Use NFS only for cold storage (backups, exports)
3. Consider rsync for hot file sync instead of NFS mount

---

## Caching Strategy

### Current Caches

| Cache | Scope | TTL | Purpose |
|-------|-------|-----|---------|
| IdempotencyCache | In-memory | 1 hour | Media generation dedup |
| Settings | lru_cache | Forever | Configuration |
| HTTP Connections | Per-service | 30s keepalive | Connection pooling |

### Recommended Additions

| Cache | Type | TTL | Purpose |
|-------|------|-----|---------|
| Chat Idempotency | In-memory | 5 min | Prevent duplicate LLM calls |
| Pattern Matching | Module-level | Forever | Tier routing automaton |
| Token Counts | LRU | 1000 items | Avoid re-tokenization |

### Future: Redis for Scale

```python
# For horizontal scaling
class RedisIdempotencyCache:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self._redis = redis.from_url(redis_url)
    
    async def get(self, key: str) -> dict | None:
        data = await self._redis.get(key)
        return json.loads(data) if data else None
    
    async def set(self, key: str, value: dict, ttl: int = 300):
        await self._redis.setex(key, ttl, json.dumps(value))
```

---

## Monitoring Metrics

### Backend (Prometheus)

```python
from prometheus_client import Counter, Histogram

CHAT_LATENCY = Histogram(
    'gogga_chat_latency_seconds',
    'Chat response latency',
    ['tier', 'model'],
    buckets=[0.5, 1, 2, 5, 10, 30, 60]
)

CEREBRAS_RETRIES = Counter(
    'gogga_cerebras_retries_total',
    'Cerebras retry count',
    ['key_name', 'status_code']
)

CEPO_FALLBACKS = Counter(
    'gogga_cepo_fallbacks_total',
    'CePO to direct Cerebras fallbacks'
)

TOKEN_USAGE = Counter(
    'gogga_tokens_total',
    'Token consumption',
    ['tier', 'direction']  # input/output
)
```

### Frontend (Performance API)

```typescript
// Track component render times
const startTime = performance.now();
// ... render ...
const renderTime = performance.now() - startTime;
posthog.capture('component_render', { 
    component: 'ChatClient', 
    duration_ms: renderTime 
});
```

---

## Performance Checklist for PRs

- [ ] No blocking I/O in async functions
- [ ] HTTP clients use connection pooling
- [ ] Large lists use virtualization
- [ ] Images have explicit dimensions
- [ ] No unnecessary re-renders (check with React DevTools)
- [ ] Database queries use proper indexes
- [ ] Expensive operations have loading states
- [ ] Background tasks don't block response
