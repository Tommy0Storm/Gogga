/**
 * GOGGA RxDB Database Factory
 * Creates and manages the RxDB instance with Dexie storage
 * Features:
 * - Lazy initialization (only create when needed)
 * - Singleton pattern with cross-tab leader election
 * - Automatic cleanup of old metrics/logs
 * - RxPipeline for embedding generation
 * - Memory storage for fast ephemeral data
 * - Parallel embedding with WebWorkers
 */

import { createRxDatabase, addRxPlugin, removeRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBCleanupPlugin } from 'rxdb/plugins/cleanup';
import { RxDBPipelinePlugin } from 'rxdb/plugins/pipeline';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBDevModePlugin, disableWarnings } from 'rxdb/plugins/dev-mode';
// Additional plugins from RxDB open source
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBStatePlugin } from 'rxdb/plugins/state';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBLocalDocumentsPlugin } from 'rxdb/plugins/local-documents';
import { RxDBcrdtPlugin } from 'rxdb/plugins/crdt';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import { wrappedKeyCompressionStorage } from 'rxdb/plugins/key-compression';
import { Observable } from 'rxjs';

// Re-export memory storage utilities
export {
  getMemoryDatabase,
  updateActiveSession,
  getActiveSession,
  subscribeToActiveSession,
  setTypingIndicator,
  getCachedEmbedding,
  cacheEmbedding,
  getEmbeddingCacheStats,
  clearEmbeddingCache,
  addPendingOperation,
  updatePendingOperation,
  getPendingOperations,
  cleanupPendingOperations,
  getAppSettings,
  updateAppSettings,
  subscribeToAppSettings,
  destroyMemoryDatabase,
  type ActiveSessionDoc,
  type EmbeddingCacheDoc,
  type PendingOperationDoc,
} from './memoryStorage';

// Re-export parallel embedding utilities
export {
  getParallelEmbeddingManager,
  generateParallelEmbeddings,
  generateParallelEmbedding,
  ParallelEmbeddingManager,
} from './parallelEmbedding';

import {
  type GoggaRxDatabase,
  type GoggaRxCollections,
  documentSchema,
  documentChunkSchema,
  chatSessionSchema,
  chatMessageSchema,
  generatedImageSchema,
  userPreferenceSchema,
  memoryContextSchema,
  tokenUsageSchema,
  toolUsageSchema,
  ragMetricSchema,
  systemLogSchema,
  vectorEmbeddingSchema,
  offlineQueueSchema,
  goggaSmartSkillSchema,
  iconGenerationSchema,
} from './schemas';

import {
  documentMigrationStrategies,
  documentChunkMigrationStrategies,
  chatSessionMigrationStrategies,
  chatMessageMigrationStrategies,
  generatedImageMigrationStrategies,
  userPreferenceMigrationStrategies,
  memoryContextMigrationStrategies,
  tokenUsageMigrationStrategies,
  toolUsageMigrationStrategies,
  ragMetricMigrationStrategies,
  systemLogMigrationStrategies,
  vectorEmbeddingMigrationStrategies,
  offlineQueueMigrationStrategies,
  goggaSmartSkillMigrationStrategies,
  iconGenerationMigrationStrategies,
} from './schemaMigration';

// Add plugins
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBCleanupPlugin);
addRxPlugin(RxDBPipelinePlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);
// Additional plugins
addRxPlugin(RxDBJsonDumpPlugin); // Export/import database as JSON
addRxPlugin(RxDBStatePlugin); // Reactive state management
addRxPlugin(RxDBUpdatePlugin); // $set, $inc, $push update operators
addRxPlugin(RxDBLocalDocumentsPlugin); // Local documents for settings
addRxPlugin(RxDBcrdtPlugin); // Conflict-free replicated data types

// Add dev mode plugin in development or test
// IMPORTANT: disableWarnings() must be called BEFORE addRxPlugin() because
// the warning is shown in the plugin's init() function
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  disableWarnings(); // Must be before addRxPlugin!
  addRxPlugin(RxDBDevModePlugin);
}

// ============================================
// Singleton State with Thread-Safe Initialization
// ============================================

