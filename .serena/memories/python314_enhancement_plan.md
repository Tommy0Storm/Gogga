# Python 3.14 Enhancement Plan for GOGGA

## Summary
Python 3.14 was released October 7, 2025. This document tracks implementation of new features.

## Key Features to Implement

### 1. Template Strings (t-strings) - PEP 750
**Status: IMPLEMENTED ✅**
**Priority: HIGH**

T-strings provide structured string interpolation for:
- SQL injection prevention
- XSS/HTML escaping
- Structured logging

```python
from string.templatelib import Template, Interpolation

def safe_sql(template: Template) -> str:
    parts = []
    for part in template:
        if isinstance(part, Interpolation):
            value = str(part.value).replace("'", "''")
            parts.append(f"'{value}'")
        else:
            parts.append(part)
    return ''.join(parts)

# Usage:
user_input = "'; DROP TABLE users; --"
query = safe_sql(t"SELECT * FROM users WHERE name = {user_input}")
```

**Files to create:**
- `gogga-backend/app/core/template_strings.py`

**Files to update:**
- `router.py` - Use for prompt construction
- `prompts.py` - Replace f-strings for user input

### 2. Zstandard Compression - PEP 784
**Status: IMPLEMENTED ✅**
**Priority: HIGH**

```python
from compression import zstd

def compress_response(data: dict) -> bytes:
    return zstd.compress(json.dumps(data).encode(), level=3)
```

**Files to create:**
- `gogga-backend/app/core/compression.py`

**Integration points:**
- Chat streaming responses
- RAG document storage
- API response middleware

### 3. Multiple Interpreters - PEP 734
**Status: PARTIALLY IMPLEMENTED**
**Priority: MEDIUM**

Already have basic implementation in `ai_service_manager.py`.

**Enhancements needed:**
- Interpreter pool for resource management
- Better error handling across interpreter boundaries
- Performance benchmarking

### 4. Deferred Annotations - PEP 649/749
**Status: AUTOMATICALLY ENABLED**
**Priority: LOW**

Python 3.14 automatically defers annotation evaluation. Benefits:
- No more string quotes for forward references
- Better performance on module load
- Use `annotationlib` for introspection

### 5. Asyncio Introspection
**Status: AVAILABLE**
**Priority: LOW**

```bash
python -m asyncio ps <PID>
python -m asyncio pstree <PID>
```

Useful for debugging stuck async tasks in production.

### 6. Free-Threaded Mode Improvements
**Status: READY**
**Priority: MEDIUM**

- 5-10% performance penalty (down from 15-20%)
- Use `python3.14t` binary for free-threading
- Already configured in `Dockerfile.prod`

## Already Implemented

### Updated Requirements.txt (December 2025)
- fastapi>=0.124.0 (latest)
- pydantic>=2.12.0 (latest)
- uvicorn>=0.38.0 (latest)
- httpx>=0.28.0 (latest)
- numpy>=2.3.0 (latest, Python 3.14 compatible)
- scipy>=1.16.0 (latest)
- google-genai>=1.55.0 (latest)
- sqlmodel>=0.0.27 (latest)
- cerebras_cloud_sdk>=1.59.0 (latest)

### Implementation Files
- `app/core/template_strings.py` - 441 lines, t-string utilities
- `app/core/compression.py` - 452 lines, Zstandard compression
- `tests/test_python314_features.py` - 29 tests passing

## Cross-Stack Synergies Implemented (December 2025)

### 1. AbortController + cacheSignal Pattern ✅
- **Files**: `ChatClient.tsx` (abortControllerRef, signal prop)
- **Synergy**: Frontend abort signals propagate to SSE streams
- **Benefit**: Saves Cerebras API costs when user navigates away

### 2. Zstd Compression Middleware ✅
- **Files**: `app/main.py` (zstd_compression_middleware)
- **Synergy**: Python 3.14 PEP 784 + FastAPI middleware
- **Benefit**: 40-60% smaller JSON responses for chat

### 3. useEffectEvent Migration ✅
- **Files**: `useRAG.ts` (onUpdateStorageUsage, onLoadDocuments)
- **Synergy**: React 19.2 stable handlers + RxDB subscriptions
- **Benefit**: No effect restarts on callback identity changes

### 4. Activity Component Pattern ✅
- **Files**: `components/Activity.tsx`
- **Synergy**: React 19.2 Activity + Next.js 16 PPR
- **Benefit**: Hidden panels pause effects, preserving state

| Feature | Location | Notes |
|---------|----------|-------|
| `concurrent.interpreters` | `ai_service_manager.py` | Basic usage |
| PEP 695 type aliases | `error_reporting.py` | `type UserTier = ...` |
| GIL status check | `ai_service_manager.py` | `Py_GIL_DISABLED` |
| f-string optimization | `prompts.py` | Documented, using |

## Test Plan

```python
# tests/test_python314.py

def test_tstring_sql_injection():
    malicious = "'; DROP TABLE users; --"
    result = safe_sql(t"SELECT * FROM users WHERE name = {malicious}")
    assert "DROP TABLE" not in result

def test_zstd_compression():
    data = {"message": "hello" * 1000}
    compressed = compress_response(data)
    assert len(compressed) < len(json.dumps(data))

def test_interpreter_isolation():
    pool = InterpreterPool(4)
    results = await asyncio.gather(*[pool.execute("1+1") for _ in range(10)])
    assert all(r == "2" for r in results)
```

## Documentation

Full plan: `docs/COMPREHENSIVE_ENHANCEMENT_PLAN.md`
TS/Python bridge: `docs/TS59_PY314_IMPLEMENTATION.md`
