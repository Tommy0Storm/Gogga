# RxDB Implementation for GOGGA

## Overview
Complete RxDB 16.21.1 implementation replacing/augmenting Dexie for client-side storage.
Uses Distance-to-Samples vector indexing for efficient similarity search without external dependencies.

## Files Created

### Core Database
- `gogga-frontend/src/lib/rxdb/schemas.ts` - 12 collection schemas with TypeScript types
- `gogga-frontend/src/lib/rxdb/database.ts` - Database factory, singleton, ID generation
- `gogga-frontend/src/lib/rxdb/index.ts` - Public exports

### Vector Search
- `gogga-frontend/src/lib/rxdb/vectorCollection.ts` - Distance-to-Samples indexing
  - 5 sample vectors (idx0-idx4) for spatial partitioning
  - 384-dimension E5-small-v2 embeddings
  - Cosine similarity search with threshold filtering

### Pipeline & Migration
- `gogga-frontend/src/lib/rxdb/embeddingPipeline.ts` - Reactive batch processing
- `gogga-frontend/src/lib/rxdb/migration.ts` - Dexie → RxDB data migration

### Advanced Features
- `gogga-frontend/src/lib/rxdb/advancedFeatures.ts`
  - Reactive subscriptions (Observable-based)
  - Conflict resolution (timestamp-based)
  - Cross-document relationships
  - Session management
  - Token usage analytics
  - System logging
  - Cluster analysis
  - Schema versioning

### Dashboard
- `gogga-frontend/src/lib/rxdb/dashboardComponents.tsx`
  - RAG metrics visualization
  - Pipeline status monitoring
  - Vector search analytics
  - React hooks for subscriptions

### Testing
- `gogga-frontend/src/lib/rxdb/__tests__/rxdb.test.ts` - 24 passing tests
- `gogga-frontend/vitest.config.ts` - Test configuration

## Collections (12 total)
1. `documents` - Uploaded documents with content
2. `documentChunks` - Document chunks for RAG
3. `chatSessions` - Chat session metadata
4. `chatMessages` - Individual chat messages
5. `generatedImages` - AI-generated images
6. `userPreferences` - User settings
7. `memoryContexts` - BuddySystem memories
8. `tokenUsage` - Daily token tracking
9. `ragMetrics` - RAG performance metrics
10. `systemLogs` - Application logs
11. `vectorEmbeddings` - Vector embeddings with idx0-idx4 indexes
12. `offlineQueue` - Offline message queue

## Distance-to-Samples Indexing

Instead of storing full 384-dim vectors in indexes (expensive), we:
1. Generate 5 sample vectors at initialization
2. For each document embedding, calculate distance to each sample
3. Store distances as fixed-length strings (idx0-idx4)
4. Query by finding candidates with similar distances, then refine with cosine similarity

```typescript
// Sample usage
const similar = await findSimilarVectors(queryEmbedding, 10, sessionId, 0.7);
```

## Key Patterns

### Singleton Database
```typescript
const db = await getDatabase(); // Returns singleton
```

### ID Generation
```typescript
const id = generateId(); // timestamp_random format
const sessionId = generateSessionId(); // session_timestamp_random
```

### Reactive Subscriptions
```typescript
const messages$ = subscribeToCollection<ChatMessageDoc>('chatMessages');
messages$.subscribe(messages => updateUI(messages));
```

## Environment Handling

- **Production**: Uses `goggadb` database name, minimal validation
- **Development**: Uses dev-mode plugin, AJV validation wrapper
- **Test**: Uses unique timestamped database names, single fork pool

## Dependencies
- `rxdb`: 16.21.1
- `rxjs`: 7.8.2
- `vitest`: 4.0.15 (dev)
- `fake-indexeddb`: 6.2.5 (dev)

## Storage
Uses `rxdb/plugins/storage-dexie` (free tier) - wraps IndexedDB via Dexie.
For production, consider RxDB premium storage for better performance.

## Migration from Dexie
Use `runFullMigration()` from migration.ts to transfer:
- Documents
- Chat sessions
- Messages
- Images
- User preferences
- Memory contexts
- Token usage

## New Features (December 2025)

### RxPipeline for Automatic Embedding
- **File**: `database.ts`
- **Plugin**: `RxDBPipelinePlugin` from `rxdb/plugins/pipeline`
- **Purpose**: Automatically generates embeddings when document chunks are added
- **Key Benefits** (from RxDB documentation):
  1. Only leader instance runs operations (cross-tab safe)
  2. Continues from checkpoint on crashes/restarts
  3. Blocks reads on destination while processing (consistent queries)
- **Handler is idempotent**: Checks for existing embeddings before generating
- **Functions**: `getEmbeddingPipelineStatus()`, `awaitEmbeddingPipelineIdle()`, `resetEmbeddingPipeline()`

