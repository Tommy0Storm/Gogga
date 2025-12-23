/**
 * Integration tests for db-rxdb.ts shim
 * Verifies API compatibility with db.ts
 */

import { describe, it, expect } from 'vitest';

describe('db-rxdb Shim Exports', () => {
  it('should export all required constants', async () => {
    const dbRxdb = await import('../db');
    
    // Check limits
    expect(dbRxdb.RAG_LIMITS).toBeDefined();
    expect(dbRxdb.RAG_LIMITS.MAX_DOCUMENT_SIZE_MB).toBe(15);
    expect(dbRxdb.RAG_LIMITS.MAX_TOTAL_STORAGE_MB).toBe(100);
    
    expect(dbRxdb.RETENTION_POLICY).toBeDefined();
    expect(dbRxdb.RETENTION_POLICY.METRICS_DAYS).toBe(30);
    
    expect(dbRxdb.GOGGA_SMART_LIMITS).toBeDefined();
    expect(dbRxdb.GOGGA_SMART_LIMITS.MAX_SKILLS_PER_USER).toBe(100);
    
    expect(dbRxdb.MEMORY_LIMITS).toBeDefined();
    expect(dbRxdb.MEMORY_LIMITS.MAX_MEMORIES).toBe(50);
  });

  it('should export SUPPORTED_RAG_FORMATS', async () => {
    const dbRxdb = await import('../db');
    
    expect(dbRxdb.SUPPORTED_RAG_FORMATS).toBeDefined();
    expect(dbRxdb.SUPPORTED_RAG_FORMATS['application/pdf']).toBeDefined();
    expect(dbRxdb.isSupportedFormat('application/pdf')).toBe(true);
    expect(dbRxdb.isSupportedFormat('application/fake')).toBe(false);
    expect(dbRxdb.getSupportedExtensions()).toContain('.pdf');
  });

  it('should export db proxy object', async () => {
    const dbRxdb = await import('../db');
    
    expect(dbRxdb.db).toBeDefined();
    expect(dbRxdb.db.documents).toBeDefined();
    expect(dbRxdb.db.sessions).toBeDefined();
    expect(dbRxdb.db.messages).toBeDefined();
    expect(dbRxdb.db.images).toBeDefined();
    expect(dbRxdb.db.memories).toBeDefined();
    expect(dbRxdb.db.skills).toBeDefined();
  });

  it('should export all session management functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.generateSessionId).toBe('function');
    expect(typeof dbRxdb.createChatSession).toBe('function');
    expect(typeof dbRxdb.getChatSessions).toBe('function');
    expect(typeof dbRxdb.updateSessionTitle).toBe('function');
    expect(typeof dbRxdb.deleteSession).toBe('function');
  });

  it('should export all message management functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.saveMessage).toBe('function');
    expect(typeof dbRxdb.getSessionMessages).toBe('function');
  });

  it('should export all image management functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.saveGeneratedImage).toBe('function');
    expect(typeof dbRxdb.getSessionImages).toBe('function');
    expect(typeof dbRxdb.softDeleteImage).toBe('function');
    expect(typeof dbRxdb.getImage).toBe('function');
  });

  it('should export all document management functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.getActiveDocumentsForSession).toBe('function');
    expect(typeof dbRxdb.getUserDocumentPool).toBe('function');
    expect(typeof dbRxdb.getUserDocumentCount).toBe('function');
    expect(typeof dbRxdb.activateDocumentForSession).toBe('function');
    expect(typeof dbRxdb.deactivateDocumentFromSession).toBe('function');
    expect(typeof dbRxdb.getOrphanedDocuments).toBe('function');
    expect(typeof dbRxdb.deleteDocumentFromPool).toBe('function');
    expect(typeof dbRxdb.getSessionDocuments).toBe('function');
    expect(typeof dbRxdb.clearSessionDocuments).toBe('function');
  });

  it('should export all stats and utility functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.clearAllData).toBe('function');
    expect(typeof dbRxdb.getDocumentCount).toBe('function');
    expect(typeof dbRxdb.getTotalChunks).toBe('function');
    expect(typeof dbRxdb.getStorageStats).toBe('function');
    expect(typeof dbRxdb.getTotalRAGStorageBytes).toBe('function');
    expect(typeof dbRxdb.getTotalRAGStorageMB).toBe('function');
    expect(typeof dbRxdb.checkStorageLimits).toBe('function');
    expect(typeof dbRxdb.getAllDocuments).toBe('function');
    expect(typeof dbRxdb.getDocumentsGroupedBySession).toBe('function');
    expect(typeof dbRxdb.getDocumentsByIds).toBe('function');
    expect(typeof dbRxdb.getStorageUsageBreakdown).toBe('function');
  });

  it('should export all token usage functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.trackTokenUsage).toBe('function');
    expect(typeof dbRxdb.getTodayTokenUsage).toBe('function');
    expect(typeof dbRxdb.getTokenUsageHistory).toBe('function');
    expect(typeof dbRxdb.getTotalTokenUsage).toBe('function');
  });

  it('should export all memory context functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.createMemory).toBe('function');
    expect(typeof dbRxdb.updateMemory).toBe('function');
    expect(typeof dbRxdb.deleteMemory).toBe('function');
    expect(typeof dbRxdb.deleteGoggaMemory).toBe('function');
    expect(typeof dbRxdb.getMemoriesBySource).toBe('function');
    expect(typeof dbRxdb.getAllMemories).toBe('function');
    expect(typeof dbRxdb.getActiveMemories).toBe('function');
    expect(typeof dbRxdb.getMemoriesByCategory).toBe('function');
    expect(typeof dbRxdb.getMemoryContextForLLM).toBe('function');
    expect(typeof dbRxdb.getMemoryStats).toBe('function');
  });

  it('should export all RAG metrics functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.saveRagMetric).toBe('function');
    expect(typeof dbRxdb.getRecentRagMetrics).toBe('function');
    expect(typeof dbRxdb.getAggregatedRagMetrics).toBe('function');
    expect(typeof dbRxdb.cleanupOldRagMetrics).toBe('function');
    expect(typeof dbRxdb.clearAllRagMetrics).toBe('function');
  });

  it('should export all system log functions', async () => {
    const dbRxdb = await import('../db');
    
    expect(typeof dbRxdb.saveSystemLog).toBe('function');
    expect(typeof dbRxdb.logDebug).toBe('function');
    expect(typeof dbRxdb.logInfo).toBe('function');
    expect(typeof dbRxdb.logWarn).toBe('function');
    expect(typeof dbRxdb.logError).toBe('function');
    expect(typeof dbRxdb.getRecentSystemLogs).toBe('function');
    expect(typeof dbRxdb.cleanupOldSystemLogs).toBe('function');
    expect(typeof dbRxdb.clearAllSystemLogs).toBe('function');
    expect(typeof dbRxdb.runRetentionCleanup).toBe('function');
    expect(typeof dbRxdb.getMetricsAndLogsStats).toBe('function');
  });
});

