# Session-Scoped RAG Test Plan

> **⚠️ REFERENCE:** See [RAG_SYSTEM_DESIGN.md](./RAG_SYSTEM_DESIGN.md) for current architecture.  
> Test plan remains valid for RxDB document/vector operations.

**Status:** ✅ ALL 58 TESTS PASSING  
**Last Run:** December 2025  
**Test Suite:** `gogga-frontend/src/lib/__tests__/sessionScoped.test.ts`  

---

## Executive Summary

This document outlines the comprehensive test plan for the Session-Scoped RAG architecture. The test suite validates **invariants, not features**—meaning tests remain meaningful across refactors and regressions surface immediately.

The suite covers 9 categories including adversarial fallback scenarios and topic relevance filtering.

---

## Explicitly Not Tested (Non-Goals)

> These are intentionally out of scope for this test suite:

| Area | Rationale |
|------|-----------|
| Concurrent mutation / race conditions | Browser-only, single-tab design for v1 |
| Multi-tab synchronization | Future concern, not current architecture |
| Backend persistence | Client-only by design (RxDB/IndexedDB) |
| Embedding model correctness | Tested separately in embedding tests |
| Performance under large pools (>50 docs) | Load testing is separate concern |
| UI/UX failure modes | Product testing, not system testing |

---

## Architecture Under Test

```
User Pool (100 docs max)
    │
    ├── Document A ──→ activeSessions: [session1, session3]
    ├── Document B ──→ activeSessions: [session1]
    ├── Document C ──→ activeSessions: [session2, session3]
    ├── Document D ──→ activeSessions: [session2]
    ├── Document E ──→ activeSessions: [session3]
    └── Orphan Doc ──→ activeSessions: []
```

**Critical Rule:** RAG retrieval MUST filter by `activeSessions.includes(sessionId)`, NEVER by `originSessionId`.

---

## Test Files

| File | Purpose | Tests |
|------|---------|-------|
| [sessionScoped.test.ts](../gogga-frontend/src/lib/__tests__/sessionScoped.test.ts) | Main test suite | 50 |
| [sessionScopedFixtures.ts](../gogga-frontend/src/lib/__tests__/fixtures/sessionScopedFixtures.ts) | Test data & helpers | - |
| [invariants.ts](../gogga-frontend/src/lib/rag/invariants.ts) | Runtime assertions | - |

---

## Test Categories

### A. Session & Refresh Scenarios (8 tests)

Tests ensuring session state persists correctly across page refreshes and tab operations.

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| A1a | Refresh during active session | Volatile memory lost, session restored, docs preserved |
| A1b | Preserve active docs across refresh | Same document count before/after refresh |
| A1c | No re-embedding after refresh | `reEmbedRequired=false`, embeddings from RxDB |
| A2a | Hard reload / tab close / reopen | Session state restored from IndexedDB |
| A2b | Empty volatile memory after reopen | `volatileMemory=null` |
| A3a | New session, same user | Zero active docs by default |
| A3b | See all docs in user pool | All 6 documents visible in pool |
| A3c | No leakage from other sessions | Brand new session has zero docs |

**Key Invariant:** Refresh never requires re-embedding (vectors persist in RxDB).

---

### B. Cross-Session Document Control (6 tests)

Tests ensuring documents can be pulled into new sessions without affecting others.

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| B4a | Pull doc into new session | Session added to `activeSessions[]` |
| B4b | Doc available for RAG after pull | Immediate inclusion in RAG retrieval |
| B4c | Other sessions unaffected | Pulling doesn't modify other sessions |
| B5a | Same doc active in multiple sessions | Returns in both sessions' RAG |
| B5b | No document duplication | Single storage instance by ID |
| B5c | No shared volatile memory | Each session has independent conversation |

**Key Invariant:** Documents are shared by reference, not copied.

---

### C. Deletion Scenarios - CRITICAL (14 tests)