### Memory RxStorage (Fast Ephemeral Data)
- **File**: `memoryStorage.ts`
- **Plugin**: `getRxStorageMemory()` from `rxdb/plugins/storage-memory`
- **Collections**:
  1. `activeSessions` - Current user session state (typing, model, pending messages)
  2. `embeddingCache` - Hash-based cache for embeddings (avoids recalculating)
  3. `pendingOperations` - Optimistic UI operations queue

**Key Functions**:
- `updateActiveSession(sessionId, updates)` / `getActiveSession()`
- `getCachedEmbedding(text)` / `cacheEmbedding(text, embedding)` (500 max, LRU eviction)
- `addPendingOperation()` / `getPendingOperations()` (optimistic UI)
- `getAppSettings()` / `updateAppSettings()` (local documents)

### Parallel Embedding with WebWorkers
- **Files**: `embeddingWorker.ts`, `parallelEmbedding.ts`
- Uses `navigator.hardwareConcurrency` to scale worker count (max 4)
- Integrates with Memory Storage embedding cache
- **Functions**: `generateParallelEmbeddings(texts, onProgress)`, `generateParallelEmbedding(text)`

### Population (Document References)
- **File**: `schemas.ts`
- Uses RxDB `ref` property for cross-collection relationships
- **Relationships**:
  - `chatMessages.sessionId` → `chatSessions` collection
  - `chatMessages.imageId` → `generatedImages` collection
  - `documentChunks.documentId` → `documents` collection
  - `vectorEmbeddings.documentId` → `documents` collection
- **Usage**: Access related docs via underscore suffix (e.g., `await doc.sessionId_`)

### Vector Plugin Utilities
- **File**: `vectorCollection.ts`
- **Imports**: 
  - `euclideanDistance`, `cosineSimilarity`, `manhattanDistance` from `rxdb/plugins/vector`
  - `sortByObjectNumberProperty` from `rxdb/plugins/core`
- **New Search Functions**:
  - `vectorSearchIndexRange()` - Fast search using index ranges (~88ms vs ~765ms)
  - `vectorSearchIndexSimilarity()` - Predictable doc reads per index side
  - `vectorSearchFullScan()` - Baseline comparison (slowest but optimal results)
- All utilities re-exported for convenience

### Cleanup Utilities
- **File**: `database.ts`
- **Functions**:
  - `cleanupCollection(name, minTime)` - Purge deleted docs from specific collection
  - `cleanupAllCollections(minTime)` - Purge deleted docs from all collections
  - `emptyCollection(name)` - Delete all docs then purge (preserves collection)
  - `purgeOldMetrics()` - Remove metrics beyond retention period
  - `purgeOldLogs()` - Remove logs beyond retention period
  - `purgeOrphanedEmbeddings()` - Remove embeddings with no parent document
  - `purgeOrphanedChunks()` - Remove chunks with no parent document
  - `runDatabaseMaintenance()` - Full maintenance routine (runs all above)

## Testing
```bash
cd gogga-frontend
NODE_ENV=test pnpm exec vitest run src/lib/rxdb
```

All 66 tests pass (24 original + 15 memory storage + 27 advanced features):
- Database initialization
- Document CRUD
- Vector storage and search
- Pipeline stats
- Chat sessions
- Offline queue
- Cleanup utilities
- Vector search methods
- Schema migration helpers
- Population refs

### Schema Migration (December 2025)
- **File**: `schemaMigration.ts`
- **Plugin**: `RxDBMigrationSchemaPlugin` from `rxdb/plugins/migration-schema`
- **Purpose**: Handle schema version upgrades for all 12 collections
- **Migration Strategies**: Each collection has a `migrationStrategies` object keyed by version
- **Helper Functions**:
  - `addFieldMigration(fieldName, defaultValue)` - Add new field with default
  - `removeFieldMigration(fieldName)` - Remove deprecated field
  - `renameFieldMigration(oldName, newName)` - Rename field
  - `transformFieldMigration(fieldName, transformer)` - Transform field value
- **Vector Embeddings Note**: Return null to delete embeddings when model changes

### React Hooks for Chat Integration (December 2025)
- **File**: `hooks.ts`
- **Hooks**:
  1. `useSession()` - Session state with memory storage (typing, model, pending count)
  2. `useAppSettings()` - Local documents for app settings
  3. `usePendingOperations()` - Optimistic UI queue management
  4. `useChatSessions(query?, limit?)` - Reactive session queries
  5. `useChatMessages(sessionId, limit?)` - Reactive message queries
  6. `useEmbeddingCache()` - Embedding cache access
- **Pattern**: All hooks use RxJS Observable subscriptions with cleanup
