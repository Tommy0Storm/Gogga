# RAG System Comprehensive Test Plan

> **Version**: 2.0  
> **Date**: December 2025  
> **Status**: Post-Enterprise Audit  
> **Related**: `RAG_PERFORMANCE_ANALYSIS.md`, `SESSION_SCOPED_RAG_TEST_PLAN.md`

## Executive Summary

This test plan covers the RAG (Retrieval-Augmented Generation) system after the December 2025 enterprise audit. All tests validate the 9 critical fixes implemented during the audit, focusing on performance, reliability, and browser stability.

### Test Categories

| Category | Tests | Priority | Status |
|----------|-------|----------|--------|
| Unit Tests | 45+ | P0-P1 | 🔄 In Progress |
| Integration Tests | 20+ | P0-P1 | 🔄 In Progress |
| Performance Tests | 15+ | P1 | 📋 Planned |
| E2E Tests | 10+ | P2 | 📋 Planned |
| Stress Tests | 5+ | P2 | 📋 Planned |

---

## 1. Unit Tests

### 1.1 PDF Extraction (`lib/rag.ts`)

**Fix Validated**: #1 - PDF extraction with proper errors

```typescript
// File: tests/unit/rag.test.ts

describe('PDF Text Extraction', () => {
  describe('isValidExtractedText', () => {
    it('should reject empty strings', () => {
      expect(isValidExtractedText('')).toBe(false);
    });

    it('should reject whitespace-only strings', () => {
      expect(isValidExtractedText('   \n\t  ')).toBe(false);
    });

    it('should reject high non-printable ratio (>30%)', () => {
      const gibberish = '\x00\x01\x02abc\x03\x04\x05';
      expect(isValidExtractedText(gibberish)).toBe(false);
    });

    it('should accept valid English text', () => {
      expect(isValidExtractedText('This is a valid document with proper text.')).toBe(true);
    });

    it('should accept valid African language text', () => {
      // Zulu text
      expect(isValidExtractedText('Sawubona, ngiyakwemukela')).toBe(true);
      // Xhosa text
      expect(isValidExtractedText('Molo, ndiyakwamkela')).toBe(true);
    });

    it('should accept text with some special characters', () => {
      expect(isValidExtractedText('Price: R1,500.00 (incl. VAT)')).toBe(true);
    });

    it('should reject scanned PDF gibberish', () => {
      const scannedGibberish = 'ÿþ□□□□JFIF□□□□□□';
      expect(isValidExtractedText(scannedGibberish)).toBe(false);
    });
  });

  describe('extractPDFText', () => {
    it('should throw RAGExtractionError for invalid PDF', async () => {
      const invalidPdf = new Uint8Array([0, 1, 2, 3]);
      await expect(extractPDFText(invalidPdf)).rejects.toThrow(RAGExtractionError);
    });

    it('should throw RAGExtractionError for scanned PDF without OCR', async () => {
      // Mock a PDF that returns gibberish
      const scannedPdf = await loadTestFile('scanned-no-text.pdf');
      await expect(extractPDFText(scannedPdf)).rejects.toThrow(RAGExtractionError);
      await expect(extractPDFText(scannedPdf)).rejects.toThrow(/gibberish/i);
    });

    it('should successfully extract from valid PDF', async () => {
      const validPdf = await loadTestFile('valid-document.pdf');
      const text = await extractPDFText(validPdf);
      expect(text.length).toBeGreaterThan(100);
      expect(text).toContain('expected content');
    });
  });
});
```

### 1.2 Database Queries (`lib/db.ts`)

**Fix Validated**: #2 - Replace full collection scans with indexed queries