The most important test category. Validates cascade behavior and fact preservation.

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| C6a | Delete single document | Document removed from storage |
| C6b | Cascade delete vectors | All embeddings for doc deleted |
| C6c | Preserve facts | Facts remain, `sourceRemoved=true` |
| C6d | Remove from all activeSessions | Doc gone from all sessions |
| C6e | Never return in RAG | Deleted doc excluded from retrieval |
| C6f | Invariant assertion passes | `assertFactsPreservedOnDocDelete` validates |
| C7a | Delete session - docs preserved | Documents NOT deleted |
| C7b | Delete session - vectors preserved | Embeddings NOT deleted |
| C7c | Delete session - facts preserved | Facts NOT deleted |
| C7d | Orphan docs | Docs only in deleted session become orphaned |
| C7e | Docs active elsewhere | Multi-session docs remain active |
| C8a | Delete all documents | All docs and vectors removed |
| C8b | All facts marked | All facts get `sourceRemoved=true` |
| C9 | Forget everything | Explicit clean slate (docs + vectors + facts) |

**Key Invariant:** Deleting documents NEVER deletes authoritative facts.

---

### D. Token Budget & RAG Discipline (4 tests)

Tests ensuring token budgets are respected and state is never sacrificed for RAG.

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| D10a | RAG over budget | Lowest-ranked chunks dropped first |
| D10b | Never evict state | Assertion passes for valid state |
| D10c | Throw on state eviction | `InvariantViolationError` if state reduced |
| D11 | State + RAG > total | RAG trimmed aggressively, state untouched |

**Key Invariant:** Authoritative state tokens are NEVER evicted to make room for RAG.

**Token Budgets:**
```
Tier   | State | RAG   | Volatile | Response | Total
-------|-------|-------|----------|----------|-------
FREE   | 1000  | 0     | 4000     | 4000     | 8000
JIVE   | 2000  | 3000  | 6000     | 5000     | 16000
JIGGA  | 3000  | 6000  | 8000     | 8000     | 24000
```

---

### E. Cold Return / Continuity Honesty (4 tests)

Tests ensuring the system doesn't hallucinate memory it doesn't have.

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| E12a | Follow-up after reset | Volatile memory is null |
| E12b | Authoritative facts available | Facts accessible (e.g., "pet deposit R2,500") |
| E13a | "What did we say about X?" | Retrieves from RAG, not hallucination |
| E13b | Correct attribution | Source filename included in context |

**Key Invariant:** System never implies memory it does not have.

---

### F. Pool Limit Enforcement (4 tests)

Tests ensuring the 100-document pool limit is enforced.

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| F14a | Upload doc #101 | `InvariantViolationError` thrown |
| F14b | Upload under capacity | Upload succeeds (50/100) |
| F14c | Clear error message | Error contains "100/100" |
| F15 | Delete one, upload again | Upload succeeds (99/100) |

**Key Invariant:** Pool limit is strictly enforced with clear messaging.

---

### G. Invariant Spot Checks (10 tests)

Direct validation of core invariants.

| ID | Invariant | Test |
|----|-----------|------|
| G1a | activeSessions filtering | All returned docs contain sessionId |
| G1b | Never filter by originSessionId | Throws if attempted |
| G1c | Detect ghost docs | Wrong filter produces warning |
| G2 | Facts preserved on doc delete | Same fact count after delete |
| G3a | No re-embed after refresh | `reEmbedRequired=false` |
| G3b | Embeddings persist | RxDB contains embeddings |
| G4a | No volatile after cold start | `volatileMemory=null` |
| G4b | Only facts + RAG for context | Valid sources exist |
| G5a | Vectors have documentId | All pass assertion |
| G5b | Missing documentId throws | `InvariantViolationError` |

---

## Invariant Assertions

Located in `gogga-frontend/src/lib/rag/invariants.ts`:

```typescript
assertNeverFilterByOriginSession(filterField)   // INV-01
assertStateNeverEvicted(before, after, ragAdded) // INV-02
assertFactsPreservedOnDocDelete(docId, before, after) // INV-03
assertVectorsBelongToDocs(vector)               // INV-04
assertPoolLimit(current, limit, action)         // INV-05
```

### Invariant Registry

