# Local RAG Implementation - Complete

> **Last Updated:** December 15, 2025
> **Status:** ✅ WORKING - RxDB Migration Complete

## MinerU Integration (December 14, 2025)

**NEW**: Enterprise-grade PDF parsing via MinerU.net cloud API

### Backend Service
- `app/services/mineru_service.py` - Async HTTP client with polling
- `app/api/v1/endpoints/documents.py` - REST API endpoints

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/documents/parse` | POST | Parse PDF from URL (sync, waits for result) |
| `/api/v1/documents/submit` | POST | Submit batch URLs (async, returns batch_id) |
| `/api/v1/documents/status/{batch_id}` | GET | Check task status |
| `/api/v1/documents/health` | GET | Check MinerU config |

### Configuration (app/config.py)
```python
MINERU_API_KEY: str   # JWT token from mineru.net
MINERU_API_BASE: str = "https://mineru.net"
MINERU_ENABLED: bool = True
MINERU_TIMEOUT: float = 120.0
```

### Features
- **OCR support**: Scanned document text extraction
- **Table recognition**: Structured table extraction to Markdown
- **Formula extraction**: LaTeX math formulas
- **Multi-language**: English, Chinese, and other languages

### Usage Example
```bash
curl -X POST http://localhost:8000/api/v1/documents/parse \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/doc.pdf", "enable_ocr": true}'
```

## RxDB Migration Complete (December 15, 2025)

**COMPLETE**: RxDB 16.21.1 is now the primary database:
- `lib/db.ts` - RxDB shim with Dexie API compatibility
- `lib/db-dexie-legacy.ts` - Original Dexie backup
- Dynamic imports avoid Dexie version conflict (RxDB bundles 4.0.10, project has 4.2.1)
- 13 collections including `goggaSmartSkills`
- Session-scoped RAG fields: `userId`, `originSessionId`, `activeSessions[]`
- Schema migration strategies for v0→v1 upgrades
- 25 passing tests (11 integration + 14 shim)

Files: `gogga-frontend/src/lib/rxdb/`, `gogga-frontend/src/lib/db.ts`

## Overview

Enterprise-grade local RAG pipeline for browser-based semantic search using the E5-small-v2 ONNX model. Supports tiered access (FREE, JIVE, JIGGA) with automatic mode selection.

## Recent Fixes (December 2025)

### December 6, 2025 - ONNX WASM Loading Fix
1. **CDN WASM binaries**: Configured ONNX Runtime Web to load WASM files from jsDelivr CDN instead of Turbopack chunks
2. **Single-threaded mode**: Set `ort.env.wasm.numThreads = 1` to avoid multi-threading chunk loading issues
3. **Disabled proxy workers**: Set `ort.env.wasm.proxy = false` for simpler loading
4. **File**: `gogga-frontend/src/lib/embeddingEngine.ts`

```typescript
async function configureOnnxRuntime(): Promise<void> {
  const ort = await import('onnxruntime-web');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
  ort.env.wasm.proxy = false;
}
```

### December 4, 2025
1. **Webpack Config**: Force browser build with alias in `next.config.js`:
   ```javascript
   '@huggingface/transformers': path.join(__dirname, 'node_modules/@huggingface/transformers/dist/transformers.web.js')
   ```
2. **Sharp module**: Ignored with webpack IgnorePlugin to prevent Node.js dependencies
3. **JIVE upload fix**: Both JIVE and JIGGA now use `uploadDocument()` for proper Dexie storage
4. **RagManager cross-session docs**: Added `addExternalDocuments()` method for "Browse All Docs" feature
5. **Enterprise PDF extraction**: Added `unpdf` library for robust PDF text extraction with fallback to basic regex

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GOGGA Local RAG System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   useRAG    │───▶│ RagManager  │───▶│EmbeddingEng │         │
│  │   (Hook)    │    │ (Unified)   │    │   (ONNX)    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Dexie     │    │ FlexSearch  │    │  E5-small   │         │
│  │  (IndexDB)  │    │  (Keyword)  │    │   (384d)    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `gogga-frontend/src/lib/embeddingEngine.ts` | E5-small-v2 ONNX embedding engine |
| `gogga-frontend/src/lib/ragManager.ts` | Unified RAG manager (basic + semantic) |
| `gogga-frontend/src/lib/ragMetrics.ts` | Analytics collection for JIGGA |
| `gogga-frontend/src/lib/rag.ts` | FlexSearch-based keyword RAG |
| `gogga-frontend/src/hooks/useRAG.ts` | React hook with tier-based mode selection |
| `gogga-frontend/src/lib/db.ts` | RxDB shim with Dexie API compatibility |
| `gogga-frontend/src/lib/rxdb/` | RxDB schemas, database, migration |

## Tier Features

| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| RAG Enabled | ❌ | ✅ | ✅ |
| Mode | - | Basic (keyword) | Semantic (vector) |
| Docs/Session | - | 5 | 10 |
| Cross-Session | - | ❌ | ✅ |
| Analytics | - | ❌ | ✅ |
| Vector Scores | - | ❌ | ✅ |
| Long-Term Memory | ❌ | ❌ | ✅ |

## Embedding Model

- **Model**: intfloat/e5-small-v2 (ONNX quantized via Xenova)
- **Display Name**: VCB-AI Micro (user-facing)
- **Dimensions**: 384
- **Backend**: WASM (WebGPU disabled for stability)
- **Load time**: ~2-5s first use, cached thereafter

## Key APIs

### useRAG Hook
```typescript
const {
  uploadDocument,
  getContext,
  getSemanticChunks,    // JIGGA only
  initSemanticSearch,   // JIGGA only
  preloadEmbeddings,    // JIGGA only
  canUseSemanticRAG,
  semanticReady,
  lastRetrievalStats,
} = useRAG(tier);
```

### RagManager
```typescript
const ragManager = new RagManager();
await ragManager.initializeSemanticEngine();
ragManager.setDocuments(sessionId, docs);
ragManager.addExternalDocuments(sessionId, docs); // Cross-session
await ragManager.ensureEmbeddings(sessionId);
const context = await ragManager.getContextForLLM(
  sessionId, query, mode, options
);
```

## Long-Term Memory Integration

JIGGA tier users can store persistent context in Dexie `memories` table:
```typescript
import { getMemoryContextForLLM } from '@/lib/db';
const memoryContext = await getMemoryContextForLLM(); // Returns formatted context
```

Memory is injected before RAG context in `page.tsx:sendMessage()`.

## Metrics & Logs Persistence (December 5, 2025)

RAG metrics and system logs are now persisted to Dexie (IndexedDB) for dashboard visibility across page navigation:

### New Dexie Tables (Version 6)

| Table | Retention | Purpose |
|-------|-----------|---------|
| `ragMetrics` | 7 days | Embedding stats, retrieval, queries, cache hits/misses |
| `systemLogs` | 7 days | Debug/info/warn/error logs by category |

### Key Functions

```typescript
// Metrics persistence (db.ts)
await saveRagMetric({ type, timestamp, sessionId, docId, value });
await getRecentRagMetrics({ type, sessionId, limit });
await cleanupOldRagMetrics();  // Removes >3 day old

// System logs (db.ts)
await logInfo('rag', 'Embeddings generated', { docId, chunks: 42 });
await logError('system', 'Model load failed', { error: e.message });
await cleanupOldSystemLogs();  // Removes >7 day old

// Async metrics for dashboard (ragMetrics.ts)
const metrics = await getRecentMetricsAsync({ type: 'embedding_generated' });
```

### Retention Cleanup

Automatic cleanup runs on app startup:
```typescript
await runRetentionCleanup();
// Returns: { metricsDeleted: number, logsDeleted: number }
```

## Dependencies

**Frontend (gogga-frontend/package.json):**
```json
{
  "@huggingface/transformers": "^3.8.1",
  "onnxruntime-web": "^1.x",
  "flexsearch": "^0.8.x",
  "dexie": "^4.x",
  "unpdf": "^0.x"
}
```

## Performance

- **Embedding latency**: ~50-200ms per chunk (browser)
- **Search latency**: <10ms (cached embeddings)
- **Model load**: ~2-5s (first use)
- **Memory**: ~200MB (model + cache)