```typescript
// File: tests/unit/db.test.ts

describe('Database Indexed Queries', () => {
  let testDb: RxDatabase;
  
  beforeEach(async () => {
    testDb = await createTestDatabase();
    // Seed with 1000 documents
    await seedTestDocuments(testDb, 1000);
  });

  afterEach(async () => {
    await testDb.remove();
  });

  describe('getActiveDocumentsForSession', () => {
    it('should use indexed $or query instead of full scan', async () => {
      const spy = jest.spyOn(testDb.ragDocuments, 'find');
      
      await getActiveDocumentsForSession('session-123');
      
      expect(spy).toHaveBeenCalledWith({
        selector: expect.objectContaining({
          $or: expect.arrayContaining([
            { sessionId: 'session-123', isActive: true },
            { isGlobal: true, isActive: true }
          ])
        })
      });
    });

    it('should complete in <50ms for 1000 documents', async () => {
      const start = performance.now();
      await getActiveDocumentsForSession('session-123');
      const elapsed = performance.now() - start;
      
      expect(elapsed).toBeLessThan(50);
    });

    it('should return session-specific and global documents', async () => {
      // Create session-specific doc
      await testDb.ragDocuments.insert({
        id: generateId(),
        sessionId: 'session-123',
        isGlobal: false,
        isActive: true,
        // ...
      });
      
      // Create global doc
      await testDb.ragDocuments.insert({
        id: generateId(),
        sessionId: 'other-session',
        isGlobal: true,
        isActive: true,
        // ...
      });
      
      const docs = await getActiveDocumentsForSession('session-123');
      expect(docs.length).toBe(2);
    });
  });
});
```

### 1.3 Three-Tier Cache (`lib/ragManager.ts`)

**Fix Validated**: #3 - Persist embeddings to RxDB

```typescript
// File: tests/unit/ragManager.test.ts

describe('RAG Manager Three-Tier Cache', () => {
  let ragManager: RAGManager;
  
  beforeEach(() => {
    ragManager = new RAGManager();
    // Clear all caches
    ragManager.clearCache();
  });

  describe('Tier 1: Memory Cache', () => {
    it('should return from memory cache on second access', async () => {
      const docId = 'doc-123';
      const chunks = ['chunk1', 'chunk2'];
      
      // First access - generates embeddings
      const embeddings1 = await ragManager.getEmbeddings(docId, chunks);
      
      // Mock to verify no regeneration
      const generateSpy = jest.spyOn(ragManager, 'generateEmbeddings');
      
      // Second access - from memory
      const embeddings2 = await ragManager.getEmbeddings(docId, chunks);
      
      expect(generateSpy).not.toHaveBeenCalled();
      expect(embeddings1).toEqual(embeddings2);
    });

    it('should evict LRU entries when cache exceeds 500 items', async () => {
      // Fill cache with 500 items
      for (let i = 0; i < 500; i++) {
        await ragManager.getEmbeddings(`doc-${i}`, [`chunk-${i}`]);
      }
      
      // Access doc-0 to make it recently used
      await ragManager.getEmbeddings('doc-0', ['chunk-0']);
      
      // Add one more (should evict doc-1)
      await ragManager.getEmbeddings('doc-500', ['chunk-500']);
      
      // Verify doc-1 was evicted (will require regeneration)
      const generateSpy = jest.spyOn(ragManager, 'generateEmbeddings');
      await ragManager.getEmbeddings('doc-1', ['chunk-1']);
      expect(generateSpy).toHaveBeenCalled();
    });
  });

  describe('Tier 2: RxDB Cache', () => {
    it('should persist embeddings to RxDB on generation', async () => {
      const docId = 'doc-persist-test';
      const chunks = ['test chunk'];
      
      await ragManager.getEmbeddings(docId, chunks);
      
      // Verify RxDB has the embeddings
      const stored = await hasVectorsForDocument(docId);
      expect(stored).toBe(true);
    });

    it('should load from RxDB when memory cache is empty', async () => {
      const docId = 'doc-rxdb-test';
      const chunks = ['test chunk'];
      
      // Generate and persist
      const embeddings1 = await ragManager.getEmbeddings(docId, chunks);
      
      // Clear memory cache only
      ragManager.clearMemoryCache();
      
      // Should load from RxDB without regenerating
      const generateSpy = jest.spyOn(ragManager, 'generateEmbeddings');
      const embeddings2 = await ragManager.getEmbeddings(docId, chunks);
      
      expect(generateSpy).not.toHaveBeenCalled();
      expect(embeddings1).toEqual(embeddings2);
    });
  });

  describe('Tier 3: Generation + Persist', () => {
    it('should generate and persist when not in any cache', async () => {
      const docId = 'doc-new';
      const chunks = ['brand new chunk'];
      
      const embeddings = await ragManager.getEmbeddings(docId, chunks);
      
      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(384); // E5-small dimension
      
      // Verify persisted
      const stored = await getVectorsForDocument(docId);
      expect(stored.length).toBe(1);
    });
  });
});
```

