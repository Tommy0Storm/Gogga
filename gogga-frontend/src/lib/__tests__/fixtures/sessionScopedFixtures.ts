/**
 * Session-Scoped RAG Test Fixtures
 * 
 * Pre-built document/session relationships for testing the 15 failure scenarios
 * from the Session-Scoped RAG Design document.
 * 
 * @see docs/SESSION_SCOPED_RAG_DESIGN.md
 */

// ============================================================================
// Test Users
// ============================================================================

export const TEST_USERS = {
  primary: {
    id: 'user_test_primary',
    email: 'test@gogga.co.za',
    tier: 'jigga' as const,
  },
  secondary: {
    id: 'user_test_secondary', 
    email: 'secondary@gogga.co.za',
    tier: 'jive' as const,
  },
} as const;

// ============================================================================
// Test Sessions
// ============================================================================

export const TEST_SESSIONS = {
  session1: {
    id: 'session_test_1',
    tier: 'jigga' as const,
    title: 'Session 1 - Primary',
    createdAt: new Date('2025-12-01T10:00:00Z'),
  },
  session2: {
    id: 'session_test_2',
    tier: 'jigga' as const,
    title: 'Session 2 - Secondary',
    createdAt: new Date('2025-12-02T10:00:00Z'),
  },
  session3: {
    id: 'session_test_3',
    tier: 'jigga' as const,
    title: 'Session 3 - Current',
    createdAt: new Date('2025-12-03T10:00:00Z'),
  },
  newSession: {
    id: 'session_test_new',
    tier: 'jigga' as const,
    title: 'New Session',
    createdAt: new Date('2025-12-14T10:00:00Z'),
  },
} as const;

// ============================================================================
// Test Documents (Pool-Based)
// ============================================================================