/**
 * Singleton database instance - cached after successful initialization
 */
let dbInstance: GoggaRxDatabase | null = null;

/**
 * Promise for in-progress initialization.
 * This is the KEY to preventing race conditions:
 * - First caller creates and stores the promise BEFORE awaiting
 * - All subsequent callers get the SAME promise
 * - Promise is NEVER cleared unless database is destroyed
 */
let dbPromise: Promise<GoggaRxDatabase> | null = null;

/**
 * Counter for DB6 schema mismatch auto-recovery attempts
 * Prevents infinite loops if recovery keeps failing
 */
let db6RecoveryAttempts = 0;
const MAX_DB6_RECOVERY_ATTEMPTS = 2;

// Storage limits (matching Dexie constants)
export const RAG_LIMITS = {
  MAX_DOCUMENT_SIZE_MB: 15,
  MAX_DOCUMENT_SIZE_BYTES: 15 * 1024 * 1024,
  MAX_TOTAL_STORAGE_MB: 100,
  MAX_TOTAL_STORAGE_BYTES: 100 * 1024 * 1024,
  JIVE_MAX_DOCS_PER_SESSION: 5,
  JIGGA_MAX_DOCS_PER_SESSION: 10,
} as const;

// Retention policy
export const RETENTION_POLICY = {
  METRICS_DAYS: 7,
  LOGS_DAYS: 7,
} as const;

/**
 * Generate a unique session ID
 * Format: "session-{base36_timestamp}-{random}" for human-readable sorting
 * 
 * NOTE: Canonical implementation is in db.ts - this re-exports for convenience
 * @see lib/db.ts generateSessionId
 */
export function generateSessionId(): string {
  // Use consistent format: session-{base36_timestamp}-{random}
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `session-${timestamp}-${random}`;
}

/**
 * Generate a unique document ID
 * Format: "{base36_timestamp}-{random}" for consistency with session IDs
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Check if a database instance is valid (exists and not destroyed)
 */
function isDbValid(db: GoggaRxDatabase | null): db is GoggaRxDatabase {
  if (!db) return false;
  // RxDB sets 'destroyed' property at runtime but TypeScript types don't include it
  return !(db as unknown as { destroyed?: boolean }).destroyed;
}

/**
 * Get or create the RxDB database instance
 * Uses lazy initialization with thread-safe singleton pattern
 * 
 * THREAD-SAFE SINGLETON PATTERN:
 * This implementation guarantees that only ONE database initialization
 * ever runs, even with parallel calls during Fast Refresh.
 * 
 * Key invariants:
 * 1. dbPromise is assigned SYNCHRONOUSLY before any await
 * 2. All concurrent calls wait on the SAME promise
 * 3. Promise is only cleared when database needs re-initialization
 * 
 * This prevents RxDB errors:
 * - DB8: Duplicate database with same name and adapter
 * - COL23: Collection already exists
 */
export async function getDatabase(): Promise<GoggaRxDatabase> {
  // Fast path: database already initialized and valid
  if (isDbValid(dbInstance)) {
    return dbInstance;
  }

  // Check if initialization is in progress
  // If dbPromise exists, wait on it (no matter what state it's in)
  if (dbPromise) {
    try {
      const db = await dbPromise;
      // Update cache and return if still valid
      if (isDbValid(db)) {
        dbInstance = db;
        return db;
      }
      // Database was destroyed, need to re-initialize
      dbPromise = null;
    } catch (error) {
      // Previous initialization failed, clear and retry
      console.warn('[RxDB] Previous initialization failed, retrying...', error);
      dbPromise = null;
      dbInstance = null;
    }
  }

  // CRITICAL: Create and store promise SYNCHRONOUSLY before any await
  // This ensures all concurrent calls get the same promise
  const initPromise = initDatabase();
  dbPromise = initPromise;

  try {
    const db = await initPromise;
    dbInstance = db;
    return db;
  } catch (error) {
    // Clear promise so next call can retry
    if (dbPromise === initPromise) {
      dbPromise = null;
    }
    throw error;
  }
}

/**
 * Initialize the RxDB database
 */