### 1.4 Debounced State Sync (`lib/documentStore.ts`)

**Fix Validated**: #4 - Debounce document store updates

```typescript
// File: tests/unit/documentStore.test.ts

describe('Document Store Debouncing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('setDocuments', () => {
    it('should debounce rapid updates to 50ms', () => {
      const store = useDocumentStore.getState();
      const updateSpy = jest.spyOn(store, 'actuallySetDocuments');
      
      // Rapid fire 10 updates
      for (let i = 0; i < 10; i++) {
        store.setDocuments([{ id: `doc-${i}` }]);
      }
      
      // Before debounce timeout
      expect(updateSpy).not.toHaveBeenCalled();
      
      // After 50ms
      jest.advanceTimersByTime(50);
      
      // Should only have been called once
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith([{ id: 'doc-9' }]); // Last update wins
    });

    it('should use shallow comparison to skip identical updates', () => {
      const store = useDocumentStore.getState();
      const docs = [{ id: 'doc-1', name: 'Test' }];
      
      // Initial set
      store.setDocuments(docs);
      jest.advanceTimersByTime(50);
      
      // Set same docs again
      const renderSpy = jest.fn();
      useDocumentStore.subscribe(renderSpy);
      
      store.setDocuments(docs);
      jest.advanceTimersByTime(50);
      
      // Should not trigger re-render
      expect(renderSpy).not.toHaveBeenCalled();
    });
  });

  describe('documentsEqual', () => {
    it('should detect equal document arrays', () => {
      const docs1 = [
        { id: '1', name: 'Doc 1', isActive: true },
        { id: '2', name: 'Doc 2', isActive: false }
      ];
      const docs2 = [...docs1];
      
      expect(documentsEqual(docs1, docs2)).toBe(true);
    });

    it('should detect different lengths', () => {
      const docs1 = [{ id: '1' }];
      const docs2 = [{ id: '1' }, { id: '2' }];
      
      expect(documentsEqual(docs1, docs2)).toBe(false);
    });

    it('should detect changed properties', () => {
      const docs1 = [{ id: '1', isActive: true }];
      const docs2 = [{ id: '1', isActive: false }];
      
      expect(documentsEqual(docs1, docs2)).toBe(false);
    });
  });
});
```

### 1.5 Parallel Embedding (`lib/embeddingEngine.ts`)

**Fix Validated**: #5 - Integrate Web Workers for parallel embedding

```typescript
// File: tests/unit/embeddingEngine.test.ts

describe('Embedding Engine', () => {
  describe('embedTextsParallel', () => {
    it('should use Web Workers when available', async () => {
      const workerSpy = jest.spyOn(ParallelEmbeddingManager.prototype, 'generateParallelEmbeddings');
      
      const texts = ['text1', 'text2', 'text3', 'text4'];
      await embedTextsParallel(texts);
      
      expect(workerSpy).toHaveBeenCalledWith(texts);
    });

    it('should fall back to sequential when workers unavailable', async () => {
      // Mock Worker as undefined
      const originalWorker = global.Worker;
      delete (global as any).Worker;
      
      const sequentialSpy = jest.spyOn(EmbeddingEngine, 'embedTexts');
      
      const texts = ['text1', 'text2'];
      await embedTextsParallel(texts);
      
      expect(sequentialSpy).toHaveBeenCalled();
      
      global.Worker = originalWorker;
    });

    it('should handle empty text array', async () => {
      const result = await embedTextsParallel([]);
      expect(result).toEqual([]);
    });

    it('should produce 384-dimension embeddings', async () => {
      const result = await embedTextsParallel(['test text']);
      expect(result.length).toBe(1);
      expect(result[0].length).toBe(384);
    });
  });

  describe('Backend Auto-Detection', () => {
    it('should prefer WebGPU when available', async () => {
      // Mock WebGPU
      (navigator as any).gpu = { requestAdapter: jest.fn() };
      
      const engine = new EmbeddingEngine();
      await engine.initialize();
      
      expect(engine.backend).toBe('webgpu');
    });

    it('should fall back to WASM when WebGPU unavailable', async () => {
      delete (navigator as any).gpu;
      
      const engine = new EmbeddingEngine();
      await engine.initialize();
      
      expect(engine.backend).toBe('wasm');
    });
  });
});
```

### 1.6 Main Thread Yields (`lib/rxdb/embeddingPipeline.ts`)