| ID | Invariant | Tests Protecting |
|----|-----------|------------------|
| INV-01 | RAG filters by `activeSessions.includes(sessionId)` | G1a-c, I1-3 |
| INV-02 | State tokens NEVER evicted for RAG | D10b-c, D11 |
| INV-03 | Deleting documents never deletes facts | C6c, C6f, G2, H3 |
| INV-04 | Vectors belong to documents, not sessions | G5a-b |
| INV-05 | Pool limit enforced (100 docs max) | F14a-c, F15 |
| INV-06 | Only topic-relevant facts injected | H1-3 |
| INV-07 | Mid-query mutations handled gracefully | I4-5 |

These are **dev-only** runtime checks that throw `InvariantViolationError` with detailed context.

---

## Running Tests

```bash
# Run Session-Scoped RAG tests only
cd gogga-frontend && npx vitest run src/lib/__tests__/sessionScoped.test.ts

# Run with verbose output
cd gogga-frontend && npx vitest run src/lib/__tests__/sessionScoped.test.ts --reporter=verbose

# Run in watch mode
cd gogga-frontend && npx vitest src/lib/__tests__/sessionScoped.test.ts
```

---

## Test Results Summary

```
✅ A. Session & Refresh Scenarios     (8/8)
✅ B. Cross-Session Document Control  (6/6)
✅ C. Deletion Scenarios (CRITICAL)   (14/14)
✅ D. Token Budget & RAG Discipline   (4/4)
✅ E. Cold Return / Continuity        (4/4)
✅ F. Pool Limit Enforcement          (4/4)
✅ G. Invariant Spot Checks           (10/10)
✅ H. Topic Relevance Filtering       (3/3)   [NEW]
✅ I. Adversarial RAG Fallback        (5/5)   [NEW]
────────────────────────────────────────
   TOTAL                              58/58 ✅
```

---

## Test Categories

### H. Topic Relevance Filtering (3 tests) [NEW]

Tests ensuring facts are selectively injected based on query relevance.

| ID | Scenario | Expected Behavior | Invariant |
|----|----------|-------------------|-----------|
| RAG-H-TOPIC-01 | Selective fact injection | Only topic-relevant facts injected | INV-06 |
| RAG-H-TOPIC-02 | No match exclusion | Zero facts when query has no topic match | INV-06 |
| RAG-H-TOPIC-03 | sourceRemoved exclusion | Removed facts never injected regardless of topic | INV-03 |

**Key Invariant (INV-06):** Only topic-relevant, non-removed facts are injected.

---

### I. Adversarial RAG Fallback Tests (5 tests) [NEW]

Tests ensuring no "helpful" fallback to global search when session scope is empty or corrupted.

| ID | Scenario | Expected Behavior | Invariant |
|----|----------|-------------------|-----------|
| RAG-I-ADV-01 | Empty activeSessions | Zero chunks returned | INV-01 |
| RAG-I-ADV-02 | No global fallback | Empty result, not global vectors | INV-01 |
| RAG-I-ADV-03 | Inactive doc exclusion | No chunks from inactive docs | INV-01 |
| RAG-I-ADV-04 | Deactivation during query | Graceful exclusion | INV-07 |
| RAG-I-ADV-05 | Deletion during query | Graceful exclusion | INV-07 |

**Key Invariant (INV-07):** Mid-query mutations handled gracefully without fallback.

---

## Next Implementation Steps

1. **Schema Migration** - Add `originSessionId`, `activeSessions[]`, `accessCount`, `lastAccessedAt` to Document schema
2. **RAG Filtering Fix** - Update `ragManager.ts` to filter by `activeSessions.includes(sessionId)`
3. **DocumentPoolModal** - Create UI component for cross-session document selection
4. **Debug Panel** - Lightweight opt-in panel showing token budgets in real-time
5. **Integration Tests** - Test with actual RxDB operations

---

## Related Documents

- [SESSION_SCOPED_RAG_DESIGN.md](./SESSION_SCOPED_RAG_DESIGN.md) - Full architecture specification
- Serena Memory: `session_scoped_rag_design` - Quick reference
- Serena Memory: `session_scoped_rag_test_results` - Test results tracking
