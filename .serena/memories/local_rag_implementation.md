# Local RAG Implementation - Complete

> **Last Updated:** December 4, 2025
> **Status:** ✅ WORKING

## Overview

Enterprise-grade local RAG pipeline for browser-based semantic search using the E5-small-v2 ONNX model. Supports tiered access (FREE, JIVE, JIGGA) with automatic mode selection.

## Recent Fixes (December 4, 2025)

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
| `gogga-frontend/src/lib/db.ts` | Dexie schema (documents, chunks, memories) |

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