**Fix Validated**: #7 - Longer batch yields (100ms)

```typescript
// File: tests/unit/embeddingPipeline.test.ts

describe('Embedding Pipeline Yields', () => {
  describe('requestIdlePromise', () => {
    it('should yield using requestIdleCallback when available', async () => {
      const idleSpy = jest.spyOn(window, 'requestIdleCallback');
      
      await requestIdlePromise(100);
      
      expect(idleSpy).toHaveBeenCalledWith(expect.any(Function), { timeout: 100 });
    });

    it('should fall back to setTimeout when requestIdleCallback unavailable', async () => {
      const originalRIC = window.requestIdleCallback;
      delete (window as any).requestIdleCallback;
      
      const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
      
      await requestIdlePromise(100);
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
      
      window.requestIdleCallback = originalRIC;
    });
  });

  describe('processBatchWithYield', () => {
    it('should yield every 100ms to prevent UI freeze', async () => {
      const yieldSpy = jest.spyOn(global, 'requestIdlePromise');
      
      // Process 100 items (should yield multiple times)
      const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      await processBatchWithYield(items, async (item) => item.toUpperCase());
      
      // Should have yielded at least once
      expect(yieldSpy).toHaveBeenCalled();
    });

    it('should not block UI during heavy processing', async () => {
      const frameDrops: number[] = [];
      let lastFrame = performance.now();
      
      // Monitor frame drops
      const rafLoop = () => {
        const now = performance.now();
        const delta = now - lastFrame;
        if (delta > 50) frameDrops.push(delta); // >50ms = dropped frame
        lastFrame = now;
        if (frameDrops.length < 100) requestAnimationFrame(rafLoop);
      };
      requestAnimationFrame(rafLoop);
      
      // Heavy processing
      const items = Array.from({ length: 50 }, (_, i) => `item-${i}`);
      await processBatchWithYield(items, async (item) => {
        // Simulate heavy work
        const arr = new Float32Array(384);
        for (let i = 0; i < arr.length; i++) arr[i] = Math.random();
        return arr;
      });
      
      // Should have minimal frame drops
      const severeDrops = frameDrops.filter(d => d > 100);
      expect(severeDrops.length).toBeLessThan(3);
    });
  });
});
```

---

## 2. Integration Tests

### 2.1 Vector Collection Integration

**Fix Validated**: #3 - RxDB persistence with Distance-to-Samples indexing

```typescript
// File: tests/integration/vectorCollection.test.ts

describe('Vector Collection Integration', () => {
  let db: RxDatabase;

  beforeAll(async () => {
    db = await initDB();
  });

  afterAll(async () => {
    await db.remove();
  });

  describe('storeVectorEmbeddingsBulk', () => {
    it('should store embeddings with Distance-to-Samples indices', async () => {
      const docId = 'integration-doc-1';
      const embeddings = [
        { chunkIndex: 0, embedding: new Float32Array(384).fill(0.5) },
        { chunkIndex: 1, embedding: new Float32Array(384).fill(0.3) }
      ];

      await storeVectorEmbeddingsBulk(docId, embeddings);

      const stored = await db.vectorEmbeddings.find({
        selector: { documentId: docId }
      }).exec();

      expect(stored.length).toBe(2);
      expect(stored[0].idx0).toBeDefined();
      expect(stored[0].idx1).toBeDefined();
      expect(stored[0].idx2).toBeDefined();
      expect(stored[0].idx3).toBeDefined();
      expect(stored[0].idx4).toBeDefined();
    });

    it('should handle 500+ embeddings in single transaction', async () => {
      const docId = 'bulk-test-doc';
      const embeddings = Array.from({ length: 500 }, (_, i) => ({
        chunkIndex: i,
        embedding: new Float32Array(384).fill(i / 500)
      }));

      const start = performance.now();
      await storeVectorEmbeddingsBulk(docId, embeddings);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5000); // <5s for 500 embeddings
      
      const count = await db.vectorEmbeddings.count({
        selector: { documentId: docId }
      }).exec();
      expect(count).toBe(500);
    });
  });

  describe('vectorSearchIndexSimilarity', () => {
    beforeEach(async () => {
      // Seed test embeddings
      await storeVectorEmbeddingsBulk('search-test', [
        { chunkIndex: 0, embedding: createTestEmbedding('legal contract') },
        { chunkIndex: 1, embedding: createTestEmbedding('software development') },
        { chunkIndex: 2, embedding: createTestEmbedding('POPIA compliance') }
      ]);
    });

    it('should return ranked results by similarity', async () => {
      const queryEmbedding = createTestEmbedding('data protection law');
      
      const results = await vectorSearchIndexSimilarity(queryEmbedding, 3);
      
      expect(results.length).toBe(3);
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
      expect(results[1].similarity).toBeGreaterThan(results[2].similarity);
    });

    it('should use Distance-to-Samples index for 8.7x speedup', async () => {
      // Add 1000 vectors
      const bulkEmbeddings = Array.from({ length: 1000 }, (_, i) => ({
        chunkIndex: i,
        embedding: new Float32Array(384).fill(i / 1000)
      }));
      await storeVectorEmbeddingsBulk('perf-test', bulkEmbeddings);

      const queryEmbedding = new Float32Array(384).fill(0.5);
      
      const start = performance.now();
      await vectorSearchIndexSimilarity(queryEmbedding, 10);
      const elapsed = performance.now() - start;

      // Should complete in <100ms for 1000 vectors
      expect(elapsed).toBeLessThan(100);
    });
  });
});
```

