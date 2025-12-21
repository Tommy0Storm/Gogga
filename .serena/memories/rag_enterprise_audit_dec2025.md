# RAG System Enterprise Audit - December 2025

> **Audit Date:** December 21, 2025
> **Status:** 🔴 CRITICAL - Multiple performance and architectural issues
> **Impact:** Browser freezing, 4+ second delays, lost embeddings on refresh

## Executive Summary

The RAG system has severe performance bottlenecks causing browser freezes and poor UX. The root causes are:

1. **PDF extraction producing gibberish** - `unpdf` silent failures
2. **Full collection scans on every query** - O(n) instead of indexed queries
3. **Ephemeral embedding cache** - Lost on page refresh (design says persistent)
4. **Excessive document conversions** - Same docs converted 15+ times per render
5. **Main thread blocking** - Embedding pipeline blocks UI
6. **Redundant state synchronization** - 4-layer state propagation

## Critical Issues (P0)

### 1. PDF Extraction Producing Gibberish

**File:** `gogga-frontend/src/lib/rag.ts:extractPdfText()`

**Problem:** `unpdf` library fails silently, falling back to regex extraction that produces garbage:
```typescript
// Fallback regex produces gibberish for encrypted/complex PDFs
const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
```

**Evidence:** User report shows PDFs uploaded but content is unreadable.

**Fix:**
```typescript
// 1. Use MinerU backend service for proper OCR extraction
// 2. Show error to user when unpdf fails instead of silent fallback
// 3. Add PDF content validation before storage
```

### 2. Full Collection Scans (Browser Freeze Source)

**Files:** `db.ts`, `advancedFeatures.ts`, `vectorCollection.ts`

**Problem:** 20+ locations use `.find().exec()` loading ENTIRE collections:
```typescript
// ANTI-PATTERN: Loads ALL documents into memory
const allDocs = await rxdb.documents.find().exec();
const activeDocs = allDocs.filter(...); // Then filters in JS
```

**Impact:** With 100+ documents, each query loads ~50MB+ into memory.

**Fix:**
```typescript
// Use RxDB indexed queries
const activeDocs = await rxdb.documents.find({
  selector: { activeSessions: { $elemMatch: sessionId } }
}).exec();
```

### 3. Ephemeral Embedding Cache (Lost on Refresh)

**File:** `ragManager.ts`

**Problem:** Embedding cache is a `Map<string, EmbeddingCacheEntry>` that resets on page refresh:
```typescript
private embeddingsCache: Map<string, EmbeddingCacheEntry> = new Map();
```

**Design says:** Persist embeddings to RxDB `vectorEmbeddings` collection.

**Impact:** Every page refresh requires re-embedding ALL documents (~2-5 seconds per doc).

**Fix:**
```typescript
// Use RxDB vectorEmbeddings collection as cache
async ensureEmbeddings(sessionId: string): Promise<void> {
  const existingVectors = await rxdb.vectorEmbeddings.find({
    selector: { documentId: { $in: docIds } }
  }).exec();
  // Only generate for missing docs
}
```

### 4. Excessive Document Conversions

**File:** `db.ts:docToDocument()`

**Evidence from logs:**
```
[db.ts] docToDocument - input id: mjfc0km2-0fyj6k3b filename: Email.pdf
[db.ts] docToDocument - result id: mjfc0km2-0fyj6k3b
[db.ts] docToDocument - input id: mjfc0km2-0fyj6k3b filename: Email.pdf  // DUPLICATE
[db.ts] docToDocument - result id: mjfc0km2-0fyj6k3b  // DUPLICATE
```

Same document converted 15+ times per render cycle!

**Root cause:** Multiple components calling `getActiveDocumentsForSession()` independently.

**Fix:**
- Implement RxDB reactive subscriptions instead of polling
- Cache converted documents at Zustand store level
- Use React Query or SWR for data fetching with deduplication

## High Priority Issues (P1)

### 5. Main Thread Blocking

**File:** `embeddingEngine.ts`

**Problem:** Embedding inference runs on main thread, blocking UI:
```typescript
const result = await pipeline(truncatedText, { pooling: 'mean', normalize: true });
```

**Fix:** Move to Web Worker:
```typescript
// embeddingWorker.ts - already exists but not used!
// parallelEmbedding.ts - exists but not integrated
```

### 6. WebGPU Check Not Cached Properly

**File:** `embeddingEngine.ts`

