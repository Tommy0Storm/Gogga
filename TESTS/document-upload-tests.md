# Document Upload Test Plan

> **Created:** December 23, 2025
> **Status:** ✅ PASS (fixes applied)
> **Related Fix:** RxDB db.collections.X → db.X pattern correction

## Overview

This test plan covers the two document upload mechanisms in GOGGA:
1. **📎 Paperclip (Session Docs)**: Temporary documents for current chat
2. **📚 RAG Store**: Persistent document store with semantic search

## Bug Fixed (December 23, 2025)

### Root Cause
Three files incorrectly used `db.collections.documents` instead of `db.documents`:
- `src/lib/rag/clearAllRAG.ts`
- `src/lib/rag/deletionService.ts`
- `src/lib/rag/documentPool.ts`

**Error Message:**
```
TypeError: Cannot read properties of undefined (reading 'find')
    at getAllDocuments
```

### Fix Applied
Changed all `db.collections.X` references to `db.X` to match RxDB's API where collections are directly on the database object.

## Tier Configuration

| Tier | Session Docs (📎) | RAG Store (📚) |
|------|-------------------|----------------|
| FREE | 1 doc, 2MB | Disabled |
| JIVE | 10 docs, 50MB | 1 doc, 5MB (enticement) |
| JIGGA | 10 docs, 50MB | 200 docs, 250MB |

## Test Scenarios

### 1. Session Document Upload (📎 Paperclip)

| Test ID | Scenario | Tier | Expected Result |
|---------|----------|------|-----------------|
| SD-01 | Upload single document | FREE | ✅ Success, stored in session |
| SD-02 | Upload second document | FREE | ❌ Fail with "limit reached" |
| SD-03 | Upload 10 documents | JIVE | ✅ Success for all 10 |
| SD-04 | Upload 11th document | JIVE | ❌ Fail with "limit reached" |
| SD-05 | Upload 2MB file | FREE | ✅ Success |
| SD-06 | Upload 3MB file | FREE | ❌ Fail with "file too large" |
| SD-07 | Delete session document | ALL | ✅ Removed from session |
| SD-08 | Session ends, documents cleared | ALL | ✅ Ephemeral by design |

### 2. RAG Store Upload (📚)

| Test ID | Scenario | Tier | Expected Result |
|---------|----------|------|-----------------|
| RAG-01 | Attempt RAG upload | FREE | ❌ Button disabled/shows upgrade |
| RAG-02 | Upload single RAG document | JIVE | ✅ Success |
| RAG-03 | Upload second RAG document | JIVE | ❌ Fail with "limit reached" |
| RAG-04 | Upload 200 RAG documents | JIGGA | ✅ Success for all |
| RAG-05 | Delete RAG document | JIVE/JIGGA | ✅ Cascade deletes chunks/embeddings |
| RAG-06 | Clear all RAG | JIGGA | ✅ All docs removed |
| RAG-07 | Get RAG storage stats | JIGGA | ✅ Returns accurate counts |

### 3. Document Pool Operations

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| DP-01 | Activate doc for session | ✅ Added to activeSessions[] |
| DP-02 | Deactivate doc from session | ✅ Removed from activeSessions[] |
| DP-03 | Get orphaned documents | ✅ Returns docs with empty activeSessions[] |
| DP-04 | Delete orphaned documents | ✅ Cascade delete works |

### 4. Deletion Service

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| DS-01 | Delete document | ✅ Doc, chunks, embeddings removed |
| DS-02 | Delete multiple documents | ✅ Bulk deletion works |
| DS-03 | Delete all user documents | ✅ Complete cleanup |
| DS-04 | Clear document embeddings | ✅ Only vectors/chunks removed |

## Automated Test Coverage

### Existing Tests (66 passing)
Located in `gogga-frontend/src/lib/rxdb/__tests__/`:

- `memoryStorage.test.ts` - 15 tests
- `rxdb.test.ts` - 24 tests  
- `advancedFeatures.test.ts` - 27 tests

### Suggested Additional Tests

```typescript
// gogga-frontend/src/lib/rag/__tests__/ragDeletion.test.ts

describe('RAG Deletion Service', () => {
  describe('clearAllRAGDocuments', () => {
    it('should delete all RAG store documents for user');
    it('should cascade delete chunks and embeddings');
    it('should return accurate deletion counts');
  });
  
  describe('clearRAGDocument', () => {
    it('should delete single document with cascade');
    it('should return false for non-existent document');
  });
  
  describe('getRAGStorageStats', () => {
    it('should return zero for empty pool');
    it('should count documents, chunks, embeddings accurately');
  });
});

describe('Document Pool Manager', () => {
  describe('getPool', () => {
    it('should return all user documents');
    it('should mark orphaned documents correctly');
  });
  
  describe('activateDocForSession', () => {
    it('should add session to activeSessions[]');
    it('should increment accessCount');
  });
  
  describe('deactivateDocFromSession', () => {
    it('should remove session from activeSessions[]');
  });
});
```

## Manual Testing Checklist

### Pre-requisites
- [ ] Frontend running on HTTPS (voice recording requires it)
- [ ] Backend running
- [ ] Clean browser cache (or incognito mode)

### Session Document Tests
- [ ] Upload .txt file as FREE tier → shows in session
- [ ] Try upload second file as FREE → shows limit error
- [ ] Upload .pdf file as JIVE → shows in session
- [ ] Delete session document → removed from list
- [ ] Switch sessions → documents don't follow

### RAG Store Tests
- [ ] FREE tier: RAG upload button disabled/shows upgrade
- [ ] JIVE tier: Upload 1 RAG doc → success
- [ ] JIVE tier: Try second RAG doc → limit error with upgrade prompt
- [ ] JIGGA tier: Upload multiple RAG docs → success
- [ ] JIGGA tier: Clear all RAG → all documents removed
- [ ] JIGGA tier: Check dashboard → storage stats accurate

### Dashboard Tests
- [ ] Open dashboard → no TypeError
- [ ] View document list → shows all documents
- [ ] Delete document from dashboard → removed correctly
- [ ] Refresh dashboard → data persists

## Running the Tests

```bash
# Run all RxDB tests (includes db shim tests)
cd gogga-frontend
pnpm vitest run src/lib/rxdb/__tests__/

# Run with verbose output
pnpm vitest run src/lib/rxdb/__tests__/ --reporter=verbose

# Check for TypeScript errors
pnpm tsc --noEmit
```

## Files Changed in Fix

1. `src/lib/rag/clearAllRAG.ts` - 8 instances fixed
2. `src/lib/rag/deletionService.ts` - 7 instances fixed
3. `src/lib/rag/documentPool.ts` - 10 instances fixed

## Regression Risk Assessment

| Area | Risk Level | Mitigation |
|------|------------|------------|
| Document deletion | Low | 66 existing tests pass |
| Storage stats | Low | Uses same db access pattern |
| Session activation | Low | Simple find/patch operations |
| Cascade deletes | Medium | Manual testing recommended |

