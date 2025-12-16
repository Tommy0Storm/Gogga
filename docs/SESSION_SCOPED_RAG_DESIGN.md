# Session-Scoped RAG Design

> **⚠️ SUPERSEDED:** See [RAG_SYSTEM_DESIGN.md](./RAG_SYSTEM_DESIGN.md) for current architecture.  
> This document is retained for historical reference on RxDB migration details.

> **Last Updated:** December 15, 2025  
> **Status:** 📦 ARCHIVED - Superseded by RAG_SYSTEM_DESIGN.md

## Core Principle

> **Documents belong to users, not sessions. Sessions borrow documents temporarily.**

This single abstraction fixes:
- Embeddings lost on refresh → RxDB persistence ✅
- Dual schema confusion → Document-centric vectors ✅
- Inconsistent limits → Explicit 100-doc pool ✅
- Session bleed → `activeSessions[]` filtering ✅

## Implementation Status (December 2025)

| Component | Status | File |
|-----------|--------|------|
| DocumentDoc schema with RAG fields | ✅ Done | `rxdb/schemas.ts` |
| db.ts → RxDB shim switchover | ✅ Done | `lib/db.ts` |
| Dexie legacy backup | ✅ Done | `lib/db-dexie-legacy.ts` |
| Dynamic imports (Dexie conflict fix) | ✅ Done | `lib/db.ts` |
| GoggaSmart skill schema | ✅ Done | `rxdb/schemas.ts` |
| Schema migration strategies | ✅ Done | `rxdb/schemaMigration.ts` |
| Migration utilities | ✅ Done | `rxdb/migration.ts` |
| Integration tests | ✅ Done | 25 tests passing |

---

## Memory Type Definitions

| Memory Type | Persistence | Structure | Use Case |
|-------------|-------------|-----------|----------|
| **Volatile Memory** | Non-persistent, session-only | Chat turns, reasoning | Active conversation |
| **Authoritative State** | Persistent, structured facts | Non-vector, injected | User facts, preferences |
| **Corpus / RAG** | Persistent documents + summaries | Vectorised, retrieved | Document recall |

---

## Critical Invariants ⚠️

**NEVER VIOLATE THESE:**

1. **RAG retrieval MUST filter by `activeSessions.includes(sessionId)`, NEVER by `originSessionId`**
   - Violating this reintroduces ghost context bugs

2. **Authoritative state tokens are NEVER evicted in favour of RAG**
   - If token pressure: drop lowest-ranked RAG chunks, never drop state

3. **Deleting documents does NOT delete authoritative facts**
   - Mark fact with `sourceRemoved: true`, keep the fact itself

4. **Vectors belong to documents, not sessions**
   - VectorEmbeddingDoc has `documentId`, not `sessionId`

5. **Chat is never authoritative**
   - Volatile memory is for reasoning only, always disposable

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER DOCUMENT POOL                                │
│                         (Max 100 docs per user)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Doc A    │  │ Doc B    │  │ Doc C    │  │ Doc D    │  │ Doc E    │ ...  │
│  │ origin:1 │  │ origin:1 │  │ origin:2 │  │ origin:2 │  │ origin:3 │      │
│  │ active:  │  │ active:  │  │ active:  │  │ active:  │  │ active:  │      │
│  │ [1,3]    │  │ [1]      │  │ [2,3]    │  │ [2]      │  │ [3]      │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└───────┼─────────────┼─────────────┼─────────────┼─────────────┼────────────┘
        │             │             │             │             │
        ▼             ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SESSION ACTIVATION LAYER                            │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│     SESSION 1       │     SESSION 2       │     SESSION 3 (CURRENT)         │
│  ┌─────┐ ┌─────┐   │  ┌─────┐ ┌─────┐   │  ┌─────┐ ┌─────┐ ┌─────┐        │
│  │Doc A│ │Doc B│   │  │Doc C│ │Doc D│   │  │Doc A│ │Doc C│ │Doc E│        │
│  └─────┘ └─────┘   │  └─────┘ └─────┘   │  └─────┘ └─────┘ └─────┘        │
│                     │                     │  ↑ pulled  ↑ pulled  ↑ new     │
│  [Inactive]         │  [Inactive]         │  [ACTIVE - RAG searches here]  │
└─────────────────────┴─────────────────────┴─────────────────────────────────┘
```

---

## Document Lifecycle State Machine

```
                                    ┌─────────────────┐
                                    │   USER UPLOAD   │
                                    └────────┬────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │  Check: Pool < 100 docs?     │
                              └──────────────┬───────────────┘
                                   │                  │
                                  YES                 NO
                                   │                  │
                                   ▼                  ▼
                    ┌──────────────────────┐  ┌──────────────────────┐
                    │ Extract + Chunk +    │  │ BLOCK: "Limit reached│
                    │ Generate Embeddings  │  │ Delete docs to       │
                    └──────────┬───────────┘  │ continue"            │
                               │              └──────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Store:               │
                    │ • Document (RxDB)    │
                    │ • Chunks (RxDB)      │
                    │ • Vectors (RxDB)     │
                    │ • originSession: X   │
                    │ • activeSessions:[X] │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ USER QUERIES      │ │ USER STARTS       │ │ USER PULLS DOC    │
