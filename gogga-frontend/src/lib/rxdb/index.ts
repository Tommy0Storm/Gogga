/**
 * GOGGA RxDB - Main Entry Point
 * Exports all RxDB functionality for the application
 */

// Database
export {
  getDatabase,
  generateSessionId,
  generateId,
  isLeader,
  waitForLeadership,
  getLeadershipObservable,
  getStorageStats,
  checkStorageLimits,
  clearAllData,
  destroyDatabase,
  getEmbeddingPipelineStatus,
  awaitEmbeddingPipelineIdle,
  resetEmbeddingPipeline,
  RAG_LIMITS,
  RETENTION_POLICY,
  // Cleanup utilities
  cleanupCollection,
  cleanupAllCollections,
  emptyCollection,
  purgeOldMetrics,
  purgeOldLogs,
  purgeOrphanedEmbeddings,
  purgeOrphanedChunks,
  runDatabaseMaintenance,
  // Memory Storage exports
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
  // Parallel Embedding exports
  getParallelEmbeddingManager,
  generateParallelEmbeddings,
  generateParallelEmbedding,
} from './database';

export type {
  ActiveSessionDoc,
  EmbeddingCacheDoc,
  PendingOperationDoc,
} from './database';

export { ParallelEmbeddingManager } from './parallelEmbedding';

// Performance Utilities (re-exported from RxDB)
export * from './performanceUtils';

// React Hooks for chat integration
export {
  useSession,
  useAppSettings,
  usePendingOperations,
  useChatSessions,
  useChatMessages,
  useEmbeddingCache,
} from './hooks';

export type {
  UseSessionState,
  UseSessionReturn,
  AppSettings,
  UseAppSettingsReturn,
  UsePendingOperationsReturn,
  UseChatSessionsReturn,
  UseChatMessagesReturn,
  UseEmbeddingCacheReturn,
} from './hooks';

// Schema Migration Utilities
export {
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
  allMigrationStrategies,
  addFieldMigration,
  removeFieldMigration,
  renameFieldMigration,
  transformFieldMigration,
} from './schemaMigration';

// Schemas and Types
export type {
  DocumentDoc,
  DocumentChunkDoc,
  ChatSessionDoc,
  ChatMessageDoc,
  GeneratedImageDoc,
  UserPreferenceDoc,
  MemoryContextDoc,
  TokenUsageDoc,
  RagMetricDoc,
  SystemLogDoc,
  VectorEmbeddingDoc,
  OfflineQueueDoc,
  GoggaRxDatabase,
  GoggaRxCollections,
} from './schemas';

// Vector Collection
export {
  getSampleVectors,
  calculateIndexValues,
  storeVectorEmbedding,
  storeVectorEmbeddingsBulk,
  findSimilarVectors,
  getVectorsForDocument,
  deleteVectorsForDocument,
  deleteVectorsForSession,
  getVectorStats,
  hasVectorsForDocument,
  recalibrateSampleVectors,
  reindexAllVectors,
  // Index-based vector search (faster alternatives)
  vectorSearchIndexRange,
  vectorSearchIndexSimilarity,
  vectorSearchFullScan,
  // Re-exported RxDB vector utilities
  euclideanDistance,
  cosineSimilarity,
  manhattanDistance,
  sortByObjectNumberProperty,
} from './vectorCollection';

// Embedding Pipeline
export {
  startEmbeddingPipeline,
  stopEmbeddingPipeline,
  getPipelineState,
  getPipelineStats,
  onPipelineProgress,
  reprocessDocument,
  processDocumentImmediate,
  generateQueryEmbedding,
  clearPipelineProgress,
} from './embeddingPipeline';

// Migration
export {
  isMigrationNeeded,
  getMigrationState,
  runMigration,
  resetMigrationState,
  deleteDexieDatabase,
} from './migration';

// Advanced Features
export {
  // Semantic Session Search
  searchSessionsBySimilarity,
  getSimilarSessions,
  
  // Document Clustering
  clusterDocuments,
  getDocumentClusters,
  
  // Offline Queue
  addToOfflineQueue,
  processOfflineQueue,
  getOfflineQueueStatus,
  
  // Conversation Insights
  getConversationInsights,
  getDailyTokenUsage,
  getTopicDistribution,
  
  // Hybrid Search
  hybridSearch,
  
  // Memory Graph
  getMemoryGraph,
  findRelatedMemories,
} from './advancedFeatures';

// Unified Monitoring (RxJS-powered observables)
export {
  createStorageStatsObservable,
  createVectorStatsObservable,
  createPipelineObservable,
  createHealthObservable,
  createRealTimeMetricsObservable,
  getSearchHistoryObservable,
  getSearchPerformanceObservable,
  trackVectorSearch,
  destroyMonitoring,
  subscribeWithCleanup,
} from './unifiedMonitoring';

export type {
  UnifiedStorageStats,
  VectorMonitoringState,
  PipelineMonitoringState,
  DatabaseHealth,
  RealTimeMetrics,
  VectorSearchResult,
} from './unifiedMonitoring';

// Monitoring React Hooks
export {
  useUnifiedStorage,
  useVectorMonitoring,
  usePipelineMonitoring,
  useDatabaseHealth,
  useRealTimeMetrics,
  useVectorAnimation,
  useSimilarityWave,
} from './monitoringHooks';

export type {
  UseUnifiedStorageReturn,
  UseVectorMonitoringReturn,
  UsePipelineMonitoringReturn,
  UseDatabaseHealthReturn,
  UseRealTimeMetricsReturn,
  VectorAnimationState,
} from './monitoringHooks';