async function initDatabase(): Promise<GoggaRxDatabase> {
  console.log('[RxDB] Initializing database...');

  // Create storage with validation in development/test
  // Use 'as any' to work around strict type checking between wrapped storage types
  let storage: ReturnType<typeof getRxStorageDexie> = getRxStorageDexie();

  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test'
  ) {
    storage = wrappedValidateAjvStorage({ storage }) as typeof storage;
  }

  // Create the database
  // Use a unique name in test environment to avoid conflicts
  const dbName =
    process.env.NODE_ENV === 'test'
      ? `goggadb_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : 'goggadb';

  const db = await createRxDatabase<GoggaRxCollections>({
    name: dbName,
    storage,
    multiInstance: true, // Enable cross-tab sync
    eventReduce: true, // Optimize event processing
    ignoreDuplicate: true, // Allow re-opening in tests/hot-reload
    cleanupPolicy: {
      // Automatic cleanup of deleted documents
      minimumDeletedTime: 1000 * 60 * 60 * 24, // 24 hours
      minimumCollectionAge: 1000 * 60 * 60, // 1 hour
      runEach: 1000 * 60 * 5, // Every 5 minutes
      awaitReplicationsInSync: false,
      waitForLeadership: true, // Only leader does cleanup
    },
  });

  console.log('[RxDB] Database created, adding collections...');

  // Check if collections already exist (from ignoreDuplicate)
  // If the database already has documents collection, it's fully initialized
  if (!db.documents) {
    try {
      // Add all collections with migration strategies
      // When schema versions change, migrationStrategies handle data transformation
      await db.addCollections({
        documents: {
          schema: documentSchema,
          migrationStrategies: documentMigrationStrategies,
        },
        documentChunks: {
          schema: documentChunkSchema,
          migrationStrategies: documentChunkMigrationStrategies,
        },
        chatSessions: {
          schema: chatSessionSchema,
          migrationStrategies: chatSessionMigrationStrategies,
        },
        chatMessages: {
          schema: chatMessageSchema,
          migrationStrategies: chatMessageMigrationStrategies,
        },
        generatedImages: {
          schema: generatedImageSchema,
          migrationStrategies: generatedImageMigrationStrategies,
        },
        userPreferences: {
          schema: userPreferenceSchema,
          migrationStrategies: userPreferenceMigrationStrategies,
        },
        memoryContexts: {
          schema: memoryContextSchema,
          migrationStrategies: memoryContextMigrationStrategies,
        },
        tokenUsage: {
          schema: tokenUsageSchema,
          migrationStrategies: tokenUsageMigrationStrategies,
        },
        toolUsage: {
          schema: toolUsageSchema,
          migrationStrategies: toolUsageMigrationStrategies,
        },
        ragMetrics: {
          schema: ragMetricSchema,
          migrationStrategies: ragMetricMigrationStrategies,
        },
        systemLogs: {
          schema: systemLogSchema,
          migrationStrategies: systemLogMigrationStrategies,
        },
        vectorEmbeddings: {
          schema: vectorEmbeddingSchema,
          migrationStrategies: vectorEmbeddingMigrationStrategies,
        },
        offlineQueue: {
          schema: offlineQueueSchema,
          migrationStrategies: offlineQueueMigrationStrategies,
        },
        goggaSmartSkills: {
          schema: goggaSmartSkillSchema,
          migrationStrategies: goggaSmartSkillMigrationStrategies,
        },
        iconGenerations: {
          schema: iconGenerationSchema,
          migrationStrategies: iconGenerationMigrationStrategies,
        },
      });

      console.log('[RxDB] All collections added successfully');
    } catch (error: unknown) {
      // Handle RxDB errors gracefully
      const rxError = error as { code?: string; collection?: string };
      if (rxError.code === 'COL23') {
        // COL23: Collection already exists (from another tab/hot-reload)
        console.log('[RxDB] Collections already exist (COL23), continuing...');
      } else if (rxError.code === 'DB6') {
        // DB6: Schema mismatch - another instance has different schema
        // This happens when schema version changes but IndexedDB has old data
        db6RecoveryAttempts++;
        
        if (db6RecoveryAttempts > MAX_DB6_RECOVERY_ATTEMPTS) {
          console.error('[RxDB] Max DB6 recovery attempts reached. Please clear browser data manually.');
          throw new Error(
            'RxDB schema mismatch (DB6) persists after recovery attempts. ' +
            'Please clear your browser\'s IndexedDB for this site manually.'
          );
        }
        
        console.warn(`[RxDB] Schema mismatch detected (DB6), auto-recovering... (attempt ${db6RecoveryAttempts}/${MAX_DB6_RECOVERY_ATTEMPTS})`);
        console.warn('[RxDB] Collection with schema mismatch:', rxError.collection);
        
        // Close current database to release locks
        await db.close();
        
        // Delete the entire IndexedDB database directly (faster than RxDB removal)
        if (typeof indexedDB !== 'undefined') {
          await new Promise<void>((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase('goggadb');
            deleteRequest.onsuccess = () => {
              console.log('[RxDB] IndexedDB cleared successfully');
              resolve();
            };
            deleteRequest.onerror = () => {
              console.error('[RxDB] Failed to clear IndexedDB');
              reject(deleteRequest.error);
            };
            deleteRequest.onblocked = () => {
              console.warn('[RxDB] IndexedDB deletion blocked, forcing...');
              // Continue anyway - will work on next refresh
              resolve();
            };
          });
        }
        
        // Reset singleton state
        dbInstance = null;
        dbPromise = null;
        
        // Auto-retry by recursively calling getDatabase()
        console.log('[RxDB] Retrying database initialization...');
        return getDatabase();
      } else {
        throw error;
      }
    }
  } else {
    console.log('[RxDB] Collections already exist, skipping add');
  }

  // Set up cleanup for old metrics and logs
  setupRetentionCleanup(db);

  // Set up RxPipeline for automatic chunk embedding (only in browser)
  if (typeof window !== 'undefined') {
    setupEmbeddingPipeline(db);
  }

  // Reset recovery counter on successful initialization
  db6RecoveryAttempts = 0;

  return db;
}

// Track embedding pipeline for cleanup
// Using 'any' since RxPipeline type is internal to the plugin
let embeddingPipeline: {
  close: () => Promise<void>;
  remove: () => Promise<void>;
  awaitIdle: () => Promise<void>;
} | null = null;

/**
 * Set up RxPipeline for automatic embedding generation
 *
 * Benefits over simple subscription:
 * - Only leader instance runs operations (cross-tab safe)
 * - Continues from checkpoint on crashes/restarts
 * - Blocks reads on destination while processing (consistent queries)
 * - Handler is idempotent - checks for existing embeddings
 */
async function setupEmbeddingPipeline(db: GoggaRxDatabase): Promise<void> {
  try {
    // Import parallel embedding dynamically to avoid SSR issues
    const { generateParallelEmbedding } = await import('./parallelEmbedding');
    const { cacheEmbedding } = await import('./memoryStorage');
    const { calculateIndexValues } = await import('./vectorCollection');

    // Create pipeline from documentChunks to vectorEmbeddings
    embeddingPipeline = await db.documentChunks.addPipeline({
      identifier: 'chunk-embedding-pipeline',
      destination: db.vectorEmbeddings,
      /**
       * Handler must be idempotent - if it runs partially and restarts,
       * it should produce the same results
       */
      handler: async (docs) => {
        for (const doc of docs) {
          try {
            // Check if embedding already exists (idempotent check)
            const existingId = `vec_${doc.id}`;
            const existing = await db.vectorEmbeddings
              .findOne(existingId)
              .exec();

            if (existing) {
              // Already processed, skip
              continue;
            }

            // Generate embedding using parallel worker
            const embedding = await generateParallelEmbedding(doc.text);

            // Cache in memory for fast retrieval
            // This is optional - failure here should not block embedding storage
            try {
              await cacheEmbedding(doc.text, embedding);
            } catch (cacheError) {
              // Memory cache failures are non-critical - just log and continue
              // This can happen during rapid Hot Module Replacement or database init race conditions
              console.warn(
                `[RxDB Pipeline] Cache warning for chunk ${doc.id}:`,
                cacheError instanceof Error ? cacheError.message : 'Unknown error'
              );
            }

            // Calculate distance-to-samples for indexing
            const indexValues = await calculateIndexValues(embedding);

            // Insert into destination collection
            await db.vectorEmbeddings.insert({
              id: existingId,
              documentId: doc.documentId,
              chunkIndex: doc.chunkIndex,
              sessionId: doc.sessionId,
              text: doc.text,
              embedding,
              idx0: indexValues.idx0,
              idx1: indexValues.idx1,
              idx2: indexValues.idx2,
              idx3: indexValues.idx3,
              idx4: indexValues.idx4,
              createdAt: new Date().toISOString(),
            });

            console.log(
              `[RxDB Pipeline] Embedded chunk ${doc.chunkIndex} of ${doc.documentId}`
            );
          } catch (error) {
            // Handler must not throw - log and continue with next doc
            // Distinguish between transient errors (retry-able) and permanent errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isRxDBError = error && typeof error === 'object' && 'rxdb' in error;
            
            if (isRxDBError) {
              // RxDB errors like DB8, COL23 are often transient during HMR
              console.warn(
                `[RxDB Pipeline] Transient error embedding chunk ${doc.id} (will retry on next cycle):`,
                errorMessage
              );
            } else {
              console.error(
                `[RxDB Pipeline] Failed to embed chunk ${doc.id}:`,
                error
              );
            }
          }
        }
      },
    });

    console.log('[RxDB] Embedding pipeline set up (leader-only, checkpointed)');
  } catch (error) {
    console.error('[RxDB] Failed to set up embedding pipeline:', error);
  }
}

/**
 * Set up automatic cleanup for old metrics and logs
 */
function setupRetentionCleanup(db: GoggaRxDatabase): void {
  // Run cleanup when this tab becomes leader
  db.waitForLeadership().then(async () => {
    console.log('[RxDB] This tab is the leader, running retention cleanup...');
    await runRetentionCleanup(db);

    // Schedule periodic cleanup (every 6 hours)
    setInterval(() => runRetentionCleanup(db), 6 * 60 * 60 * 1000);
  });
}

/**
 * Clean up old metrics and logs based on retention policy
 */
async function runRetentionCleanup(db: GoggaRxDatabase): Promise<void> {
  const now = Date.now();
  const metricsThreshold =
    now - RETENTION_POLICY.METRICS_DAYS * 24 * 60 * 60 * 1000;
  const logsThreshold = now - RETENTION_POLICY.LOGS_DAYS * 24 * 60 * 60 * 1000;

  try {
    // Clean old metrics
    const oldMetrics = await db.ragMetrics
      .find({
        selector: { timestamp: { $lt: metricsThreshold } },
      })
      .exec();

    if (oldMetrics.length > 0) {
      await Promise.all(oldMetrics.map((doc) => doc.remove()));
      console.log(`[RxDB] Cleaned ${oldMetrics.length} old metrics`);
    }

    // Clean old logs
    const oldLogs = await db.systemLogs
      .find({
        selector: { timestamp: { $lt: logsThreshold } },
      })
      .exec();

    if (oldLogs.length > 0) {
      await Promise.all(oldLogs.map((doc) => doc.remove()));
      console.log(`[RxDB] Cleaned ${oldLogs.length} old logs`);
    }
  } catch (error) {
    console.error('[RxDB] Retention cleanup error:', error);
  }
}

/**
 * Check if this tab is the leader
 */
export async function isLeader(): Promise<boolean> {
  const db = await getDatabase();
  return db.isLeader();
}

/**
 * Wait for leadership
 */
export async function waitForLeadership(): Promise<void> {
  const db = await getDatabase();
  await db.waitForLeadership();
}

/**
 * Observable for leadership changes
 * Uses polling since RxDB doesn't expose isLeader$ observable directly
 */
export function getLeadershipObservable(): Observable<boolean> {
  return new Observable((subscriber) => {
    let lastValue: boolean | null = null;

    const checkLeadership = async () => {
      try {
        const db = await getDatabase();
        const current = db.isLeader();
        if (current !== lastValue) {
          lastValue = current;
          subscriber.next(current);
        }
      } catch (error) {
        subscriber.error(error);
      }
    };

    // Check immediately
    checkLeadership();

    // Poll every 2 seconds
    const interval = setInterval(checkLeadership, 2000);

    return () => clearInterval(interval);
  });
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  documents: number;
  chunks: number;
  messages: number;
  images: number;
  vectors: number;
  totalMB: number;
}> {
  const db = await getDatabase();

  const [documents, chunks, messages, images, vectors] = await Promise.all([
    db.documents.count().exec(),
    db.documentChunks.count().exec(),
    db.chatMessages.count().exec(),
    db.generatedImages.count().exec(),
    db.vectorEmbeddings.count().exec(),
  ]);

  // Estimate storage size (rough approximation)
  const allDocs = await db.documents.find().exec();
  const totalBytes = allDocs.reduce((sum, doc) => sum + doc.size, 0);
  const totalMB = totalBytes / (1024 * 1024);

  return {
    documents,
    chunks,
    messages,
    images,
    vectors,
    totalMB,
  };
}

/**
 * Check storage limits before upload
 */
export async function checkStorageLimits(
  newDocSizeBytes: number,
  tier: 'jive' | 'jigga',
  sessionId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const db = await getDatabase();

  // Check single document size
  if (newDocSizeBytes > RAG_LIMITS.MAX_DOCUMENT_SIZE_BYTES) {
    return {
      allowed: false,
      reason: `Document exceeds maximum size of ${RAG_LIMITS.MAX_DOCUMENT_SIZE_MB}MB`,
    };
  }

  // Check total storage
  const stats = await getStorageStats();
  const newTotalMB = stats.totalMB + newDocSizeBytes / (1024 * 1024);

  if (newTotalMB > RAG_LIMITS.MAX_TOTAL_STORAGE_MB) {
    return {
      allowed: false,
      reason: `Would exceed total storage limit of ${RAG_LIMITS.MAX_TOTAL_STORAGE_MB}MB`,
    };
  }

  // Check per-session document limit
  const sessionDocs = await db.documents
    .find({
      selector: { sessionId },
    })
    .exec();

  const maxDocs =
    tier === 'jigga'
      ? RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION
      : RAG_LIMITS.JIVE_MAX_DOCS_PER_SESSION;

  if (sessionDocs.length >= maxDocs) {
    return {
      allowed: false,
      reason: `Session has reached the maximum of ${maxDocs} documents`,
    };
  }

  return { allowed: true };
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDatabase();

  await Promise.all([
    db.documents.find().remove(),
    db.documentChunks.find().remove(),
    db.chatSessions.find().remove(),
    db.chatMessages.find().remove(),
    db.generatedImages.find().remove(),
    db.userPreferences.find().remove(),
    db.memoryContexts.find().remove(),
    db.tokenUsage.find().remove(),
    db.ragMetrics.find().remove(),
    db.systemLogs.find().remove(),
    db.vectorEmbeddings.find().remove(),
    db.offlineQueue.find().remove(),
  ]);

  console.log('[RxDB] All data cleared');
}

/**
 * Destroy database (for cleanup)
 */
export async function destroyDatabase(): Promise<void> {
  // Clean up embedding pipeline first
  if (embeddingPipeline) {
    await embeddingPipeline.close();
    embeddingPipeline = null;
  }

  if (dbInstance) {
    await dbInstance.remove();
    dbInstance = null;
    console.log('[RxDB] Database destroyed');
  }
}

/**
 * Force reset the database by completely removing it
 * Use this to recover from schema mismatch errors (DB6)
 * After calling this, the page MUST be refreshed to recreate the database
 */
export async function forceResetDatabase(): Promise<void> {
  console.warn('[RxDB] Force resetting database...');
  
  // Clean up embedding pipeline first
  if (embeddingPipeline) {
    try {
      await embeddingPipeline.close();
    } catch {
      // Ignore errors during cleanup
    }
    embeddingPipeline = null;
  }

  // Close the database instance if it exists
  if (dbInstance) {
    try {
      await dbInstance.close();
    } catch {
      // Ignore errors during close
    }
    dbInstance = null;
  }

  // Clear the initialization promise
  dbPromise = null;

  // Remove the database completely from IndexedDB
  try {
    await removeRxDatabase('goggadb', getRxStorageDexie());
    console.log('[RxDB] Database removed from IndexedDB');
  } catch (error) {
    console.error('[RxDB] Error removing database:', error);
    // As fallback, try to delete via native IndexedDB API
    if (typeof indexedDB !== 'undefined') {
      const databases = ['goggadb', 'goggadb-0', 'goggadb-1'];
      for (const dbName of databases) {
        try {
          indexedDB.deleteDatabase(dbName);
          console.log(`[RxDB] Deleted IndexedDB: ${dbName}`);
        } catch {
          // Ignore
        }
      }
    }
  }
  
  console.log('[RxDB] Database force reset complete. Refresh the page to recreate.');
}

/**
 * Get embedding pipeline status
 */
export function getEmbeddingPipelineStatus(): {
  active: boolean;
} {
  return {
    active: embeddingPipeline !== null,
  };
}

/**
 * Wait for embedding pipeline to finish processing
 */
export async function awaitEmbeddingPipelineIdle(): Promise<void> {
  if (embeddingPipeline) {
    await embeddingPipeline.awaitIdle();
  }
}

/**
 * Remove embedding pipeline and reset checkpoint
 * This will cause all documents to be reprocessed on next creation
 */
export async function resetEmbeddingPipeline(): Promise<void> {
  if (embeddingPipeline) {
    await embeddingPipeline.remove();
    embeddingPipeline = null;
    console.log(
      '[RxDB] Embedding pipeline removed, will reprocess all on restart'
    );
  }
}

// ============================================================================
// Cleanup Utilities
// ============================================================================

/**
 * Run cleanup on a specific collection to purge deleted documents
 * This removes documents that have been soft-deleted
 *
 * @param collectionName - Name of the collection to clean
 * @param minimumDeletedTime - Minimum time (ms) since deletion (default: 0 = immediate)
 * @returns Whether cleanup was performed
 */
export async function cleanupCollection(
  collectionName: keyof GoggaRxCollections,
  minimumDeletedTime: number = 0
): Promise<boolean> {
  const db = await getDatabase();
  const collection = db[collectionName];

  // RxDB cleanup() returns a boolean indicating if cleanup was performed
  const cleaned = await collection.cleanup(minimumDeletedTime);
  if (cleaned) {
    console.log(
      `[RxDB Cleanup] Cleaned deleted documents from ${collectionName}`
    );
  }
  return cleaned;
}

/**
 * Run cleanup on all collections
 *
 * @param minimumDeletedTime - Minimum time (ms) since deletion (default: 0 = immediate)
 * @returns Number of collections that had documents cleaned
 */
export async function cleanupAllCollections(
  minimumDeletedTime: number = 0
): Promise<number> {
  const db = await getDatabase();

  const collections: (keyof GoggaRxCollections)[] = [
    'documents',
    'documentChunks',
    'chatSessions',
    'chatMessages',
    'generatedImages',
    'userPreferences',
    'memoryContexts',
    'tokenUsage',
    'ragMetrics',
    'systemLogs',
    'vectorEmbeddings',
    'offlineQueue',
  ];

  let cleanedCount = 0;

  for (const name of collections) {
    const cleaned = await db[name].cleanup(minimumDeletedTime);
    if (cleaned) {
      cleanedCount++;
    }
  }

  console.log(`[RxDB Cleanup] Cleaned ${cleanedCount} collections`);
  return cleanedCount;
}

/**
 * Empty a collection (delete all documents then purge)
 * Use this instead of collection.remove() to preserve the collection
 *
 * @param collectionName - Name of the collection to empty
 * @returns Number of documents deleted
 */
export async function emptyCollection(
  collectionName: keyof GoggaRxCollections
): Promise<number> {
  const db = await getDatabase();
  const collection = db[collectionName];

  // Get count first
  const count = await collection.count().exec();

  // Delete all documents
  await collection.find().remove();

  // Immediately purge deleted documents
  await collection.cleanup(0);

  console.log(`[RxDB Cleanup] Emptied ${collectionName}: ${count} documents`);
  return count;
}

/**
 * Purge old metrics beyond retention period
 * Runs automatically but can be called manually
 */
export async function purgeOldMetrics(): Promise<number> {
  const db = await getDatabase();
  const threshold =
    Date.now() - RETENTION_POLICY.METRICS_DAYS * 24 * 60 * 60 * 1000;

  const oldMetrics = await db.ragMetrics
    .find({
      selector: { timestamp: { $lt: threshold } },
    })
    .exec();

  if (oldMetrics.length > 0) {
    await Promise.all(oldMetrics.map((doc) => doc.remove()));
    await db.ragMetrics.cleanup(0);
  }

  console.log(`[RxDB Cleanup] Purged ${oldMetrics.length} old metrics`);
  return oldMetrics.length;
}

/**
 * Purge old logs beyond retention period
 * Runs automatically but can be called manually
 */
export async function purgeOldLogs(): Promise<number> {
  const db = await getDatabase();
  const threshold =
    Date.now() - RETENTION_POLICY.LOGS_DAYS * 24 * 60 * 60 * 1000;

  const oldLogs = await db.systemLogs
    .find({
      selector: { timestamp: { $lt: threshold } },
    })
    .exec();

  if (oldLogs.length > 0) {
    await Promise.all(oldLogs.map((doc) => doc.remove()));
    await db.systemLogs.cleanup(0);
  }

  console.log(`[RxDB Cleanup] Purged ${oldLogs.length} old logs`);
  return oldLogs.length;
}

/**
 * Purge orphaned embeddings (where parent document no longer exists)
 * Useful for maintaining database consistency
 */
export async function purgeOrphanedEmbeddings(): Promise<number> {
  const db = await getDatabase();

  // Get all embeddings and documents
  const [embeddings, documents] = await Promise.all([
    db.vectorEmbeddings.find().exec(),
    db.documents.find().exec(),
  ]);

  // Create set of valid document IDs
  const validDocIds = new Set(documents.map((d) => d.id));

  // Find orphaned embeddings
  const orphaned = embeddings.filter((e) => !validDocIds.has(e.documentId));

  if (orphaned.length > 0) {
    await Promise.all(orphaned.map((e) => e.remove()));
    await db.vectorEmbeddings.cleanup(0);
  }

  console.log(`[RxDB Cleanup] Purged ${orphaned.length} orphaned embeddings`);
  return orphaned.length;
}

/**
 * Purge orphaned chunks (where parent document no longer exists)
 */
export async function purgeOrphanedChunks(): Promise<number> {
  const db = await getDatabase();

  const [chunks, documents] = await Promise.all([
    db.documentChunks.find().exec(),
    db.documents.find().exec(),
  ]);

  const validDocIds = new Set(documents.map((d) => d.id));
  const orphaned = chunks.filter((c) => !validDocIds.has(c.documentId));

  if (orphaned.length > 0) {
    await Promise.all(orphaned.map((c) => c.remove()));
    await db.documentChunks.cleanup(0);
  }

  console.log(`[RxDB Cleanup] Purged ${orphaned.length} orphaned chunks`);
  return orphaned.length;
}

/**
 * Full database maintenance routine
 * Runs all cleanup and optimization tasks
 */
export async function runDatabaseMaintenance(): Promise<{
  metricsCleared: number;
  logsCleared: number;
  orphanedEmbeddings: number;
  orphanedChunks: number;
  totalPurged: number;
}> {
  console.log('[RxDB Maintenance] Starting full database maintenance...');

  const [metricsCleared, logsCleared, orphanedEmbeddings, orphanedChunks] =
    await Promise.all([
      purgeOldMetrics(),
      purgeOldLogs(),
      purgeOrphanedEmbeddings(),
      purgeOrphanedChunks(),
    ]);

  // Cleanup all collections for deleted docs
  const totalPurged = await cleanupAllCollections(0);

  console.log('[RxDB Maintenance] Complete');

  return {
    metricsCleared,
    logsCleared,
    orphanedEmbeddings,
    orphanedChunks,
    totalPurged,
  };
}
