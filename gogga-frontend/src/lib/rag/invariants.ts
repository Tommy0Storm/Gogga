/**
 * Session-Scoped RAG Invariant Assertions
 * 
 * Dev-only runtime checks that throw when critical invariants are violated.
 * These assertions MUST be stripped in production builds.
 * 
 * @see docs/SESSION_SCOPED_RAG_DESIGN.md - Critical Invariants section
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

// ============================================================================
// Invariant Violation Error
// ============================================================================

export class InvariantViolationError extends Error {
  constructor(
    public readonly invariant: string,
    public readonly details: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(`[INVARIANT VIOLATION] ${invariant}: ${details}`);
    this.name = 'InvariantViolationError';
    
    if (IS_DEV) {
      console.error('🚨 INVARIANT VIOLATION 🚨');
      console.error(`Invariant: ${invariant}`);
      console.error(`Details: ${details}`);
      if (context) {
        console.error('Context:', context);
      }
      console.trace('Stack trace:');
    }
  }
}

// ============================================================================
// Invariant #1: RAG retrieval MUST filter by activeSessions, NEVER originSessionId
// ============================================================================

/**
 * Assert that RAG filtering uses activeSessions.includes(), not originSessionId
 * 
 * @throws InvariantViolationError if originSessionId is used for filtering
 */
export function assertNeverFilterByOriginSession(
  filterField: string,
  queryContext?: Record<string, unknown>
): void {
  if (!IS_DEV) return;
  
  const forbiddenFields = ['originSessionId', 'sessionId'];
  
  if (forbiddenFields.includes(filterField)) {
    throw new InvariantViolationError(
      'INVARIANT_1_RAG_SCOPE',
      `RAG retrieval must filter by activeSessions.includes(sessionId), got filter by "${filterField}"`,
      queryContext
    );
  }
}

/**
 * Validate that a document query uses the correct filtering
 */
export function validateDocumentQuery(
  documents: Array<{ activeSessions?: string[]; originSessionId?: string }>,
  sessionId: string
): void {
  if (!IS_DEV) return;
  
  for (const doc of documents) {
    // Check if doc should be visible
    const shouldBeVisible = doc.activeSessions?.includes(sessionId) ?? false;
    const wouldBeVisibleByOrigin = doc.originSessionId === sessionId;
    
    // If a doc is visible only because of originSessionId, that's wrong
    if (wouldBeVisibleByOrigin && !shouldBeVisible) {
      throw new InvariantViolationError(
        'INVARIANT_1_RAG_SCOPE',
        'Document returned based on originSessionId but not in activeSessions',
        { documentOrigin: doc.originSessionId, sessionId, activeSessions: doc.activeSessions }
      );
    }
  }
}

// ============================================================================
// Invariant #2: Authoritative state NEVER evicted for RAG
// ============================================================================

/**
 * Assert that state tokens are never reduced to fit RAG
 * 
 * @throws InvariantViolationError if state was evicted
 */
export function assertStateNeverEvicted(
  stateTokensBefore: number,
  stateTokensAfter: number,
  ragTokensAdded: number
): void {
  if (!IS_DEV) return;
  
  if (stateTokensAfter < stateTokensBefore && ragTokensAdded > 0) {
    throw new InvariantViolationError(
      'INVARIANT_2_STATE_PRIORITY',
      'Authoritative state tokens were evicted to make room for RAG',
      { stateTokensBefore, stateTokensAfter, ragTokensAdded }
    );
  }
}

/**
 * Validate token budget allocation respects priority
 * Priority: System Prompt > State > Volatile > RAG > Response
 */
export function validateTokenBudgetPriority(
  allocation: {
    systemPrompt: number;
    state: number;
    volatile: number;
    rag: number;
    response: number;
  },
  budget: {
    state: number;
    rag: number;
    volatile: number;
    total: number;
  }
): void {
  if (!IS_DEV) return;
  
  // State should never be truncated if RAG has any tokens
  if (allocation.state < budget.state && allocation.rag > 0) {
    throw new InvariantViolationError(
      'INVARIANT_2_STATE_PRIORITY',
      'State was truncated while RAG still has allocated tokens',
      { allocation, budget }
    );
  }
}

// ============================================================================
// Invariant #3: Deleting documents does NOT delete authoritative facts
// ============================================================================

/**
 * Assert that facts are preserved when their source document is deleted
 * 
 * @throws InvariantViolationError if facts were deleted
 */
export function assertFactsPreservedOnDocDelete(
  deletedDocumentId: string,
  factsBeforeDelete: Array<{ id: string; sourceDocumentId?: string }>,
  factsAfterDelete: Array<{ id: string; sourceDocumentId?: string; sourceRemoved?: boolean }>
): void {
  if (!IS_DEV) return;
  
  const affectedFacts = factsBeforeDelete.filter(f => f.sourceDocumentId === deletedDocumentId);
  
  for (const fact of affectedFacts) {
    const afterFact = factsAfterDelete.find(f => f.id === fact.id);
    
    if (!afterFact) {
      throw new InvariantViolationError(
        'INVARIANT_3_FACTS_PRESERVED',
        'Fact was deleted when source document was deleted',
        { deletedDocumentId, deletedFactId: fact.id }
      );
    }
    
    if (!afterFact.sourceRemoved) {
      throw new InvariantViolationError(
        'INVARIANT_3_FACTS_PRESERVED',
        'Fact source document was deleted but sourceRemoved was not set to true',
        { deletedDocumentId, factId: fact.id, sourceRemoved: afterFact.sourceRemoved }
      );
    }
  }
}

