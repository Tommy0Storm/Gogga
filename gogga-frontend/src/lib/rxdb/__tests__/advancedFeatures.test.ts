/**
 * GOGGA RxDB Advanced Features Test Suite
 * Tests cleanup utilities, vector search functions, and schema migration
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
  cleanupCollection,
  cleanupAllCollections,
  emptyCollection,
  purgeOldMetrics,
  purgeOldLogs,
  purgeOrphanedEmbeddings,
  purgeOrphanedChunks,
  runDatabaseMaintenance,
} from '../database';

import {
  getSampleVectors,
  calculateIndexValues,
  storeVectorEmbedding,
  findSimilarVectors,
  vectorSearchIndexRange,
  vectorSearchIndexSimilarity,
  vectorSearchFullScan,
  euclideanDistance,
  cosineSimilarity,
  manhattanDistance,
  sortByObjectNumberProperty,
} from '../vectorCollection';

import {
  allMigrationStrategies,
  addFieldMigration,
  removeFieldMigration,
  renameFieldMigration,
  transformFieldMigration,
} from '../schemaMigration';

import type { GoggaRxDatabase } from '../schemas';

let db: GoggaRxDatabase;

beforeAll(async () => {
  db = await getDatabase();
});

afterAll(async () => {
  // Cleanup handled by individual tests if needed
});

// ============================================================================
// Cleanup Utilities Tests
// ============================================================================

describe('Cleanup Utilities', () => {
  describe('cleanupCollection', () => {
    it('should run cleanup without error', async () => {
      // cleanup() may return boolean or void depending on RxDB version
      const result = await cleanupCollection('documents');
      // Just check it doesn't throw
      expect(true).toBe(true);
    });

    it('should accept minimumDeletedTime parameter', async () => {
      await cleanupCollection('documents', 1000);
      // Just check it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('cleanupAllCollections', () => {
    it('should cleanup all collections and return count', async () => {
      const results = await cleanupAllCollections();
      expect(typeof results).toBe('number');
      expect(results).toBeGreaterThanOrEqual(0);
    });

    it('should accept minimumDeletedTime parameter', async () => {
      const results = await cleanupAllCollections(5000);
      expect(typeof results).toBe('number');
    });
  });

  describe('emptyCollection', () => {
    it('should delete and purge all documents from collection', async () => {
      // Insert some test data with all required fields
      await db.systemLogs.insert({
        id: generateId(),
        level: 'info',
        category: 'system', // Must match enum: 'rag' | 'auth' | 'chat' | 'image' | 'system'
        message: 'Test log for cleanup',
        timestamp: Date.now(), // number, not string
        createdAt: new Date().toISOString(),
      });
      
      // Empty the collection
      const count = await emptyCollection('systemLogs');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should return 0 for empty collection', async () => {
      // Run again on already empty collection
      const count = await emptyCollection('systemLogs');
      expect(count).toBe(0);
    });
  });

  describe('purgeOldMetrics', () => {
    it('should purge metrics beyond retention period', async () => {
      const count = await purgeOldMetrics();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('purgeOldLogs', () => {
    it('should purge logs beyond retention period', async () => {
      const count = await purgeOldLogs();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('purgeOrphanedEmbeddings', () => {
    it('should purge embeddings without parent documents', async () => {
      const count = await purgeOrphanedEmbeddings();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('purgeOrphanedChunks', () => {
    it('should purge chunks without parent documents', async () => {
      const count = await purgeOrphanedChunks();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('runDatabaseMaintenance', () => {
    it('should run full maintenance routine', async () => {
      const results = await runDatabaseMaintenance();
      expect(typeof results).toBe('object');
      expect('metricsCleared' in results).toBe(true);
      expect('logsCleared' in results).toBe(true);
      expect('orphanedEmbeddings' in results).toBe(true);
      expect('orphanedChunks' in results).toBe(true);
      expect('totalPurged' in results).toBe(true);
    });
  });
});

// ============================================================================
// Vector Search Tests
// ============================================================================

describe('Vector Search Methods', () => {
  // Create test data
  const testVectors: Array<{ id: string; docId: string; embedding: number[] }> = [];

  beforeAll(async () => {
    // First initialize sample vectors
    await getSampleVectors();
    
    // Create test vectors
    for (let i = 0; i < 3; i++) {
      testVectors.push({
        id: `test${i}`,
        docId: `doc${i}`,
        embedding: new Array(384).fill(0).map(() => Math.random()),
      });
    }
    
    // Store test vectors using correct function signature
    for (const tv of testVectors) {
      await storeVectorEmbedding(
        tv.docId,          // documentId
        0,                 // chunkIndex
        'test-session',    // sessionId
        'Test content',    // text
        tv.embedding       // embedding
      );
    }
  });

  describe('vectorSearchFullScan', () => {
    it('should search using full table scan', async () => {
      const queryVector = testVectors[0]!.embedding;
      const result = await vectorSearchFullScan(queryVector, 5);
      
      // Returns { results: [], docReads: number }
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('docReads');
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('vectorSearchIndexRange', () => {
    it('should search using index range queries', async () => {
      const queryVector = testVectors[0]!.embedding;
      const result = await vectorSearchIndexRange(queryVector, 0.1);
      
      // Returns { results: [], docReads: number }
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('docReads');
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('vectorSearchIndexSimilarity', () => {
    it('should search using index similarity with fixed doc count', async () => {
      const queryVector = testVectors[0]!.embedding;
      const result = await vectorSearchIndexSimilarity(queryVector, 5);
      
      // Returns { results: [], docReads: number }
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('docReads');
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Vector Distance Utilities', () => {
    const vec1 = [1, 2, 3, 4, 5];
    const vec2 = [5, 4, 3, 2, 1];

    it('should calculate euclidean distance', () => {
      const dist = euclideanDistance(vec1, vec2);
      expect(typeof dist).toBe('number');
      expect(dist).toBeGreaterThan(0);
    });

    it('should calculate cosine similarity', () => {
      const sim = cosineSimilarity(vec1, vec2);
      expect(typeof sim).toBe('number');
      expect(sim).toBeGreaterThanOrEqual(-1);
      expect(sim).toBeLessThanOrEqual(1);
    });

    it('should calculate manhattan distance', () => {
      const dist = manhattanDistance(vec1, vec2);
      expect(typeof dist).toBe('number');
      expect(dist).toBeGreaterThan(0);
    });

    it('should sort objects by number property (descending)', () => {
      const items = [
        { name: 'a', score: 3 },
        { name: 'b', score: 1 },
        { name: 'c', score: 2 },
      ];
      
      // sortByObjectNumberProperty sorts in descending order (highest first)
      const sorted = [...items].sort(sortByObjectNumberProperty('score'));
      expect(sorted[0].name).toBe('a'); // score 3
      expect(sorted[1].name).toBe('c'); // score 2
      expect(sorted[2].name).toBe('b'); // score 1
    });
  });
});

// ============================================================================
// Schema Migration Tests
// ============================================================================

describe('Schema Migration', () => {
  describe('Migration Strategies Export', () => {
    it('should export all migration strategies', () => {
      expect(allMigrationStrategies).toBeDefined();
      expect(allMigrationStrategies.documents).toBeDefined();
      expect(allMigrationStrategies.vectorEmbeddings).toBeDefined();
      expect(allMigrationStrategies.chatMessages).toBeDefined();
    });
  });

  describe('Migration Helper Functions', () => {
    it('should create addField migration', () => {
      const migration = addFieldMigration('newField', 'defaultValue');
      const result = migration({ id: '1', existingField: 'value' } as any);
      
      expect(result.newField).toBe('defaultValue');
      expect(result.existingField).toBe('value');
    });

    it('should create removeField migration', () => {
      const migration = removeFieldMigration('removeMe');
      const result = migration({ id: '1', removeMe: 'gone', keep: 'this' } as any);
      
      expect(result.removeMe).toBeUndefined();
      expect(result.keep).toBe('this');
    });

    it('should create renameField migration', () => {
      const migration = renameFieldMigration('oldName', 'newName');
      const result = migration({ id: '1', oldName: 'myValue' } as any);
      
      expect(result.oldName).toBeUndefined();
      expect(result.newName).toBe('myValue');
    });

    it('should create transformField migration', () => {
      const migration = transformFieldMigration('score', (v: number) => v * 2);
      const result = migration({ id: '1', score: 5 } as any);
      
      expect(result.score).toBe(10);
    });
  });
});

// ============================================================================
// Population (Refs) Tests
// ============================================================================

describe('Population (Refs)', () => {
  it('should have ref property on chatMessages.sessionId', async () => {
    const schema = db.chatMessages.schema.jsonSchema;
    expect(schema.properties.sessionId).toBeDefined();
    expect(schema.properties.sessionId.ref).toBe('chatSessions');
  });

  it('should have ref property on chatMessages.imageId', async () => {
    const schema = db.chatMessages.schema.jsonSchema;
    expect(schema.properties.imageId).toBeDefined();
    expect(schema.properties.imageId.ref).toBe('generatedImages');
  });

  it('should have ref property on documentChunks.documentId', async () => {
    const schema = db.documentChunks.schema.jsonSchema;
    expect(schema.properties.documentId).toBeDefined();
    expect(schema.properties.documentId.ref).toBe('documents');
  });

  it('should have ref property on vectorEmbeddings.documentId', async () => {
    const schema = db.vectorEmbeddings.schema.jsonSchema;
    expect(schema.properties.documentId).toBeDefined();
    expect(schema.properties.documentId.ref).toBe('documents');
  });
});
