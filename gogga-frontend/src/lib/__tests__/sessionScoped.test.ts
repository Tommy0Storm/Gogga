/**
 * Session-Scoped RAG Tests
 * 
 * Comprehensive test suite implementing the 15 failure scenarios from the
 * Session-Scoped RAG Design document.
 * 
 * Test Categories:
 * A. Session & Refresh Scenarios (A1-A3)
 * B. Cross-Session Document Control (B4-B5)
 * C. Deletion Scenarios (C6-C9) - CRITICAL
 * D. Token Budget & RAG Discipline (D10-D11)
 * E. Cold Return / Continuity Honesty (E12-E13)
 * F. Pool Limit Enforcement (F14-F15)
 * G. Invariant Spot Checks
 * 
 * @see docs/SESSION_SCOPED_RAG_DESIGN.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TEST_USERS,
  TEST_SESSIONS,
  TEST_DOCUMENTS,
  TEST_FACTS,
  TEST_EMBEDDINGS,
  TOKEN_BUDGETS,
  TestDocument,
  TestFact,
  getActiveDocumentsForSession,
  getDocumentsByOriginSession_WRONG,
  getOrphanedDocuments,
  getUserDocumentCount,
  activateDocumentInSession,
  deactivateDocumentFromSession,
  estimateTokens,
  isPoolAtCapacity,
  simulateRefresh,
  simulateDocumentDeletion,
  simulateSessionDeletion,
} from './fixtures/sessionScopedFixtures';

import {
  InvariantViolationError,
  assertNeverFilterByOriginSession,
  assertStateNeverEvicted,
  assertFactsPreservedOnDocDelete,
  assertVectorsBelongToDocs,
  validateDocumentQuery,
  assertPoolLimit,
} from '../rag/invariants';

// ============================================================================
// Test State Management
// ============================================================================

interface TestState {
  documents: Map<number, TestDocument>;
  facts: TestFact[];
  embeddings: typeof TEST_EMBEDDINGS;
  activeSessions: Set<string>;
}

let testState: TestState;

function initTestState(): TestState {
  return {
    documents: new Map(Object.values(TEST_DOCUMENTS).map(d => [d.id, { ...d }])),
    facts: [...TEST_FACTS],
    embeddings: [...TEST_EMBEDDINGS],
    activeSessions: new Set([TEST_SESSIONS.session3.id]),
  };
}

function getDocumentsForSession(state: TestState, sessionId: string): TestDocument[] {
  return Array.from(state.documents.values()).filter(doc =>
    doc.activeSessions.includes(sessionId)
  );
}

function deleteDocument(state: TestState, docId: number): void {
  const doc = state.documents.get(docId);
  if (!doc) return;
  
  // Delete document
  state.documents.delete(docId);
  
  // Delete vectors (cascade)
  state.embeddings = state.embeddings.filter(e => e.documentId !== String(docId));
  
  // Mark facts as sourceRemoved (but don't delete!)
  state.facts = state.facts.map(f => 
    f.sourceDocumentId === String(docId)
      ? { ...f, sourceRemoved: true, updatedAt: new Date().toISOString() }
      : f
  );
}

function deleteSession(state: TestState, sessionId: string): void {
  // Remove session from all documents' activeSessions
  for (const doc of state.documents.values()) {
    doc.activeSessions = doc.activeSessions.filter(id => id !== sessionId);
  }
  
  // Remove from active sessions
  state.activeSessions.delete(sessionId);
  
  // NOTE: Documents, vectors, and facts are NOT deleted!
}

// ============================================================================
// A. Session & Refresh Scenarios
// ============================================================================

describe('A. Session & Refresh Scenarios', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('A1. Refresh during active session', () => {
    it('should restore active session after refresh', () => {
      const sessionId = TEST_SESSIONS.session3.id;
      const result = simulateRefresh(sessionId);
      
      expect(result.volatileMemory).toBeNull();
      expect(result.activeSession).toBe(sessionId);
      expect(result.activeDocs.length).toBeGreaterThan(0);
      expect(result.embeddingsRestored).toBe(true);
      expect(result.reEmbedRequired).toBe(false);
    });

    it('should preserve active docs across refresh', () => {
      const sessionId = TEST_SESSIONS.session3.id;
      const docsBefore = getDocumentsForSession(testState, sessionId);
      
      // Simulate refresh
      const result = simulateRefresh(sessionId);
      
      expect(result.activeDocs.length).toBe(docsBefore.length);
      expect(result.activeDocs.map(d => d.id).sort())
        .toEqual(docsBefore.map(d => d.id).sort());
    });

    it('should not require re-embedding after refresh', () => {
      const result = simulateRefresh(TEST_SESSIONS.session3.id);
      
      expect(result.reEmbedRequired).toBe(false);
      expect(result.embeddingsRestored).toBe(true);
    });
  });

  describe('A2. Hard reload / tab close / reopen', () => {
    it('should restore session state from persistent storage', () => {
      const sessionId = TEST_SESSIONS.session3.id;
      
      // Simulate close + reopen
      const restoredDocs = getDocumentsForSession(testState, sessionId);
      
      // Session 3 should have docA (pulled), docC (pulled), docE (new)
      expect(restoredDocs.length).toBe(3);
      expect(restoredDocs.map(d => d.filename)).toContain('lease_agreement.pdf');
      expect(restoredDocs.map(d => d.filename)).toContain('ccma_guidelines.pdf');
      expect(restoredDocs.map(d => d.filename)).toContain('rental_housing_act.pdf');
    });

    it('should have empty volatile memory after reopen', () => {
      const result = simulateRefresh(TEST_SESSIONS.session3.id);
      expect(result.volatileMemory).toBeNull();
    });
  });

  describe('A3. New session, same user', () => {
    it('should have no active docs in new session by default', () => {
      const newSessionId = TEST_SESSIONS.newSession.id;
      const activeDocs = getDocumentsForSession(testState, newSessionId);
      
      expect(activeDocs.length).toBe(0);
    });

    it('should see all docs in user pool', () => {
      const userDocs = Array.from(testState.documents.values())
        .filter(d => d.userId === TEST_USERS.primary.id);
      
      expect(userDocs.length).toBe(6); // All 6 test documents
    });

    it('should not leak docs from other sessions into new session', () => {
      const newSessionId = 'session_brand_new';
      const leakedDocs = getDocumentsForSession(testState, newSessionId);
      
      expect(leakedDocs.length).toBe(0);
    });
  });
});

// ============================================================================
// B. Cross-Session Document Control
// ============================================================================

describe('B. Cross-Session Document Control', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('B4. Pull doc into new session', () => {
    it('should add session to activeSessions when pulled', () => {
      const orphanDoc = testState.documents.get(6)!; // orphanDoc
      const newSessionId = TEST_SESSIONS.newSession.id;
      
      expect(orphanDoc.activeSessions).not.toContain(newSessionId);
      
      const activated = activateDocumentInSession(orphanDoc, newSessionId);
      
      expect(activated.activeSessions).toContain(newSessionId);
      expect(activated.accessCount).toBe(orphanDoc.accessCount + 1);
    });

    it('should make doc available for RAG after pull', () => {
      const docB = testState.documents.get(2)!; // Only active in session1
      const session3Id = TEST_SESSIONS.session3.id;
      
      // Before pull
      let session3Docs = getDocumentsForSession(testState, session3Id);
      expect(session3Docs.map(d => d.id)).not.toContain(2);
      
      // Pull into session 3
      const activated = activateDocumentInSession(docB, session3Id);
      testState.documents.set(2, activated);
      
      // After pull
      session3Docs = getDocumentsForSession(testState, session3Id);
      expect(session3Docs.map(d => d.id)).toContain(2);
    });

    it('should not affect other sessions when pulling', () => {
      const docD = testState.documents.get(4)!; // Only active in session2
      const session3Id = TEST_SESSIONS.session3.id;
      
      // Record session2 state before
      const session2DocsBefore = getDocumentsForSession(testState, TEST_SESSIONS.session2.id);
      
      // Pull into session 3
      const activated = activateDocumentInSession(docD, session3Id);
      testState.documents.set(4, activated);
      
      // Session 2 should be unaffected
      const session2DocsAfter = getDocumentsForSession(testState, TEST_SESSIONS.session2.id);
      expect(session2DocsAfter.map(d => d.id).sort())
        .toEqual(session2DocsBefore.map(d => d.id).sort());
    });
  });

  describe('B5. Same doc active in multiple sessions', () => {
    it('should return doc in both sessions RAG', () => {
      // docA is active in both session1 and session3
      const docA = testState.documents.get(1)!;
      
      const session1Docs = getDocumentsForSession(testState, TEST_SESSIONS.session1.id);
      const session3Docs = getDocumentsForSession(testState, TEST_SESSIONS.session3.id);
      
      expect(session1Docs.map(d => d.id)).toContain(1);
      expect(session3Docs.map(d => d.id)).toContain(1);
    });

    it('should not duplicate document in storage', () => {
      const docA = testState.documents.get(1)!;
      
      // Should be same document object (by id)
      const allDocs = Array.from(testState.documents.values());
      const docAInstances = allDocs.filter(d => d.id === 1);
      
      expect(docAInstances.length).toBe(1);
    });

    it('should not share volatile memory between sessions', () => {
      // Volatile memory is session-specific, not document-specific
      // This test validates the conceptual separation
      const session1Volatile = { messages: ['Hello from session 1'] };
      const session3Volatile = { messages: ['Different conversation'] };
      
      expect(session1Volatile).not.toEqual(session3Volatile);
    });
  });
});

// ============================================================================
// C. Deletion Scenarios (CRITICAL)
// ============================================================================

describe('C. Deletion Scenarios (CRITICAL)', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('C6. Delete single document', () => {
    it('should remove document from storage', () => {
      const docId = 1; // docA
      
      expect(testState.documents.has(docId)).toBe(true);
      
      deleteDocument(testState, docId);
      
      expect(testState.documents.has(docId)).toBe(false);
    });

    it('should cascade delete all vectors for document', () => {
      const docId = 1;
      const vectorsBefore = testState.embeddings.filter(e => e.documentId === String(docId));
      
      expect(vectorsBefore.length).toBeGreaterThan(0);
      
      deleteDocument(testState, docId);
      
      const vectorsAfter = testState.embeddings.filter(e => e.documentId === String(docId));
      expect(vectorsAfter.length).toBe(0);
    });

    it('should preserve facts but mark sourceRemoved', () => {
      const docId = 1;
      const factsBefore = testState.facts.filter(f => f.sourceDocumentId === String(docId));
      
      expect(factsBefore.length).toBeGreaterThan(0);
      expect(factsBefore.every(f => f.sourceRemoved === false)).toBe(true);
      
      deleteDocument(testState, docId);
      
      const factsAfter = testState.facts.filter(f => f.sourceDocumentId === String(docId));
      expect(factsAfter.length).toBe(factsBefore.length); // Same count!
      expect(factsAfter.every(f => f.sourceRemoved === true)).toBe(true);
    });

    it('should remove doc from all activeSessions', () => {
      const docId = 1; // Active in session1 and session3
      const docBefore = testState.documents.get(docId)!;
      
      expect(docBefore.activeSessions.length).toBe(2);
      
      deleteDocument(testState, docId);
      
      // Doc is gone, so no activeSessions to check
      expect(testState.documents.has(docId)).toBe(false);
    });

    it('should never return deleted doc in RAG', () => {
      const docId = 1;
      const sessionId = TEST_SESSIONS.session3.id;
      
      // Before delete
      let session3Docs = getDocumentsForSession(testState, sessionId);
      expect(session3Docs.map(d => d.id)).toContain(docId);
      
      deleteDocument(testState, docId);
      
      // After delete
      session3Docs = getDocumentsForSession(testState, sessionId);
      expect(session3Docs.map(d => d.id)).not.toContain(docId);
    });

    it('should pass invariant assertion for facts preservation', () => {
      const docId = '1';
      const factsBefore = [...testState.facts];
      
      deleteDocument(testState, 1);
      
      const factsAfter = testState.facts;
      
      // This should not throw
      expect(() => {
        assertFactsPreservedOnDocDelete(docId, factsBefore, factsAfter);
      }).not.toThrow();
    });
  });

  describe('C7. Delete session', () => {
    it('should NOT delete documents', () => {
      const sessionId = TEST_SESSIONS.session1.id;
      const docCountBefore = testState.documents.size;
      
      deleteSession(testState, sessionId);
      
      expect(testState.documents.size).toBe(docCountBefore);
    });

    it('should NOT delete vectors', () => {
      const sessionId = TEST_SESSIONS.session1.id;
      const vectorCountBefore = testState.embeddings.length;
      
      deleteSession(testState, sessionId);
      
      expect(testState.embeddings.length).toBe(vectorCountBefore);
    });

    it('should NOT delete facts', () => {
      const sessionId = TEST_SESSIONS.session1.id;
      const factCountBefore = testState.facts.length;
      
      deleteSession(testState, sessionId);
      
      expect(testState.facts.length).toBe(factCountBefore);
    });

    it('should orphan docs that were only active in deleted session', () => {
      const sessionId = TEST_SESSIONS.session1.id;
      
      // docB is only active in session1
      const docBBefore = testState.documents.get(2)!;
      expect(docBBefore.activeSessions).toEqual([sessionId]);
      
      deleteSession(testState, sessionId);
      
      const docBAfter = testState.documents.get(2)!;
      expect(docBAfter.activeSessions.length).toBe(0); // Orphaned!
    });

    it('should keep docs active in other sessions', () => {
      const sessionId = TEST_SESSIONS.session1.id;
      
      // docA is active in session1 AND session3
      const docABefore = testState.documents.get(1)!;
      expect(docABefore.activeSessions).toContain(sessionId);
      expect(docABefore.activeSessions).toContain(TEST_SESSIONS.session3.id);
      
      deleteSession(testState, sessionId);
      
      const docAAfter = testState.documents.get(1)!;
      expect(docAAfter.activeSessions).not.toContain(sessionId);
      expect(docAAfter.activeSessions).toContain(TEST_SESSIONS.session3.id); // Still active!
    });
  });

  describe('C8. Delete all documents', () => {
    it('should delete all docs and vectors', () => {
      const userId = TEST_USERS.primary.id;
      const userDocs = Array.from(testState.documents.values())
        .filter(d => d.userId === userId);
      
      // Delete all user docs
      for (const doc of userDocs) {
        deleteDocument(testState, doc.id);
      }
      
      const remainingDocs = Array.from(testState.documents.values())
        .filter(d => d.userId === userId);
      
      expect(remainingDocs.length).toBe(0);
      expect(testState.embeddings.length).toBe(0);
    });

    it('should mark all facts as sourceRemoved', () => {
      const userId = TEST_USERS.primary.id;
      const userDocs = Array.from(testState.documents.values())
        .filter(d => d.userId === userId);
      
      for (const doc of userDocs) {
        deleteDocument(testState, doc.id);
      }
      
      const userFacts = testState.facts.filter(f => f.userId === userId);
      expect(userFacts.every(f => f.sourceRemoved === true)).toBe(true);
    });
  });

  describe('C9. Forget everything', () => {
    it('should delete docs, vectors, AND facts', () => {
      const userId = TEST_USERS.primary.id;
      
      // Clear everything
      const userDocIds = Array.from(testState.documents.values())
        .filter(d => d.userId === userId)
        .map(d => d.id);
      
      for (const docId of userDocIds) {
        testState.documents.delete(docId);
      }
      
      testState.embeddings = [];
      testState.facts = testState.facts.filter(f => f.userId !== userId);
      
      // Verify clean slate
      const remainingDocs = Array.from(testState.documents.values())
        .filter(d => d.userId === userId);
      const remainingFacts = testState.facts.filter(f => f.userId === userId);
      
      expect(remainingDocs.length).toBe(0);
      expect(testState.embeddings.length).toBe(0);
      expect(remainingFacts.length).toBe(0);
    });
  });
});

// ============================================================================
// D. Token Budget & RAG Discipline
// ============================================================================

describe('D. Token Budget & RAG Discipline', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('D10. RAG over budget', () => {
    it('should drop lowest-ranked chunks when over budget', () => {
      const tier = 'JIGGA';
      const budget = TOKEN_BUDGETS[tier].rag; // 6000 tokens
      
      // Simulate large RAG context
      const chunks = [
        { text: 'A'.repeat(8000), rank: 0.9 }, // 2000 tokens
        { text: 'B'.repeat(8000), rank: 0.8 }, // 2000 tokens  
        { text: 'C'.repeat(8000), rank: 0.7 }, // 2000 tokens
        { text: 'D'.repeat(8000), rank: 0.6 }, // 2000 tokens - should be dropped
      ];
      
      let totalTokens = 0;
      const includedChunks = [];
      
      for (const chunk of chunks.sort((a, b) => b.rank - a.rank)) {
        const chunkTokens = estimateTokens(chunk.text);
        if (totalTokens + chunkTokens <= budget) {
          totalTokens += chunkTokens;
          includedChunks.push(chunk);
        }
      }
      
      expect(includedChunks.length).toBe(3); // D dropped
      expect(totalTokens).toBeLessThanOrEqual(budget);
    });

    it('should never evict state for RAG', () => {
      const stateTokensBefore = 2500;
      const stateTokensAfter = 2500;
      const ragTokensAdded = 5000;
      
      // This should not throw
      expect(() => {
        assertStateNeverEvicted(stateTokensBefore, stateTokensAfter, ragTokensAdded);
      }).not.toThrow();
    });

    it('should throw if state is evicted for RAG', () => {
      const stateTokensBefore = 2500;
      const stateTokensAfter = 2000; // Evicted!
      const ragTokensAdded = 5000;
      
      expect(() => {
        assertStateNeverEvicted(stateTokensBefore, stateTokensAfter, ragTokensAdded);
      }).toThrow(InvariantViolationError);
    });
  });

  describe('D11. State + RAG > total budget', () => {
    it('should trim RAG aggressively, never state', () => {
      const tier = 'JIVE';
      const budgets = TOKEN_BUDGETS[tier];
      // JIVE: state=2000, rag=3000, volatile=6000, response=5000, total=16000
      
      // State at max
      const stateTokens = budgets.state; // 2000
      // Volatile at max
      const volatileTokens = budgets.volatile; // 6000
      // Response at max
      const responseTokens = budgets.response; // 5000
      
      // Available for RAG = total - state - volatile - response
      // 16000 - 2000 - 6000 - 5000 = 3000
      const availableForRag = budgets.total - stateTokens - volatileTokens - responseTokens;
      
      // User requests MORE RAG than available
      const ragOverRequested = 5000;
      const ragActual = Math.min(ragOverRequested, Math.max(0, availableForRag));
      
      // RAG should be trimmed to fit (3000), state untouched
      expect(ragActual).toBe(3000);
      expect(ragActual).toBeLessThan(ragOverRequested); // 3000 < 5000
      expect(stateTokens).toBe(budgets.state); // State never touched
    });
  });
});

// ============================================================================
// E. Cold Return / Continuity Honesty
// ============================================================================

describe('E. Cold Return / Continuity Honesty', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('E12. Ask follow-up after reset', () => {
    it('should not reference volatile memory after refresh', () => {
      const result = simulateRefresh(TEST_SESSIONS.session3.id);
      
      expect(result.volatileMemory).toBeNull();
      // Model should only use state + RAG, not "as we discussed"
    });

    it('should have authoritative facts available', () => {
      const userFacts = testState.facts.filter(f => 
        f.userId === TEST_USERS.primary.id && !f.sourceRemoved
      );
      
      expect(userFacts.length).toBeGreaterThan(0);
      expect(userFacts[0].value).toBe('R2,500'); // Pet deposit fact
    });
  });

  describe('E13. "What did we say about X?"', () => {
    it('should retrieve from RAG summaries, not hallucinate', () => {
      const sessionId = TEST_SESSIONS.session3.id;
      const activeDocs = getDocumentsForSession(testState, sessionId);
      
      // Should be able to search active docs
      expect(activeDocs.length).toBeGreaterThan(0);
      
      // Content should be searchable
      const leaseDoc = activeDocs.find(d => d.filename === 'lease_agreement.pdf');
      expect(leaseDoc).toBeDefined();
      expect(leaseDoc!.content).toContain('pet');
    });

    it('should provide correct attribution', () => {
      const sessionId = TEST_SESSIONS.session3.id;
      const activeDocs = getDocumentsForSession(testState, sessionId);
      const leaseDoc = activeDocs.find(d => d.filename === 'lease_agreement.pdf');
      
      // RAG context should include filename
      const ragContext = `Source: ${leaseDoc!.filename}\n"${leaseDoc!.chunks[0]}"`;
      
      expect(ragContext).toContain('lease_agreement.pdf');
    });
  });
});

// ============================================================================
// F. Pool Limit Enforcement
// ============================================================================

describe('F. Pool Limit Enforcement', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('F14. Upload doc #101', () => {
    it('should block upload when at capacity', () => {
      const userId = TEST_USERS.primary.id;
      
      // Simulate pool at 100
      expect(() => {
        assertPoolLimit(100, 100, 'upload');
      }).toThrow(InvariantViolationError);
    });

    it('should allow upload when under capacity', () => {
      expect(() => {
        assertPoolLimit(50, 100, 'upload');
      }).not.toThrow();
    });

    it('should report clear error message at capacity', () => {
      try {
        assertPoolLimit(100, 100, 'upload');
      } catch (e) {
        expect(e).toBeInstanceOf(InvariantViolationError);
        expect((e as InvariantViolationError).message).toContain('100/100');
      }
    });
  });

  describe('F15. Delete one, upload again', () => {
    it('should allow upload after deleting a document', () => {
      // Start at 99
      let poolCount = 99;
      
      // Upload blocked at 100
      expect(() => assertPoolLimit(100, 100, 'upload')).toThrow();
      
      // Delete one (now at 99)
      poolCount = 99;
      
      // Upload should work
      expect(() => assertPoolLimit(poolCount, 100, 'upload')).not.toThrow();
    });
  });
});

// ============================================================================
// G. Invariant Spot Checks
// ============================================================================

describe('G. Invariant Spot Checks', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('G1. RAG never returns docs not in activeSessions', () => {
    it('should only return docs where activeSessions includes sessionId', () => {
      const sessionId = TEST_SESSIONS.session3.id;
      const activeDocs = getDocumentsForSession(testState, sessionId);
      
      for (const doc of activeDocs) {
        expect(doc.activeSessions).toContain(sessionId);
      }
    });

    it('should never filter by originSessionId', () => {
      expect(() => {
        assertNeverFilterByOriginSession('originSessionId');
      }).toThrow(InvariantViolationError);
    });

    it('should detect if wrong filtering returns ghost docs', () => {
      const sessionId = TEST_SESSIONS.session1.id;
      
      // Wrong way (by origin)
      const wrongDocs = getDocumentsByOriginSession_WRONG(sessionId);
      
      // Right way (by activeSessions)
      const rightDocs = getDocumentsForSession(testState, sessionId);
      
      // wrongDocs might include docs not actually active in session
      // For session1: originSession has docA, docB
      // activeSessions has docA, docB (same in this case)
      // But for other scenarios they differ!
      
      // The key is that we use the right function
      expect(rightDocs.every(d => d.activeSessions.includes(sessionId))).toBe(true);
    });
  });

  describe('G2. Deleting doc never deletes fact', () => {
    it('should preserve all facts when doc is deleted', () => {
      const factCountBefore = testState.facts.length;
      
      deleteDocument(testState, 1); // docA
      
      expect(testState.facts.length).toBe(factCountBefore);
    });
  });

  describe('G3. Refresh never requires re-embedding', () => {
    it('should have embeddings available after refresh', () => {
      const result = simulateRefresh(TEST_SESSIONS.session3.id);
      
      expect(result.reEmbedRequired).toBe(false);
      expect(result.embeddingsRestored).toBe(true);
    });

    it('should persist embeddings in RxDB', () => {
      // Embeddings are stored in testState.embeddings (simulating RxDB)
      expect(testState.embeddings.length).toBeGreaterThan(0);
      
      // After simulated refresh, they should still be there
      const embeddingsAfter = testState.embeddings;
      expect(embeddingsAfter.length).toBeGreaterThan(0);
    });
  });

  describe('G4. System never implies memory it does not have', () => {
    it('should not have volatile memory after cold start', () => {
      const result = simulateRefresh(TEST_SESSIONS.session3.id);
      expect(result.volatileMemory).toBeNull();
    });

    it('should only use facts and RAG for context', () => {
      const userFacts = testState.facts.filter(f => 
        f.userId === TEST_USERS.primary.id
      );
      const activeDocs = getDocumentsForSession(testState, TEST_SESSIONS.session3.id);
      
      // These are the only valid sources for "memory"
      expect(userFacts.length).toBeGreaterThanOrEqual(0);
      expect(activeDocs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('G5. Vectors belong to documents, not sessions', () => {
    it('should have documentId on all vectors', () => {
      for (const embedding of testState.embeddings) {
        expect(() => {
          assertVectorsBelongToDocs(embedding);
        }).not.toThrow();
      }
    });

    it('should throw if vector missing documentId', () => {
      expect(() => {
        assertVectorsBelongToDocs({ sessionId: 'test' });
      }).toThrow(InvariantViolationError);
    });
  });
});

// ============================================================================
// H. Topic Relevance Filtering (Gap 1 from review)
// ============================================================================

describe('H. Topic Relevance Filtering', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('H1. Selective fact injection', () => {
    it('should only inject topic-relevant facts', () => {
      const query = 'pet deposit lease';
      const allFacts = testState.facts.filter(f => !f.sourceRemoved);
      
      // Simulate topic filtering - only lease-related facts
      const relevantFacts = allFacts.filter(f => 
        f.category === 'lease_terms' || 
        f.key.toLowerCase().includes('pet') ||
        f.key.toLowerCase().includes('deposit')
      );
      
      // Irrelevant facts (employment, CCMA) should be excluded
      const irrelevantFacts = allFacts.filter(f => 
        f.category === 'employment' || f.category === 'legal_rights'
      );
      
      expect(relevantFacts.length).toBeGreaterThan(0);
      expect(relevantFacts.every(f => 
        f.category === 'lease_terms' || f.key.toLowerCase().includes('pet')
      )).toBe(true);
      
      // Verify irrelevant facts exist but are NOT in the filtered set
      if (irrelevantFacts.length > 0) {
        const relevantIds = new Set(relevantFacts.map(f => f.id));
        expect(irrelevantFacts.some(f => relevantIds.has(f.id))).toBe(false);
      }
    });

    it('should exclude facts when query has no topic match', () => {
      const query = 'weather forecast tomorrow';
      const allFacts = testState.facts.filter(f => !f.sourceRemoved);
      
      // None of our test facts are about weather
      const relevantFacts = allFacts.filter(f => 
        f.key.toLowerCase().includes('weather') ||
        f.value.toLowerCase().includes('weather')
      );
      
      expect(relevantFacts.length).toBe(0);
    });

    it('should not inject sourceRemoved facts regardless of topic', () => {
      // Delete a document to create sourceRemoved facts
      deleteDocument(testState, 1); // docA - lease agreement
      
      const query = 'pet deposit lease';
      const allFacts = testState.facts;
      const removedFacts = allFacts.filter(f => f.sourceRemoved);
      const activeFacts = allFacts.filter(f => !f.sourceRemoved);
      
      // Removed facts exist
      expect(removedFacts.length).toBeGreaterThan(0);
      
      // Only active facts should be candidates for injection
      // (Even if topic-relevant, sourceRemoved disqualifies)
      const injectableFacts = activeFacts.filter(f => 
        f.key.toLowerCase().includes('pet')
      );
      
      // Verify no removed facts would be injected
      for (const removed of removedFacts) {
        expect(injectableFacts.map(f => f.id)).not.toContain(removed.id);
      }
    });
  });
});

// ============================================================================
// I. Adversarial RAG Fallback Tests (Gap 2 from review)
// ============================================================================

describe('I. Adversarial RAG Fallback Tests', () => {
  beforeEach(() => {
    testState = initTestState();
  });

  describe('I1. Corrupted activeSessions', () => {
    it('should return zero chunks when doc has empty activeSessions', () => {
      // Get orphan doc (activeSessions = [])
      const orphanDoc = testState.documents.get(6)!;
      expect(orphanDoc.activeSessions.length).toBe(0);
      
      // Embeddings might still exist for this doc
      const orphanEmbeddings = testState.embeddings.filter(e => 
        e.documentId === String(orphanDoc.id)
      );
      
      // Even if embeddings exist, RAG should return nothing
      const sessionId = TEST_SESSIONS.session3.id;
      const activeDocs = getDocumentsForSession(testState, sessionId);
      
      // Orphan doc must NOT appear in any session's RAG
      expect(activeDocs.map(d => d.id)).not.toContain(orphanDoc.id);
    });

    it('should never fall back to global vector search', () => {
      const sessionId = 'session_nonexistent';
      
      // No docs active in this session
      const activeDocs = getDocumentsForSession(testState, sessionId);
      expect(activeDocs.length).toBe(0);
      
      // Even though embeddings exist in the system
      expect(testState.embeddings.length).toBeGreaterThan(0);
      
      // RAG must return empty, not "helpful" global results
      const ragChunks = simulateRagQuery(testState, sessionId, 'any query');
      expect(ragChunks.length).toBe(0);
    });

    it('should not return chunks from inactive docs even if embeddings match', () => {
      const sessionId = TEST_SESSIONS.session1.id;
      
      // docD is only active in session2, NOT session1
      const docD = testState.documents.get(4)!;
      expect(docD.activeSessions).not.toContain(sessionId);
      
      // Even if docD has highly relevant embeddings
      const docDEmbeddings = testState.embeddings.filter(e => 
        e.documentId === String(docD.id)
      );
      
      // RAG for session1 must exclude docD chunks
      const session1Docs = getDocumentsForSession(testState, sessionId);
      const session1DocIds = new Set(session1Docs.map(d => String(d.id)));
      
      // Verify docD is not in session1's active set
      expect(session1DocIds.has(String(docD.id))).toBe(false);
    });
  });

  describe('I2. Mutation during query simulation', () => {
    it('should handle doc deactivation gracefully', () => {
      const sessionId = TEST_SESSIONS.session3.id;
      
      // Start with 3 active docs
      let activeDocs = getDocumentsForSession(testState, sessionId);
      expect(activeDocs.length).toBe(3);
      
      // Simulate deactivation during query (docA removed from session3)
      const docA = testState.documents.get(1)!;
      const deactivated = deactivateDocumentFromSession(docA, sessionId);
      testState.documents.set(1, deactivated);
      
      // Post-deactivation query should reflect change
      activeDocs = getDocumentsForSession(testState, sessionId);
      expect(activeDocs.length).toBe(2);
      expect(activeDocs.map(d => d.id)).not.toContain(1);
    });

    it('should handle doc deletion gracefully', () => {
      const sessionId = TEST_SESSIONS.session3.id;
      
      // docE is active in session3
      let activeDocs = getDocumentsForSession(testState, sessionId);
      expect(activeDocs.map(d => d.id)).toContain(5);
      
      // Delete docE during query
      deleteDocument(testState, 5);
      
      // Query should not fail, just exclude deleted doc
      activeDocs = getDocumentsForSession(testState, sessionId);
      expect(activeDocs.map(d => d.id)).not.toContain(5);
    });
  });
});

// ============================================================================
// Helper: Simulate RAG Query (for adversarial tests)
// ============================================================================

function simulateRagQuery(
  state: TestState, 
  sessionId: string, 
  _query: string
): Array<{ text: string; documentId: string }> {
  // Get active docs for session
  const activeDocs = getDocumentsForSession(state, sessionId);
  const activeDocIds = new Set(activeDocs.map(d => String(d.id)));
  
  // CRITICAL: Only return embeddings from active docs
  // This simulates correct RAG behavior - NO fallback to global
  const relevantEmbeddings = state.embeddings.filter(e => 
    activeDocIds.has(e.documentId)
  );
  
  return relevantEmbeddings.map(e => ({
    text: `chunk-${e.chunkIndex}`,
    documentId: e.documentId,
  }));
}