// ============================================================================
// Invariant #4: Vectors belong to documents, not sessions
// ============================================================================

/**
 * Assert that vector embeddings reference documentId, not sessionId
 * 
 * @throws InvariantViolationError if vectors have sessionId without documentId
 */
export function assertVectorsBelongToDocs(
  vector: { documentId?: string; sessionId?: string }
): void {
  if (!IS_DEV) return;
  
  if (!vector.documentId) {
    throw new InvariantViolationError(
      'INVARIANT_4_VECTORS_BELONG_TO_DOCS',
      'Vector embedding must have documentId',
      { vector }
    );
  }
  
  // sessionId on vectors is legacy and should be ignored for new writes
  // We don't throw here, just warn
  if (vector.sessionId && IS_DEV) {
    console.warn('[INVARIANT_4] Vector has sessionId (legacy field) - should not be used for filtering');
  }
}

/**
 * Validate that vector search joins on documentId then filters by activeSessions
 */
export function validateVectorSearchFlow(
  searchMethod: 'byDocumentId' | 'bySessionId' | 'other'
): void {
  if (!IS_DEV) return;
  
  if (searchMethod === 'bySessionId') {
    throw new InvariantViolationError(
      'INVARIANT_4_VECTORS_BELONG_TO_DOCS',
      'Vector search must join on documentId, not filter by sessionId',
      { searchMethod }
    );
  }
}

// ============================================================================
// Invariant #5: Chat is never authoritative
// ============================================================================

/**
 * Assert that chat history is not being used as authoritative state
 * 
 * @throws InvariantViolationError if chat is treated as authoritative
 */
export function assertChatNeverAuthoritative(
  stateSource: 'chat' | 'memory' | 'fact' | 'document'
): void {
  if (!IS_DEV) return;
  
  if (stateSource === 'chat') {
    throw new InvariantViolationError(
      'INVARIANT_5_CHAT_NOT_AUTHORITATIVE',
      'Chat history cannot be used as authoritative state',
      { stateSource }
    );
  }
}

// ============================================================================
// Pool Limit Invariant
// ============================================================================

/**
 * Assert that document pool does not exceed limit
 */
export function assertPoolLimit(
  currentCount: number,
  limit: number = 100,
  action: 'upload' | 'pull'
): void {
  if (!IS_DEV) return;
  
  if (currentCount >= limit && action === 'upload') {
    throw new InvariantViolationError(
      'POOL_LIMIT',
      `Document pool at capacity (${currentCount}/${limit}). Upload blocked.`,
      { currentCount, limit, action }
    );
  }
}

// ============================================================================
// Debug Mode Logger
// ============================================================================

let debugEnabled = false;

/**
 * Enable debug mode (check ?debug=rag query param)
 */
export function initDebugMode(): void {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    debugEnabled = params.get('debug') === 'rag';
    
    if (debugEnabled) {
      console.log('[RAG Debug] Debug mode enabled via ?debug=rag');
    }
  }
}

/**
 * Log token budget info (only in debug mode)
 */
export function logTokenBudget(
  tier: string,
  allocation: {
    stateTokens: number;
    ragTokens: number;
    volatileTokens: number;
    responseBudget: number;
    tierMax: number;
    chunksDropped?: number;
  }
): void {
  if (!debugEnabled) return;
  
  console.log('[RAG Debug] Token Budget:', {
    tier,
    ...allocation,
    utilization: `${Math.round((allocation.stateTokens + allocation.ragTokens + allocation.volatileTokens) / allocation.tierMax * 100)}%`,
  });
}

/**
 * Log RAG query info (only in debug mode)
 */
export function logRagQuery(
  sessionId: string,
  query: string,
  docsSearched: number,
  chunksReturned: number,
  mode: 'semantic' | 'basic'
): void {
  if (!debugEnabled) return;
  
  console.log('[RAG Debug] Query:', {
    sessionId,
    query: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
    docsSearched,
    chunksReturned,
    mode,
  });
}

// ============================================================================
// Assertion Wrapper (for test compatibility)
// ============================================================================

/**
 * Run all invariant checks on a document operation
 */
export function validateDocumentOperation(
  operation: 'create' | 'read' | 'update' | 'delete' | 'query',
  context: {
    sessionId?: string;
    documentId?: string;
    filterField?: string;
    documents?: Array<{ activeSessions?: string[]; originSessionId?: string }>;
  }
): void {
  if (!IS_DEV) return;
  
  if (operation === 'query' && context.filterField) {
    assertNeverFilterByOriginSession(context.filterField, context);
  }
  
  if (operation === 'query' && context.documents && context.sessionId) {
    validateDocumentQuery(context.documents, context.sessionId);
  }
}
