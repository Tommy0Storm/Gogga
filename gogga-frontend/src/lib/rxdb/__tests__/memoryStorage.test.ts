/**
 * Tests for In-Memory Storage
 * Tests fast in-memory storage for ephemeral data
 * 
 * Note: This module was refactored from RxDB to pure JavaScript Maps/localStorage
 * to avoid RxDB's 16-collection limit (COL23) and race conditions (DB8).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Import memory storage functions
import {
  getMemoryDatabase,
  updateActiveSession,
  getActiveSession,
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
  destroyMemoryDatabase,
} from '../memoryStorage';

describe('Memory Storage', () => {
  beforeAll(async () => {
    // Ensure clean state
    await destroyMemoryDatabase();
  });

  afterAll(async () => {
    await destroyMemoryDatabase();
  });

  describe('Database Initialization', () => {
    it('should initialize memory storage', async () => {
      const result = await getMemoryDatabase();
      expect(result).toBeDefined();
      expect(result.initialized).toBe(true);
    });

    it('should return same result on subsequent calls (idempotent)', async () => {
      const result1 = await getMemoryDatabase();
      const result2 = await getMemoryDatabase();
      expect(result1.initialized).toBe(true);
      expect(result2.initialized).toBe(true);
    });
  });

  describe('Active Session', () => {
    it('should update and retrieve active session', async () => {
      await updateActiveSession('test-session-123', {
        isTyping: true,
        currentModel: 'llama-3.3-70b',
        pendingMessages: 2,
      });

      const session = await getActiveSession();
      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe('test-session-123');
      expect(session!.isTyping).toBe(true);
      expect(session!.currentModel).toBe('llama-3.3-70b');
      expect(session!.pendingMessages).toBe(2);
    });

    it('should update existing session', async () => {
      await updateActiveSession('test-session-123', {
        isTyping: false,
        pendingMessages: 0,
      });

      const session = await getActiveSession();
      expect(session).not.toBeNull();
      expect(session!.isTyping).toBe(false);
      expect(session!.pendingMessages).toBe(0);
    });
  });

  describe('Embedding Cache', () => {
    const testText = 'This is a test document about South African law';
    const testEmbedding = new Array(384).fill(0).map((_, i) => Math.sin(i * 0.1)) as number[];

    it('should cache and retrieve embeddings', async () => {
      await cacheEmbedding(testText, testEmbedding);

      const cached = await getCachedEmbedding(testText);
      expect(cached).not.toBeNull();
      expect(cached!.length).toBe(384);
      const firstEmbedding = testEmbedding[0] ?? 0;
      expect(cached![0]).toBeCloseTo(firstEmbedding, 5);
    });

    it('should return null for uncached text', async () => {
      const cached = await getCachedEmbedding('this text was never cached');
      expect(cached).toBeNull();
    });

    it('should track cache statistics', async () => {
      const stats = await getEmbeddingCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(1);
      expect(stats.totalAccesses).toBeGreaterThanOrEqual(1);
    });

    it('should clear cache', async () => {
      const clearedCount = await clearEmbeddingCache();
      expect(clearedCount).toBeGreaterThanOrEqual(1);

      const statsAfter = await getEmbeddingCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('Pending Operations', () => {
    let operationId: string;

    it('should add pending operation', async () => {
      operationId = await addPendingOperation('message', 'create', {
        content: 'Hello, AI!',
        sessionId: 'test-session',
      });

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
    });

    it('should retrieve pending operations', async () => {
      const pending = await getPendingOperations();
      expect(pending.length).toBeGreaterThanOrEqual(1);

      const ourOp = pending.find(op => op.id === operationId);
      expect(ourOp).toBeDefined();
      expect(ourOp!.type).toBe('message');
      expect(ourOp!.operation).toBe('create');
      expect(ourOp!.status).toBe('pending');
    });

    it('should update operation status', async () => {
      await updatePendingOperation(operationId, 'completed');

      // Should no longer be in pending list
      const pending = await getPendingOperations();
      const ourOp = pending.find(op => op.id === operationId);
      expect(ourOp).toBeUndefined();
    });

    it('should cleanup completed operations', async () => {
      // Add and complete an operation
      const id = await addPendingOperation('document', 'update', { docId: '123' });
      await updatePendingOperation(id, 'completed');

      const cleaned = await cleanupPendingOperations();
      expect(cleaned).toBeGreaterThanOrEqual(1);
    });
  });

  describe('App Settings', () => {
    it('should return default settings initially', async () => {
      const settings = await getAppSettings();
      expect(settings).toBeDefined();
      expect(settings.theme).toBe('system');
      expect(settings.fontSize).toBe(16);
      expect(settings.ragMode).toBe('basic');
    });

    it('should update settings', async () => {
      const updated = await updateAppSettings({
        theme: 'dark',
        fontSize: 18,
        ragMode: 'semantic',
      });

      expect(updated.theme).toBe('dark');
      expect(updated.fontSize).toBe(18);
      expect(updated.ragMode).toBe('semantic');
    });

    it('should persist updated settings', async () => {
      const settings = await getAppSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.ragMode).toBe('semantic');
    });
  });
});