// Compare exports between db.ts and db-rxdb.ts to ensure parity
// Note: Due to Dexie version conflict (RxDB bundles 4.0.10, we use 4.2.1),
// we cannot import both db.ts and db-rxdb.ts in the same test.
// These tests verify db-rxdb.ts exports match expected db.ts exports.
describe('db-rxdb API Parity with db.ts', () => {
  it('should have matching constants as db.ts', async () => {
    const dbRxdb = await import('../db');
    
    // Constants should match db.ts values
    expect(dbRxdb.RAG_LIMITS.MAX_DOCUMENT_SIZE_MB).toBe(15);
    expect(dbRxdb.RAG_LIMITS.MAX_TOTAL_STORAGE_MB).toBe(100);
    expect(dbRxdb.RETENTION_POLICY.METRICS_DAYS).toBe(30);
    expect(dbRxdb.GOGGA_SMART_LIMITS.MAX_SKILLS_PER_USER).toBe(100);
    expect(dbRxdb.MEMORY_LIMITS.MAX_MEMORIES).toBe(50);
  });

  it('should have all key function exports matching db.ts', async () => {
    const dbRxdb = await import('../db');
    
    // Key functions that must exist (matching db.ts exports)
    const requiredFunctions = [
      'generateSessionId',
      'createChatSession',
      'getChatSessions',
      'deleteSession',
      'saveMessage',
      'getSessionMessages',
      'saveGeneratedImage',
      'getImage',
      'getActiveDocumentsForSession',
      'getAllDocuments',
      'createMemory',
      'deleteMemory',
      'getActiveMemories',
      'trackTokenUsage',
      'saveRagMetric',
      'logError',
    ];
    
    for (const fn of requiredFunctions) {
      expect(typeof (dbRxdb as any)[fn]).toBe('function');
    }
  });
});