### 2.2 RAG Manager + Document Store Integration

```typescript
// File: tests/integration/ragWorkflow.test.ts

describe('RAG Workflow Integration', () => {
  describe('Document Upload → Embedding → Search', () => {
    it('should complete full workflow without memory leaks', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize;
      
      // Upload document
      const docId = await uploadDocument({
        name: 'test-contract.pdf',
        content: await loadTestFile('sample-contract.pdf'),
        sessionId: 'test-session'
      });
      
      // Wait for embedding (simulated)
      await waitForEmbeddings(docId);
      
      // Search
      const results = await ragSearch('What are the contract terms?', 'test-session');
      
      expect(results.length).toBeGreaterThan(0);
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be <50MB
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle concurrent document uploads', async () => {
      const uploadPromises = Array.from({ length: 5 }, (_, i) =>
        uploadDocument({
          name: `concurrent-doc-${i}.txt`,
          content: `Content for document ${i}`,
          sessionId: 'concurrent-session'
        })
      );
      
      const docIds = await Promise.all(uploadPromises);
      
      expect(docIds.length).toBe(5);
      expect(new Set(docIds).size).toBe(5); // All unique
    });
  });

  describe('Session Isolation', () => {
    it('should only return documents for active session', async () => {
      // Upload to session A
      await uploadDocument({
        name: 'session-a-doc.txt',
        content: 'Secret content for session A',
        sessionId: 'session-a'
      });
      
      // Upload to session B
      await uploadDocument({
        name: 'session-b-doc.txt',
        content: 'Secret content for session B',
        sessionId: 'session-b'
      });
      
      // Search from session A
      const results = await ragSearch('Secret content', 'session-a');
      
      // Should only find session A's document
      expect(results.every(r => r.sessionId === 'session-a' || r.isGlobal)).toBe(true);
    });
  });
});
```

---

## 3. Performance Tests

### 3.1 Benchmark Suite

