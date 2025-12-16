# Session-Scoped RAG Design

> **Last Updated:** December 15, 2025
> **Status:** ✅ IMPLEMENTED - RxDB Migration Complete
> **Full Document:** `docs/SESSION_SCOPED_RAG_DESIGN.md`

## Core Principle

> **Documents belong to users, not sessions. Sessions borrow documents temporarily.**

## Critical Invariants ⚠️

**NEVER VIOLATE:**

1. **RAG retrieval MUST filter by `activeSessions.includes(sessionId)`, NEVER by `originSessionId`**
2. **Authoritative state tokens are NEVER evicted in favour of RAG**
3. **Deleting documents does NOT delete authoritative facts** (mark `sourceRemoved: true`)
4. **Vectors belong to documents, not sessions** (`documentId`, not `sessionId`)
5. **Chat is never authoritative** - volatile memory is disposable

## Memory Types

| Type | Persistence | Structure | Use |
|------|-------------|-----------|-----|
| **Volatile** | Session-only | Chat turns | Reasoning |
| **Authoritative State** | Persistent | Facts (non-vector) | User data |
| **Corpus/RAG** | Persistent | Vectorised docs | Recall |

## Token Budgets

```typescript
const TOKEN_BUDGETS = {
  FREE:  { state: 1000, rag: 0,    volatile: 4000, response: 4000 },
  JIVE:  { state: 2000, rag: 3000, volatile: 6000, response: 5000 },
  JIGGA: { state: 3000, rag: 6000, volatile: 8000, response: 8000 },
};
```

**Priority (never violate):** System Prompt > State > Volatile > RAG > Response

## Schema Changes

### DocumentDoc
- `userId: string` - Owner
- `originSessionId: string` - Where uploaded
- `activeSessions: string[]` - Sessions using doc
- `accessCount: number` - LRU tracking
- `lastAccessedAt: string` - Recency

### VectorEmbeddingDoc
- `documentId: string` - References doc (NOT sessionId)
- Vectors belong to documents, not sessions

## Deletion Semantics

| Action | Docs | Vectors | State |
|--------|------|---------|-------|
| Delete document | ✅ | ✅ | Mark sourceRemoved |
| Delete session | ❌ | ❌ | ❌ |
| "Forget everything" | ✅ | ✅ | ✅ |

## 100-Document Limit

- Hard limit per user (not session)
- Check at upload time
- `accessCount` + `lastAccessedAt` support future LRU

## Cross-Session Pull Flow

1. User references unavailable doc
2. Search available pool by filename
3. Ask: "Found 'lease.pdf'. Include it?"
4. User confirms → `activeSessions.push(currentSessionId)`

## RAG Prompt Format

```
[DOCUMENT CONTEXT]
---
Source: filename.pdf (page X)
"Extracted content here..."
---
[END DOCUMENT CONTEXT]
```

## Implementation Status (December 2025)

| Component | Status | File |
|-----------|--------|------|
| DocumentDoc with RAG fields | ✅ Done | `rxdb/schemas.ts` |
| db.ts → RxDB shim | ✅ Done | `lib/db.ts` |
| Dexie legacy backup | ✅ Done | `lib/db-dexie-legacy.ts` |
| GoggaSmart skill schema | ✅ Done | `rxdb/schemas.ts` |
| Schema migrations | ✅ Done | `rxdb/schemaMigration.ts` |
| Migration utilities | ✅ Done | `rxdb/migration.ts` |
| Integration tests | ✅ Done | 25 tests passing |

## Implementation Files

| File | Status |
|------|--------|
| `src/lib/db.ts` | ✅ RxDB shim (primary) |
| `src/lib/db-dexie-legacy.ts` | ✅ Original backup |
| `src/lib/rxdb/schemas.ts` | ✅ Updated with RAG fields |
| `src/lib/rxdb/schemaMigration.ts` | ✅ v1 migration strategies |
| `src/lib/rxdb/migration.ts` | ✅ Dexie→RxDB migration |
| `src/lib/ragManager.ts` | Needs: Use activeSessions |
| `src/hooks/useRAG.ts` | Needs: Pool functions |
| `src/components/DocumentManager.tsx` | Needs: Pool UI |

## Related

- `rxdb_implementation.md` - RxDB 16.21.1 setup
- `local_rag_implementation.md` - Current RAG (E5-small-v2)
- `buddy_system.md` - User relationship tracking
