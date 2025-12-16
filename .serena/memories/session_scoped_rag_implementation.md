# Session-Scoped RAG Implementation Status

**Status:** ✅ IMPLEMENTED  
**Date:** December 2025  
**Tests:** 127/127 passing (including 58 session-scoped tests)

## Schema Changes (db.ts - Version 8)

### Document Interface (Updated)
```typescript
interface Document {
  id?: number;
  // Session-Scoped RAG fields (v8)
  userId: string;           // Owner of the document (user's pool)
  originSessionId: string;  // Session where doc was originally uploaded
  activeSessions: string[]; // Sessions where doc is currently active for RAG
  accessCount: number;      // Usage tracking for pool management
  lastAccessedAt: Date;     // Last time doc was used in RAG
  // Legacy field - frozen at upload time
  sessionId: string;        // @deprecated Use originSessionId
  // Document content fields...
}
```

### New Database Functions

| Function | Purpose |
|----------|---------|
| `getActiveDocumentsForSession(sessionId)` | CORRECT: Filter by activeSessions |
| `getUserDocumentPool(userId)` | Get all docs in user's pool |
| `getUserDocumentCount(userId)` | Pool limit enforcement |
| `activateDocumentForSession(docId, sessionId)` | Pull doc into session |
| `deactivateDocumentFromSession(docId, sessionId)` | Remove from session (keep in pool) |
| `getOrphanedDocuments(userId)` | Find docs not active anywhere |
| `deleteDocumentFromPool(docId)` | Delete completely (cascades to chunks) |

### Migration (v7 → v8)

```typescript
.upgrade(tx => {
  return tx.table('documents').toCollection().modify(doc => {
    doc.originSessionId = doc.sessionId;  // Copy frozen reference
    doc.activeSessions = [doc.sessionId]; // Initially active where uploaded
    doc.userId = doc.userId || 'migrated_user';
    doc.accessCount = doc.accessCount || 0;
    doc.lastAccessedAt = doc.lastAccessedAt || doc.updatedAt;
  });
});
```

### Index Changes

- New: `userId` for pool queries
- New: `*activeSessions` (multi-value index)
- New: `lastAccessedAt` for recency sorting

## RAG Manager Updates (ragManager.ts)

### Key Changes

1. **setDocuments()** - Filters to only docs active in session
2. **getDocuments()** - Double-checks activeSessions filtering
3. **addDocument()** - Updates activeSessions array
4. **addExternalDocuments()** - Activates docs from pool
5. **deactivateDocument()** - Removes session from activeSessions (NEW)

### Invariant Enforcement

```typescript
getDocuments(sessionId): Document[] {
  const docs = this.documentsBySession.get(sessionId) ?? [];
  // Double-check filtering (invariant enforcement)
  return docs.filter(doc => 
    doc.activeSessions?.includes(sessionId) ?? doc.sessionId === sessionId
  );
}
```

## DocumentManager.tsx Updates

Document upload now includes session-scoped fields:

```typescript
const docId = await db.documents.add({
  userId: 'current_user', // TODO: Get from auth
  originSessionId: sessionId,
  activeSessions: [sessionId],
  accessCount: 0,
  lastAccessedAt: now,
  sessionId, // Legacy (frozen)
  // ...content fields
});
```

## deleteSession() Behavior Change

**Critical:** Session deletion now DEACTIVATES documents, doesn't delete them:

```typescript
await db.documents.toCollection().modify(doc => {
  if (doc.activeSessions?.includes(sessionId)) {
    doc.activeSessions = doc.activeSessions.filter(id => id !== sessionId);
  }
});
```

## Remaining Work

1. **Auth Integration** - Set real `userId` from session
2. **DocumentPoolModal** - UI for cross-session selection
3. **Debug Panel** - Token budget visualization
4. **E2E Testing** - Manual workflow validation

## Run Tests

```bash
cd gogga-frontend && npx vitest run src/lib
# 127 tests passing
```