**Problem:** WebGPU availability checked multiple times:
```typescript
let webGPUAvailabilityCache: boolean | null = null;
async function checkWebGPUAvailability(): Promise<boolean> {
  if (webGPUAvailabilityCache !== null) return webGPUAvailabilityCache;
  // ... expensive check
}
```

The cache is module-scoped but still called in multiple places.

### 7. Batch Processing Not Yielding Properly

**File:** `ragManager.ts:ensureEmbeddings()`

**Problem:** `requestIdlePromise(30)` is too short - UI still freezes:
```typescript
await requestIdlePromise(30); // 30ms not enough for complex embeddings
```

**Fix:** Use longer idle windows + visual progress:
```typescript
await requestIdlePromise(100); // 100ms minimum
emitProgress({ current: i, total: batches.length }); // Show progress
```

## Medium Priority Issues (P2)

### 8. Redundant State Synchronization

**Data flow:**
```
RxDB → docToDocument() → db.ts functions → useRAG hook → Zustand store → Components
       ↑_______________________________________________________________↓
                        Circular updates!
```

**Fix:** Single source of truth with reactive subscriptions:
```
RxDB → Observable → Zustand (single transformation) → Components
```

### 9. RxDB Pipeline Not Used for Auto-Embedding

**File:** `embeddingPipeline.ts`

RxPipeline exists but is not connected to document uploads:
```typescript
// Pipeline exists but documentChunks -> vectorEmbeddings not automatic
```

### 10. No Index on activeSessions Array

**File:** `rxdb/schemas.ts`

```typescript
// Missing index for session-based queries!
// activeSessions is an array - needs special handling
indexes: [
  'userId',
  'originSessionId',
  // MISSING: index for activeSessions queries
]
```

## Design vs Implementation Gaps

| Feature | Design Doc | Current Implementation | Gap |
|---------|------------|----------------------|-----|
| Embedding persistence | RxDB vectorEmbeddings | Ephemeral Map | ❌ Critical |
| Token budgets | Enforced per tier | Not implemented | ⚠️ High |
| Cross-session pulls | Pool picker UI | Partially implemented | ⚠️ Medium |
| Authoritative mode | JIGGA only | Not implemented | ⚠️ Medium |
| Orphan document tracking | Track & prompt | Not implemented | ℹ️ Low |

## Performance Metrics (Current)

| Operation | Current | Target | Fix Priority |
|-----------|---------|--------|--------------|
| Page load with 4 docs | 8-12s | <1s | P0 |
| Document upload (PDF) | 15-30s | 2-3s | P0 |
| Query with 10 docs | 4-6s | <500ms | P0 |
| Re-embedding on refresh | 100% re-do | 0% (cached) | P0 |
| UI responsiveness | Freezes | Smooth | P1 |

## Recommended Fix Order

### Phase 1: Stop the Bleeding (Week 1)
1. ✅ Fix PDF extraction - use MinerU backend or show clear errors
2. ✅ Add indexed queries - replace `.find().exec()` with selectors
3. ✅ Persist embeddings to RxDB vectorEmbeddings collection
4. ✅ Debounce document store updates

### Phase 2: Architecture Fix (Week 2)
5. Move embedding to Web Workers
6. Implement RxDB reactive subscriptions
7. Add token budget enforcement
8. Add proper progress indicators

### Phase 3: Polish (Week 3)
9. Implement cross-session document pool UI
10. Add authoritative mode for JIGGA
11. Add orphan document management
12. Performance testing suite

## Testing Strategy

### Unit Tests
- PDF extraction with various document types
- Embedding cache persistence
- Token budget enforcement
- Query performance benchmarks

### Integration Tests
- End-to-end upload flow
- Cross-session document access
- Browser tab synchronization

### Performance Tests
- Load test with 100 documents
- Memory usage monitoring
- Main thread blocking metrics
- Time-to-interactive measurements

### Browser Tests
- Chrome, Firefox, Safari, Edge
- WebGPU vs WASM fallback
- IndexedDB quota handling

## Files to Modify

| File | Changes Needed |
|------|---------------|
| `lib/rag.ts` | PDF extraction error handling, MinerU integration |
| `lib/ragManager.ts` | Persist to RxDB, use Web Workers |
| `lib/db.ts` | Add indexed queries, reduce conversions |
| `lib/embeddingEngine.ts` | Web Worker integration |
| `rxdb/schemas.ts` | Add activeSessions index |
| `rxdb/vectorCollection.ts` | Cache lookup before embedding |
| `hooks/useRAG.ts` | RxDB subscriptions, debouncing |
| `lib/documentStore.ts` | Reduce state duplication |
| `components/RightSidePanel.tsx` | Progress indicators |