export interface TestDocument {
  id: number;
  filename: string;
  content: string;
  chunks: string[];
  chunkCount: number;
  size: number;
  mimeType: string;
  // Session-Scoped fields (new)
  userId: string;
  originSessionId: string;
  activeSessions: string[];
  accessCount: number;
  lastAccessedAt: Date;
  // Legacy field (frozen, read-only alias)
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const TEST_DOCUMENTS: Record<string, TestDocument> = {
  // Doc A: Originated in session1, active in session1 AND session3 (pulled)
  docA: {
    id: 1,
    filename: 'lease_agreement.pdf',
    content: 'Tenants are prohibited from keeping pets on the premises without prior written consent from the landlord. A pet deposit of R2,500 is required.',
    chunks: ['Tenants are prohibited from keeping pets...', 'A pet deposit of R2,500 is required.'],
    chunkCount: 2,
    size: 15000,
    mimeType: 'application/pdf',
    userId: TEST_USERS.primary.id,
    originSessionId: TEST_SESSIONS.session1.id,
    activeSessions: [TEST_SESSIONS.session1.id, TEST_SESSIONS.session3.id],
    accessCount: 5,
    lastAccessedAt: new Date('2025-12-14T09:00:00Z'),
    sessionId: TEST_SESSIONS.session1.id, // Legacy alias
    createdAt: new Date('2025-12-01T10:30:00Z'),
    updatedAt: new Date('2025-12-14T09:00:00Z'),
  },
  
  // Doc B: Originated in session1, only active in session1
  docB: {
    id: 2,
    filename: 'tenant_rules.txt',
    content: 'Animals are not permitted in common areas. Service animals are exempt with proper documentation.',
    chunks: ['Animals are not permitted in common areas.', 'Service animals are exempt with proper documentation.'],
    chunkCount: 2,
    size: 5000,
    mimeType: 'text/plain',
    userId: TEST_USERS.primary.id,
    originSessionId: TEST_SESSIONS.session1.id,
    activeSessions: [TEST_SESSIONS.session1.id],
    accessCount: 2,
    lastAccessedAt: new Date('2025-12-01T11:00:00Z'),
    sessionId: TEST_SESSIONS.session1.id,
    createdAt: new Date('2025-12-01T10:45:00Z'),
    updatedAt: new Date('2025-12-01T11:00:00Z'),
  },
  
  // Doc C: Originated in session2, active in session2 AND session3 (pulled)
  docC: {
    id: 3,
    filename: 'ccma_guidelines.pdf',
    content: 'The Commission for Conciliation, Mediation and Arbitration (CCMA) handles workplace disputes. Unfair dismissal claims must be filed within 30 days.',
    chunks: ['The CCMA handles workplace disputes.', 'Unfair dismissal claims must be filed within 30 days.'],
    chunkCount: 2,
    size: 25000,
    mimeType: 'application/pdf',
    userId: TEST_USERS.primary.id,
    originSessionId: TEST_SESSIONS.session2.id,
    activeSessions: [TEST_SESSIONS.session2.id, TEST_SESSIONS.session3.id],
    accessCount: 3,
    lastAccessedAt: new Date('2025-12-14T08:00:00Z'),
    sessionId: TEST_SESSIONS.session2.id,
    createdAt: new Date('2025-12-02T14:00:00Z'),
    updatedAt: new Date('2025-12-14T08:00:00Z'),
  },
  
  // Doc D: Originated in session2, only active in session2
  docD: {
    id: 4,
    filename: 'employment_contract.docx',
    content: 'This employment contract is governed by the Labour Relations Act. The employee is entitled to 21 days annual leave.',
    chunks: ['This employment contract is governed by the LRA.', 'The employee is entitled to 21 days annual leave.'],
    chunkCount: 2,
    size: 18000,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    userId: TEST_USERS.primary.id,
    originSessionId: TEST_SESSIONS.session2.id,
    activeSessions: [TEST_SESSIONS.session2.id],
    accessCount: 1,
    lastAccessedAt: new Date('2025-12-02T14:30:00Z'),
    sessionId: TEST_SESSIONS.session2.id,
    createdAt: new Date('2025-12-02T14:15:00Z'),
    updatedAt: new Date('2025-12-02T14:30:00Z'),
  },
  
  // Doc E: Originated in session3, only active in session3 (new doc)
  docE: {
    id: 5,
    filename: 'rental_housing_act.pdf',
    content: 'The Rental Housing Act protects tenants from unfair eviction. Landlords must provide 20 business days notice for termination.',
    chunks: ['The RHA protects tenants from unfair eviction.', 'Landlords must provide 20 business days notice.'],
    chunkCount: 2,
    size: 32000,
    mimeType: 'application/pdf',
    userId: TEST_USERS.primary.id,
    originSessionId: TEST_SESSIONS.session3.id,
    activeSessions: [TEST_SESSIONS.session3.id],
    accessCount: 1,
    lastAccessedAt: new Date('2025-12-14T10:00:00Z'),
    sessionId: TEST_SESSIONS.session3.id,
    createdAt: new Date('2025-12-14T09:30:00Z'),
    updatedAt: new Date('2025-12-14T10:00:00Z'),
  },
  
  // Orphan Doc: No active sessions (orphaned)
  orphanDoc: {
    id: 6,
    filename: 'old_notes.txt',
    content: 'Some old notes that are no longer active in any session.',
    chunks: ['Some old notes...'],
    chunkCount: 1,
    size: 500,
    mimeType: 'text/plain',
    userId: TEST_USERS.primary.id,
    originSessionId: 'session_deleted',
    activeSessions: [], // Orphaned!
    accessCount: 0,
    lastAccessedAt: new Date('2025-11-01T10:00:00Z'),
    sessionId: 'session_deleted',
    createdAt: new Date('2025-11-01T10:00:00Z'),
    updatedAt: new Date('2025-11-01T10:00:00Z'),
  },
};

// ============================================================================
// Test Embeddings
// ============================================================================

export interface TestEmbedding {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: string;
}

/**
 * Generate a mock 384-dim embedding (E5-small-v2)
 */
export function generateMockEmbedding(seed: number = 0): number[] {
  const embedding = new Array(384).fill(0);
  for (let i = 0; i < 384; i++) {
    // Deterministic pseudo-random based on seed
    embedding[i] = Math.sin(seed * 1000 + i) * 0.5;
  }
  return embedding;
}

export const TEST_EMBEDDINGS: TestEmbedding[] = [
  {
    id: 'emb_1_0',
    documentId: '1',
    chunkIndex: 0,
    text: TEST_DOCUMENTS.docA.chunks[0],
    embedding: generateMockEmbedding(1),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'emb_1_1',
    documentId: '1',
    chunkIndex: 1,
    text: TEST_DOCUMENTS.docA.chunks[1],
    embedding: generateMockEmbedding(2),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'emb_3_0',
    documentId: '3',
    chunkIndex: 0,
    text: TEST_DOCUMENTS.docC.chunks[0],
    embedding: generateMockEmbedding(3),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'emb_5_0',
    documentId: '5',
    chunkIndex: 0,
    text: TEST_DOCUMENTS.docE.chunks[0],
    embedding: generateMockEmbedding(5),
    createdAt: new Date().toISOString(),
  },
];

// ============================================================================
// Test Authoritative Facts
// ============================================================================

export interface TestFact {
  id: string;
  userId: string;
  key: string;
  value: string;
  sourceDocumentId?: string;
  sourceRemoved: boolean;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export const TEST_FACTS: TestFact[] = [
  {
    id: 'fact_1',
    userId: TEST_USERS.primary.id,
    key: 'user.pet_deposit_amount',
    value: 'R2,500',
    sourceDocumentId: '1', // From docA
    sourceRemoved: false,
    confidence: 0.95,
    createdAt: new Date('2025-12-01T11:00:00Z').toISOString(),
    updatedAt: new Date('2025-12-01T11:00:00Z').toISOString(),
  },
  {
    id: 'fact_2',
    userId: TEST_USERS.primary.id,
    key: 'user.ccma_deadline',
    value: '30 days for unfair dismissal claims',
    sourceDocumentId: '3', // From docC
    sourceRemoved: false,
    confidence: 0.9,
    createdAt: new Date('2025-12-02T15:00:00Z').toISOString(),
    updatedAt: new Date('2025-12-02T15:00:00Z').toISOString(),
  },
];

// ============================================================================
// Token Budget Constants
// ============================================================================

export const TOKEN_BUDGETS = {
  FREE:  { state: 1000, rag: 0,    volatile: 4000, response: 4000, total: 8000 },
  JIVE:  { state: 2000, rag: 3000, volatile: 6000, response: 5000, total: 16000 },
  JIGGA: { state: 3000, rag: 6000, volatile: 8000, response: 8000, total: 24000 },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get documents active in a specific session
 * CRITICAL: This is the correct filtering logic!
 */
export function getActiveDocumentsForSession(sessionId: string): TestDocument[] {
  return Object.values(TEST_DOCUMENTS).filter(doc => 
    doc.activeSessions.includes(sessionId)
  );
}

/**
 * ANTI-PATTERN: Get documents by originSessionId
 * This is WRONG and should never be used for RAG retrieval!
 */
export function getDocumentsByOriginSession_WRONG(sessionId: string): TestDocument[] {
  console.warn('[TEST] Using incorrect originSessionId filter - this is for testing invariant violations only');
  return Object.values(TEST_DOCUMENTS).filter(doc => 
    doc.originSessionId === sessionId
  );
}

/**
 * Get orphaned documents (no active sessions)
 */
export function getOrphanedDocuments(): TestDocument[] {
  return Object.values(TEST_DOCUMENTS).filter(doc => 
    doc.activeSessions.length === 0
  );
}

/**
 * Get user's document pool count
 */
export function getUserDocumentCount(userId: string): number {
  return Object.values(TEST_DOCUMENTS).filter(doc => 
    doc.userId === userId
  ).length;
}

/**
 * Simulate activating a document in a session
 */
export function activateDocumentInSession(doc: TestDocument, sessionId: string): TestDocument {
  if (doc.activeSessions.includes(sessionId)) {
    return doc; // Already active
  }
  return {
    ...doc,
    activeSessions: [...doc.activeSessions, sessionId],
    accessCount: doc.accessCount + 1,
    lastAccessedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Simulate deactivating a document from a session
 */
export function deactivateDocumentFromSession(doc: TestDocument, sessionId: string): TestDocument {
  return {
    ...doc,
    activeSessions: doc.activeSessions.filter(id => id !== sessionId),
    updatedAt: new Date(),
  };
}

/**
 * Estimate token count (matches ragManager.ts logic)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if document pool is at capacity
 */
export function isPoolAtCapacity(userId: string, limit: number = 100): boolean {
  return getUserDocumentCount(userId) >= limit;
}

// ============================================================================
// Scenario Helpers
// ============================================================================

/**
 * Scenario A1: Simulate browser refresh
 * Returns expected state after refresh
 */
export function simulateRefresh(sessionId: string) {
  return {
    volatileMemory: null, // Gone
    activeSession: sessionId, // Restored
    activeDocs: getActiveDocumentsForSession(sessionId),
    embeddingsRestored: true,
    reEmbedRequired: false,
  };
}

/**
 * Scenario C6: Simulate document deletion
 * Returns expected cascading effects
 */
export function simulateDocumentDeletion(docId: number) {
  const doc = Object.values(TEST_DOCUMENTS).find(d => d.id === docId);
  if (!doc) return null;
  
  return {
    documentDeleted: true,
    vectorsDeleted: true, // All embeddings for this doc
    factsPreserved: true, // But marked sourceRemoved
    affectedSessions: doc.activeSessions,
    ragReturnsDoc: false, // Never again
  };
}

/**
 * Scenario C7: Simulate session deletion  
 * Returns expected state after session deletion
 */
export function simulateSessionDeletion(sessionId: string) {
  const affectedDocs = getActiveDocumentsForSession(sessionId);
  
  return {
    documentsDeleted: false, // Docs NOT deleted
    vectorsDeleted: false,   // Vectors NOT deleted
    factsDeleted: false,     // Facts NOT deleted
    orphanedDocs: affectedDocs.filter(doc => 
      doc.activeSessions.length === 1 && doc.activeSessions[0] === sessionId
    ),
    stillActiveDocs: affectedDocs.filter(doc => 
      doc.activeSessions.length > 1
    ),
  };
}
