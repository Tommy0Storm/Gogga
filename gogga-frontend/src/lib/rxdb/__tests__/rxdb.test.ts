/**
 * GOGGA RxDB Test Suite
 * Tests database initialization, vector operations, and pipeline
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock IndexedDB for Node.js environment
import 'fake-indexeddb/auto';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Import RxDB modules
import {
  getDatabase,
  generateId,
  generateSessionId,
  getStorageStats,
  clearAllData,
} from '../database';

import {
  getSampleVectors,
  calculateIndexValues,
  storeVectorEmbedding,
  storeVectorEmbeddingsBulk,
  findSimilarVectors,
  getVectorsForDocument,
  deleteVectorsForDocument,
  getVectorStats,
} from '../vectorCollection';

import {
  getPipelineStats,
  clearPipelineProgress,
} from '../embeddingPipeline';

import type { GoggaRxDatabase } from '../schemas';

// Shared database instance for all tests
let db: GoggaRxDatabase;

beforeAll(async () => {
  db = await getDatabase();
}, 30000);

// Note: Don't use afterAll with clearAllData - causes race conditions in vitest

describe('RxDB Database', () => {
  describe('Database Initialization', () => {
    it('should create database instance', () => {
      expect(db).toBeDefined();
      // In test mode, name includes timestamp suffix
      expect(db.name).toMatch(/^goggadb/);
    });

    it('should have all 15 collections', () => {
      expect(db.documents).toBeDefined();
      expect(db.documentChunks).toBeDefined();
      expect(db.chatSessions).toBeDefined();
      expect(db.chatMessages).toBeDefined();
      expect(db.generatedImages).toBeDefined();
      expect(db.userPreferences).toBeDefined();
      expect(db.memoryContexts).toBeDefined();
      expect(db.tokenUsage).toBeDefined();
      expect(db.toolUsage).toBeDefined();
      expect(db.ragMetrics).toBeDefined();
      expect(db.systemLogs).toBeDefined();
      expect(db.vectorEmbeddings).toBeDefined();
      expect(db.offlineQueue).toBeDefined();
      expect(db.goggaSmartSkills).toBeDefined();
      expect(db.iconGenerations).toBeDefined();
    });

    it('should return same instance on subsequent calls', async () => {
      const db2 = await getDatabase();
      expect(db2).toBe(db);
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      // Our ID format: timestamp_random (about 23 chars)
      expect(id1.length).toBeGreaterThan(15);
    });

    it('should generate session IDs with prefix', () => {
      const sessionId = generateSessionId();
      expect(sessionId).toMatch(/^session_/);
    });
  });

  describe('Document Operations', () => {
    const testDocId = generateId();

    it('should insert and retrieve a document', async () => {
      const testDoc = {
        id: testDocId,
        sessionId: 'test-session',
        filename: 'test.pdf',
        content: 'Test document content for embedding',
        chunks: ['chunk1', 'chunk2'],
        chunkCount: 2,
        size: 1024,
        mimeType: 'application/pdf',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // v8 Session-Scoped RAG fields
        userId: 'test-user',
        originSessionId: 'test-session',
        activeSessions: ['test-session'],
        accessCount: 1,
        lastAccessedAt: new Date().toISOString(),
      };

      await db.documents.insert(testDoc);
      
      const retrieved = await db.documents.findOne(testDocId).exec();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.filename).toBe('test.pdf');
    });

    it('should update a document', async () => {
      const doc = await db.documents.findOne(testDocId).exec();
      await doc?.patch({ filename: 'updated.pdf' });
      
      const updated = await db.documents.findOne(testDocId).exec();
      expect(updated?.filename).toBe('updated.pdf');
    });

    it('should delete a document', async () => {
      const doc = await db.documents.findOne(testDocId).exec();
      await doc?.remove();
      
      const deleted = await db.documents.findOne(testDocId).exec();
      expect(deleted).toBeNull();
    });
  });

  describe('Storage Stats', () => {
    it('should return storage statistics', async () => {
      const stats = await getStorageStats();
      
      expect(stats).toHaveProperty('documents');
      expect(stats).toHaveProperty('chunks');
      expect(stats).toHaveProperty('messages');
      expect(stats).toHaveProperty('images');
      expect(stats).toHaveProperty('vectors');
      expect(stats).toHaveProperty('totalMB');
      expect(typeof stats.documents).toBe('number');
    });
  });
});

describe('Vector Collection', () => {
  describe('Sample Vectors', () => {
    it('should generate sample vectors', async () => {
      const samples = await getSampleVectors();
      
      expect(samples).toHaveLength(5);
      expect(samples[0]).toHaveLength(384); // E5 dimension
    });

    it('should return consistent sample vectors', async () => {
      const samples1 = await getSampleVectors();
      const samples2 = await getSampleVectors();
      
      // Same samples should be returned on subsequent calls
      expect(samples1[0]).toEqual(samples2[0]);
    });
  });

  describe('Index Value Calculation', () => {
    it('should calculate index values for an embedding', async () => {
      // Create a random 384-dim embedding
      const embedding = Array.from({ length: 384 }, () => Math.random() - 0.5);
      
      const indexValues = await calculateIndexValues(embedding);
      
      expect(indexValues).toHaveProperty('idx0');
      expect(indexValues).toHaveProperty('idx1');
      expect(indexValues).toHaveProperty('idx2');
      expect(indexValues).toHaveProperty('idx3');
      expect(indexValues).toHaveProperty('idx4');
      
      // Index values should be fixed-length strings
      expect(indexValues.idx0).toHaveLength(10);
    });
  });

  describe('Vector Storage', () => {
    const testEmbedding = Array.from({ length: 384 }, () => Math.random() - 0.5);
    let vectorId: string;

    it('should store a single vector embedding', async () => {
      vectorId = await storeVectorEmbedding(
        'doc-1',
        0,
        'session-1',
        'Test chunk text',
        testEmbedding
      );
      
      expect(vectorId).toBeDefined();
      // Our ID format: timestamp_random (about 23 chars)
      expect(vectorId.length).toBeGreaterThan(15);
    });

    it('should store multiple vectors in bulk', async () => {
      const embeddings = [
        { documentId: 'doc-2', chunkIndex: 0, sessionId: 'session-1', text: 'Chunk 1', embedding: testEmbedding },
        { documentId: 'doc-2', chunkIndex: 1, sessionId: 'session-1', text: 'Chunk 2', embedding: testEmbedding },
      ];
      
      const ids = await storeVectorEmbeddingsBulk(embeddings);
      
      expect(ids).toHaveLength(2);
    });

    it('should retrieve vectors for a document', async () => {
      const vectors = await getVectorsForDocument('doc-2');
      
      expect(vectors).toHaveLength(2);
      expect(vectors[0]?.documentId).toBe('doc-2');
    });

    it('should get vector statistics', async () => {
      const stats = await getVectorStats();
      
      expect(stats.totalVectors).toBeGreaterThanOrEqual(3);
      expect(stats.totalDocuments).toBeGreaterThanOrEqual(2);
    });

    it('should delete vectors for a document', async () => {
      const deleted = await deleteVectorsForDocument('doc-2');
      
      expect(deleted).toBe(2);
      
      const remaining = await getVectorsForDocument('doc-2');
      expect(remaining).toHaveLength(0);
    });
  });

  describe('Similarity Search', () => {
    it('should find similar vectors', async () => {
      // Add test vectors with known patterns
      const baseVector = Array.from({ length: 384 }, (_, i) => i / 384);
      const similarVector = baseVector.map(v => v + 0.01);
      const differentVector = Array.from({ length: 384 }, () => Math.random());
      
      await storeVectorEmbeddingsBulk([
        { documentId: 'similar-doc', chunkIndex: 0, sessionId: 's1', text: 'Similar', embedding: similarVector },
        { documentId: 'different-doc', chunkIndex: 0, sessionId: 's1', text: 'Different', embedding: differentVector },
      ]);

      const queryVector = Array.from({ length: 384 }, (_, i) => i / 384);
      
      const results = await findSimilarVectors(queryVector, 5, undefined, 0.1);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

describe('Embedding Pipeline', () => {
  describe('Pipeline Stats', () => {
    it('should return pipeline statistics', () => {
      const stats = getPipelineStats();
      
      expect(stats).toHaveProperty('isRunning');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('errors');
    });
  });

  describe('Progress Tracking', () => {
    it('should clear pipeline progress', () => {
      clearPipelineProgress();
      
      const stats = getPipelineStats();
      expect(stats.completed).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });
});

describe('Chat Session Operations', () => {
  it('should create and query chat sessions', async () => {
    const session = {
      id: generateId(),
      tier: 'jigga' as const,
      title: 'Test Session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    };
    
    await db.chatSessions.insert(session);
    
    const retrieved = await db.chatSessions.findOne(session.id).exec();
    expect(retrieved?.title).toBe('Test Session');
  });

  it('should update session message count', async () => {
    const sessions = await db.chatSessions.find().exec();
    const session = sessions[0];
    
    if (session) {
      await session.patch({ messageCount: 5 });
      
      const updated = await db.chatSessions.findOne(session.id).exec();
      expect(updated?.messageCount).toBe(5);
    }
  });
});

describe('Offline Queue', () => {
  it('should add items to offline queue', async () => {
    const queueItem = {
      id: generateId(),
      type: 'message' as const,
      payload: { sessionId: 'offline-session', content: 'Offline message', role: 'user' },
      status: 'pending' as const,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    
    await db.offlineQueue.insert(queueItem);
    
    const pending = await db.offlineQueue.find({
      selector: { status: 'pending' }
    }).exec();
    
    expect(pending.length).toBeGreaterThan(0);
  });

  it('should update queue item status', async () => {
    const items = await db.offlineQueue.find().exec();
    const item = items[0];
    
    if (item) {
      await item.patch({ status: 'sending' });
      
      const updated = await db.offlineQueue.findOne(item.id).exec();
      expect(updated?.status).toBe('sending');
    }
  });
});