│ (same session)    │ │ NEW SESSION       │ │ INTO NEW SESSION  │
└─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘
          │                     │                     │
          ▼                     ▼                     ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ RAG searches this │ │ Doc NOT active    │ │ activeSessions    │
│ doc (in active)   │ │ in new session    │ │ += newSessionId   │
└───────────────────┘ │ (still available) │ └───────────────────┘
                      └───────────────────┘
```

---

## Schema Design

### DocumentDoc (Updated)

```typescript
interface DocumentDoc {
  id: string;
  userId: string;              // Owner (required)
  originSessionId: string;     // Session where uploaded (renamed from sessionId)
  activeSessions: string[];    // Sessions currently using this doc
  // isOrphaned: computed from activeSessions.length === 0
  accessCount: number;         // For LRU suggestions
  lastAccessedAt: string;      // Recency tracking
  
  // Existing fields
  filename: string;
  content: string;
  chunks: string[];
  chunkCount: number;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}
```

### VectorEmbeddingDoc (Updated)

```typescript
interface VectorEmbeddingDoc {
  id: string;
  documentId: string;          // Foreign key to DocumentDoc (NOT sessionId)
  chunkIndex: number;
  text: string;
  embedding: number[];         // 384-dim E5-small-v2
  
  // Distance-to-Samples indexes (existing)
  idx0: string;
  idx1: string;
  idx2: string;
  idx3: string;
  idx4: string;
  
  createdAt: string;
}
```

### AuthoritativeFact (Future)

```typescript
interface AuthoritativeFact {
  id: string;
  userId: string;
  key: string;                 // e.g., "user.name", "user.address"
  value: string;
  sourceDocumentId?: string;   // Optional: which doc this came from
  sourceRemoved: boolean;      // True if source doc was deleted
  confidence: number;          // 0-1, how certain is this fact
  createdAt: string;
  updatedAt: string;
}
```

---

## Token Budget Allocation

```typescript
const TOKEN_BUDGETS = {
  FREE:  { state: 1000, rag: 0,    volatile: 4000, response: 4000, total: 8000 },
  JIVE:  { state: 2000, rag: 3000, volatile: 6000, response: 5000, total: 16000 },
  JIGGA: { state: 3000, rag: 6000, volatile: 8000, response: 8000, total: 24000 },
};
```

**Priority order when over budget:**
1. System prompt (fixed, never cut)
2. Authoritative state (never evicted for RAG)
3. Volatile memory (summarize older turns)
4. RAG chunks (drop lowest-ranked first)
5. Response buffer (protected)

---

## Deletion Semantics

| Action | Documents | Vectors | Authoritative State |
|--------|-----------|---------|---------------------|
| Delete single document | ✅ Deleted | ✅ Deleted | ⚠️ Mark `sourceRemoved` |
| Delete session | ❌ Kept | ❌ Kept | ❌ Kept |
| Delete all documents | ✅ Deleted | ✅ Deleted | ⚠️ Mark all sources removed |
| "Forget everything" | ✅ Deleted | ✅ Deleted | ✅ Deleted |
| Case/project deleted | ✅ Deleted | ✅ Deleted | ✅ Deleted |

### Session Deletion Logic

When session X is deleted:
1. For each document where `activeSessions.includes(X)`:
   - Remove X from `activeSessions[]`
   - If `activeSessions.length === 0` → document becomes orphaned
2. Orphaned documents remain in pool, pullable into future sessions
3. User can explicitly delete orphaned docs via Document Manager

---

## RAG Query Pipeline

```
1. User Query: "What does my lease say about pets?"
                              │
                              ▼
2. Get Active Docs: documents.filter(d => d.activeSessions.includes(sessionId))
   └─ CRITICAL: Never filter by originSessionId!
                              │
                              ▼