```typescript
// File: tests/performance/benchmarks.test.ts

describe('RAG Performance Benchmarks', () => {
  const BENCHMARK_ITERATIONS = 100;

  describe('Embedding Generation', () => {
    it('should generate 100 embeddings in <10s (sequential)', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `Benchmark text ${i}`);
      
      const start = performance.now();
      for (const text of texts) {
        await embedText(text);
      }
      const elapsed = performance.now() - start;
      
      console.log(`Sequential 100 embeddings: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(10000);
    });

    it('should generate 100 embeddings in <3s (parallel with workers)', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `Benchmark text ${i}`);
      
      const start = performance.now();
      await embedTextsParallel(texts);
      const elapsed = performance.now() - start;
      
      console.log(`Parallel 100 embeddings: ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(3000);
    });
  });

  describe('Vector Search', () => {
    beforeAll(async () => {
      // Seed 10,000 vectors
      const embeddings = Array.from({ length: 10000 }, (_, i) => ({
        chunkIndex: i,
        embedding: new Float32Array(384).fill(Math.random())
      }));
      await storeVectorEmbeddingsBulk('benchmark-doc', embeddings);
    });

    it('should search 10,000 vectors in <200ms', async () => {
      const queryEmbedding = new Float32Array(384).fill(0.5);
      
      const times: number[] = [];
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const start = performance.now();
        await vectorSearchIndexSimilarity(queryEmbedding, 10);
        times.push(performance.now() - start);
      }
      
      const avg = times.reduce((a, b) => a + b) / times.length;
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      
      console.log(`Vector search (10k): avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(200);
    });
  });

  describe('RxDB Query Performance', () => {
    beforeAll(async () => {
      // Seed 1000 documents
      await seedTestDocuments(1000);
    });

    it('should query active documents in <50ms', async () => {
      const times: number[] = [];
      
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const start = performance.now();
        await getActiveDocumentsForSession(`session-${i % 10}`);
        times.push(performance.now() - start);
      }
      
      const avg = times.reduce((a, b) => a + b) / times.length;
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      
      console.log(`Document query: avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(50);
    });
  });
});
```

### 3.2 Memory Leak Tests

```typescript
// File: tests/performance/memoryLeaks.test.ts

describe('Memory Leak Detection', () => {
  it('should not leak memory during repeated embedding operations', async () => {
    const memorySnapshots: number[] = [];
    
    for (let cycle = 0; cycle < 10; cycle++) {
      // Generate embeddings
      const texts = Array.from({ length: 50 }, (_, i) => `Cycle ${cycle} text ${i}`);
      await embedTextsParallel(texts);
      
      // Force GC if available
      if ((global as any).gc) (global as any).gc();
      
      await new Promise(r => setTimeout(r, 100));
      
      const memory = (performance as any).memory?.usedJSHeapSize || 0;
      memorySnapshots.push(memory);
    }
    
    // Memory should stabilize, not continuously grow
    const firstHalfAvg = memorySnapshots.slice(0, 5).reduce((a, b) => a + b) / 5;
    const secondHalfAvg = memorySnapshots.slice(5).reduce((a, b) => a + b) / 5;
    
    // Growth should be <20%
    const growthRatio = secondHalfAvg / firstHalfAvg;
    expect(growthRatio).toBeLessThan(1.2);
  });

  it('should not leak subscriptions during store updates', async () => {
    const store = useDocumentStore.getState();
    const initialSubscribers = store.getSubscriberCount();
    
    // Simulate 100 component mounts/unmounts
    for (let i = 0; i < 100; i++) {
      const unsubscribe = store.subscribe(() => {});
      unsubscribe();
    }
    
    const finalSubscribers = store.getSubscriberCount();
    expect(finalSubscribers).toBe(initialSubscribers);
  });
});
```

---

## 4. End-to-End Tests

### 4.1 Full User Journey

```typescript
// File: tests/e2e/ragUserJourney.test.ts

describe('RAG User Journey E2E', () => {
  let page: Page;

  beforeAll(async () => {
    page = await browser.newPage();
    await page.goto('https://localhost:3000');
    await login(page);
  });

  afterAll(async () => {
    await page.close();
  });

  it('should upload PDF and search successfully', async () => {
    // Navigate to chat
    await page.click('[data-testid="new-chat"]');
    
    // Open RAG panel
    await page.click('[data-testid="rag-toggle"]');
    
    // Upload PDF
    const fileInput = await page.$('input[type="file"]');
    await fileInput?.uploadFile('tests/fixtures/sample-contract.pdf');
    
    // Wait for processing
    await page.waitForSelector('[data-testid="document-ready"]', { timeout: 30000 });
    
    // Send query
    await page.type('[data-testid="chat-input"]', 'What is the termination clause?');
    await page.click('[data-testid="send-button"]');
    
    // Wait for response
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });
    
    // Verify RAG was used
    const response = await page.$eval('[data-testid="assistant-message"]', el => el.textContent);
    expect(response).toContain('termination');
  });

  it('should not freeze browser during large document upload', async () => {
    // Monitor for freezes
    let froze = false;
    const freezeChecker = setInterval(() => {
      // If this runs, browser didn't freeze
    }, 100);
    
    const freezeTimeout = setTimeout(() => {
      froze = true;
    }, 5000);
    
    // Upload large document
    const fileInput = await page.$('input[type="file"]');
    await fileInput?.uploadFile('tests/fixtures/large-document-50pages.pdf');
    
    // Wait for completion
    await page.waitForSelector('[data-testid="document-ready"]', { timeout: 60000 });
    
    clearInterval(freezeChecker);
    clearTimeout(freezeTimeout);
    
    expect(froze).toBe(false);
  });
});
```

---

## 5. Stress Tests

### 5.1 Concurrent Load

```typescript
// File: tests/stress/concurrentLoad.test.ts

describe('RAG Stress Tests', () => {
  it('should handle 50 concurrent searches', async () => {
    const searchPromises = Array.from({ length: 50 }, (_, i) =>
      ragSearch(`Query number ${i}`, `session-${i % 5}`)
    );
    
    const start = performance.now();
    const results = await Promise.all(searchPromises);
    const elapsed = performance.now() - start;
    
    console.log(`50 concurrent searches: ${elapsed.toFixed(2)}ms`);
    
    expect(results.every(r => Array.isArray(r))).toBe(true);
    expect(elapsed).toBeLessThan(10000); // <10s for all
  });

  it('should handle 100 documents in single session', async () => {
    const sessionId = 'stress-session';
    
    // Upload 100 documents
    for (let i = 0; i < 100; i++) {
      await uploadDocument({
        name: `stress-doc-${i}.txt`,
        content: `Content for stress document ${i}. This includes various topics.`,
        sessionId
      });
    }
    
    // Verify all accessible
    const docs = await getActiveDocumentsForSession(sessionId);
    expect(docs.length).toBe(100);
    
    // Search should still work
    const results = await ragSearch('stress document', sessionId);
    expect(results.length).toBeGreaterThan(0);
  });
});
```

---

## 6. Test Execution Plan

### Phase 1: Unit Tests (Day 1-2)
```bash
# Run all unit tests
pnpm test tests/unit/ --coverage

# Run specific fix validation
pnpm test tests/unit/rag.test.ts        # Fix #1
pnpm test tests/unit/db.test.ts         # Fix #2
pnpm test tests/unit/ragManager.test.ts # Fix #3
```

### Phase 2: Integration Tests (Day 3)
```bash
# Requires running RxDB instance
pnpm test tests/integration/ --runInBand
```

### Phase 3: Performance Tests (Day 4)
```bash
# Run with --expose-gc for memory tests
node --expose-gc node_modules/.bin/jest tests/performance/
```

### Phase 4: E2E Tests (Day 5)
```bash
# Requires dev server running
pnpm test:e2e tests/e2e/
```

### Phase 5: Stress Tests (Day 5)
```bash
# Run in isolation to avoid interference
pnpm test tests/stress/ --runInBand --testTimeout=60000
```

---

## 7. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unit Test Coverage | ≥80% | Jest coverage report |
| Integration Tests Pass | 100% | CI pipeline |
| p95 Search Latency | <200ms | Performance benchmarks |
| Memory Growth | <20% over 10 cycles | Memory leak tests |
| Browser Freeze Rate | 0% | E2E monitoring |
| Concurrent Searches | 50 in <10s | Stress tests |

---

## 8. Fixtures Required

Create in `tests/fixtures/`:

1. `sample-contract.pdf` - Valid multi-page PDF (~5 pages)
2. `scanned-no-text.pdf` - Scanned PDF without OCR text
3. `large-document-50pages.pdf` - Stress test PDF
4. `valid-document.pdf` - Simple text PDF
5. `sample-zulu.txt` - South African language text
6. `sample-xhosa.txt` - South African language text

---

## 9. CI Integration

```yaml
# .github/workflows/rag-tests.yml
name: RAG System Tests

on:
  push:
    paths:
      - 'gogga-frontend/src/lib/rag*.ts'
      - 'gogga-frontend/src/lib/rxdb/**'
      - 'gogga-frontend/src/lib/db.ts'
      - 'tests/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test tests/unit/ --coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test tests/integration/ --runInBand

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: node --expose-gc node_modules/.bin/jest tests/performance/
```

---

## Related Documentation

- `RAG_PERFORMANCE_ANALYSIS.md` - Performance deep dive
- `SESSION_SCOPED_RAG_DESIGN.md` - Architecture documentation
- `SESSION_SCOPED_RAG_TEST_PLAN.md` - Original test plan
- `.serena/memories/rag_enterprise_audit_dec2025.md` - Audit findings
- `.serena/memories/rag_enterprise_audit_implementation_complete.md` - Implementation summary
