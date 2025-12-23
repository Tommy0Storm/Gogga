/**
 * GOGGA RAG Module - Central Exports
 * 
 * Provides unified access to all RAG functionality:
 * - Document pool management
 * - Session context with token budgeting
 * - Cascade deletion service
 * - Invariant assertions
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */

// Document Pool Management
export {
  DocumentPoolManager,
  getDocumentPoolManager,
  POOL_LIMITS,
  type PoolDocument,
  type PoolStats,
  type PoolOperationResult,
} from './documentPool';

// Session Context Management
export {
  SessionContextManager,
  getSessionContext,
  removeSessionContext,
  clearAllSessionContexts,
  TOKEN_BUDGETS,
  type RagChunk,
  type SessionContextState,
  type BuiltContext,
} from './sessionContext';

// Deletion Service
export {
  DeletionService,
  deletionService,
  deleteDocument,
  deleteDocuments,
  deleteAllUserDocuments,
  deactivateFromSession,
  activateForSession,
  type DeletionResult,
  type BulkDeletionResult,
} from './deletionService';

// Clear All RAG Documents
export {
  clearAllRAGDocuments,
  clearRAGDocument,
  getRAGStorageStats,
  type ClearAllResult,
} from './clearAllRAG';

// Invariants
export {
  InvariantViolationError,
  assertNeverFilterByOriginSession,
  validateDocumentQuery,
  assertStateNeverEvicted,
  validateTokenBudgetPriority,
  assertFactsPreservedOnDocDelete,
  assertVectorsBelongToDocs,
} from './invariants';

// Re-export types from tierConfig for convenience
export type { Tier, RagMode, TierConfig } from '../config/tierConfig';