3. Vector/Keyword Search (tier-dependent)
   └─ JIVE: FlexSearch keyword matching
   └─ JIGGA: E5 embeddings + cosine similarity (persisted in RxDB)
                              │
                              ▼
4. Token Budget Check
   └─ Sum chunk tokens, truncate if over budget.rag limit
   └─ Never exceed JIGGA: 6000, JIVE: 3000 tokens
                              │
                              ▼
5. Return ranked chunks with source attribution
```

---

## Core Rules Table

| Scenario | Volatile | Authoritative State | Corpus/RAG | What Is Sent |
|----------|----------|---------------------|------------|--------------|
| Active chat session | Used | Injected (topic-filtered) | Active docs only | Vol + State + RAG |
| Thinking/drafting | Used | Injected | Not used | Vol + State |
| Conclusion reached | Trimmed | Updated if fact settled | Summary stored if useful | State only |
| User deletes chat | Deleted | Kept | Kept | State only |
| User deletes document | N/A | Kept (mark source removed) | Deleted (doc + vectors) | State only |
| User returns later | Empty | Injected | Retrieved if queried | State + RAG |
| "What did we say about X?" | Empty | Injected | Retrieve summaries | State + RAG |
| User says "forget everything" | Deleted | Deleted | Deleted | Clean slate |

---

## 100-Document Limit

- **Type**: Hard limit (block upload when reached)
- **Scope**: Per-user, not per-session
- **Enforcement**: Check at upload time before processing
- **Future**: Schema supports soft limit with LRU suggestions via `accessCount` and `lastAccessedAt`

```typescript
async function canUpload(userId: string): Promise<{ allowed: boolean; count: number }> {
  const count = await documents.count({ userId });
  return { allowed: count < 100, count };
}
```

---

## Cross-Session Document Pull

Flow when user references unavailable document:

1. Gogga detects reference to document not in `activeSessions`
2. Search available pool by filename/content
3. Ask: "I found 'lease.pdf' from a previous chat. Include it?"
4. User confirms → `doc.activeSessions.push(currentSessionId)`
5. Document now searchable in current session

**UX by tier:**
- JIVE: User explicitly opens Document Manager
- JIGGA: Auto-suggest + manual access

---

## Implementation Files

| File | Purpose |
|------|---------|
| `gogga-frontend/src/lib/rag/documentPool.ts` | NEW: DocumentPoolManager singleton |
| `gogga-frontend/src/lib/rag/sessionContext.ts` | NEW: Per-session RAG context with token budgeting |
| `gogga-frontend/src/lib/rag/deletionService.ts` | NEW: Cascade deletion logic |
| `gogga-frontend/src/lib/rxdb/schemas.ts` | UPDATE: Add new fields to DocumentDoc |
| `gogga-frontend/src/lib/ragManager.ts` | UPDATE: Use DocumentPoolManager |
| `gogga-frontend/src/hooks/useRAG.ts` | UPDATE: Add pool management functions |
| `gogga-frontend/src/components/DocumentManager.tsx` | NEW: Pool management UI |

---

## RAG Context Prompt Format

When injecting RAG context into the model prompt:

```
[DOCUMENT CONTEXT]
The following excerpts are from documents the user has uploaded. Use them to inform your response, but do not fabricate information beyond what is provided.

---
Source: lease_agreement.pdf (page 3)
"Tenants are prohibited from keeping pets on the premises without prior written consent from the landlord. A pet deposit of R2,500 is required."
---
Source: tenant_rules.pdf (section 4.2)
"Animals are not permitted in common areas. Service animals are exempt with proper documentation."
---

[END DOCUMENT CONTEXT]
```

### Key Rules for RAG Prompt:
1. Always attribute sources with filename
2. Include page/section if available
3. Use clear delimiters (`---`)
4. Instruct model not to fabricate beyond provided content
5. Keep within token budget (truncate lowest-ranked chunks first)

---

## Future Enhancements (Not Required Now)

1. **Two-stage retrieval**: Vector search (wide) → BM25/keyword rerank
2. **Soft limit with LRU**: Warn at 90 docs, suggest deletions
3. **Backend RAG metadata**: Send `{ ragChunksUsed, ragTokens }` for analytics (never content)
4. **Authoritative fact extraction**: LLM proposes facts, user confirms

---

## Related Documents

- `docs/DATA_VISUALIZATION_SYSTEM.md` - Chart generation system
- `docs/NEXTJS_16_IMPLEMENTATION.md` - Next.js 16 features
- `docs/REACT_19_INTEGRATION.md` - React 19.2 patterns
