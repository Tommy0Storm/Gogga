# RAG System Fix Implementation Plan

> **Created:** December 21, 2025
> **Priority:** P0 - Critical fixes first
> **Estimated Time:** 3 weeks

## Phase 1: Stop the Bleeding (P0 Critical - Week 1)

### Fix 1.1: PDF Extraction with Proper Error Handling

**File:** `gogga-frontend/src/lib/rag.ts`

```typescript
// BEFORE: Silent fallback to regex garbage
async function extractPdfText(file: File): Promise<string> {
  try {
    const unpdf = await getUnpdf();
    // ... extraction
  } catch (error) {
    console.warn('[RAG] unpdf extraction failed, falling back to basic:', error);
  }
  // Fallback produces gibberish for complex PDFs
  return regexFallback();
}

// AFTER: Explicit error handling + MinerU backend
async function extractPdfText(file: File): Promise<string> {
  // Try unpdf first
  try {
    const unpdf = await getUnpdf();
    const pdf = await unpdf.getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await unpdf.extractText(pdf, { mergePages: true });
    
    // Validate extraction quality
    if (text && text.length > 100 && isValidText(text)) {
      return text.replace(/\s+/g, ' ').trim();
    }
    throw new Error('Extracted text quality too low');
  } catch (clientError) {
    console.warn('[RAG] Client-side PDF extraction failed:', clientError);
  }
  
  // Try MinerU backend for complex PDFs
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/v1/documents/parse-upload', {
      method: 'POST',
      body: formData,
    });
    if (response.ok) {
      const { text } = await response.json();
      return text;
    }
  } catch (backendError) {
    console.warn('[RAG] MinerU extraction failed:', backendError);
  }
  
  // NO SILENT FALLBACK - throw clear error
  throw new Error(
    `Could not extract text from "${file.name}". ` +
    `The PDF may be scanned or encrypted. Try converting to text first.`
  );
}

// Helper to validate extracted text quality
function isValidText(text: string): boolean {
  // Check for garbled text patterns
  const garbledPatterns = [
    /[^\x20-\x7E\n\t]{10,}/, // Non-printable sequences
    /(.)\1{10,}/, // Repeated characters
    /^[\d\s]+$/, // Only numbers
  ];
  return !garbledPatterns.some(p => p.test(text));
}
```

### Fix 1.2: Replace Full Collection Scans with Indexed Queries

**File:** `gogga-frontend/src/lib/db.ts`

```typescript
// BEFORE: Loads ALL documents
export async function getActiveDocumentsForSession(sessionId: string): Promise<Document[]> {
  const rxdb = await getDatabase();
  const allDocs = await rxdb.documents.find().exec();  // ❌ FULL SCAN
  const activeDocs = allDocs.filter((doc) => {
    const data = doc.toJSON();
    return data.activeSessions?.includes(sessionId);
  });
  // ...
}

// AFTER: Indexed query
export async function getActiveDocumentsForSession(sessionId: string): Promise<Document[]> {
  const rxdb = await getDatabase();
  
  // Use indexed query with selector
  const activeDocs = await rxdb.documents.find({
    selector: {
      $or: [
        { activeSessions: { $elemMatch: { $eq: sessionId } } },
        // Fallback for legacy docs
        { sessionId: sessionId, activeSessions: { $size: 0 } }
      ]
    }
  }).exec();
  
  // Single conversion pass
  return activeDocs.map(d => docToDocument(d.toJSON() as DocumentDoc));
}
```

### Fix 1.3: Persist Embeddings to RxDB

**File:** `gogga-frontend/src/lib/ragManager.ts`

```typescript
// BEFORE: Ephemeral Map cache
private embeddingsCache: Map<string, EmbeddingCacheEntry> = new Map();

// AFTER: RxDB-backed cache with memory layer
export class RagManager {
  private memoryCache: Map<string, EmbeddingCacheEntry> = new Map();
  
  /**
   * Get embeddings from RxDB first, then memory cache, finally generate
   */
  async getEmbeddings(docId: string, sessionId: string): Promise<EmbeddingCacheEntry | null> {
    // 1. Check memory cache (fastest)
    if (this.memoryCache.has(docId)) {
      return this.memoryCache.get(docId)!;
    }
    
    // 2. Check RxDB (persistent)
    const rxdb = await import('./rxdb/database').then(m => m.getDatabase());
    const storedVectors = await rxdb.vectorEmbeddings.find({
      selector: { documentId: docId }
    }).exec();
    
    if (storedVectors.length > 0) {
      const entry: EmbeddingCacheEntry = {
        docId,
        vectors: storedVectors.map(v => v.embedding),
        chunks: storedVectors.map(v => v.chunkText || ''),
        timestamp: Date.now(),
      };
      this.memoryCache.set(docId, entry);
      return entry;
    }
    
    return null; // Need to generate
  }
  
  /**
   * Store embeddings to both RxDB and memory cache
   */
  async storeEmbeddings(docId: string, result: EmbeddingResult): Promise<void> {
    const rxdb = await import('./rxdb/database').then(m => m.getDatabase());
    
    // Store to RxDB
    const vectorDocs = result.chunks.map((chunk, i) => ({
      id: `${docId}-${i}`,
      documentId: docId,
      chunkIndex: i,
      chunkText: chunk,
      embedding: result.vectors[i],
      createdAt: new Date().toISOString(),
    }));
    
    await rxdb.vectorEmbeddings.bulkUpsert(vectorDocs);
    
    // Update memory cache
    this.memoryCache.set(docId, {
      docId,
      vectors: result.vectors,
      chunks: result.chunks,
      timestamp: Date.now(),
    });
  }
}
```

### Fix 1.4: Debounce Document Store Updates

**File:** `gogga-frontend/src/lib/documentStore.ts`

```typescript
import { create } from 'zustand';
import { debounce } from 'lodash-es'; // Or implement simple debounce

// Debounced sync to prevent excessive updates
const debouncedSync = debounce((set: any, state: any) => {
  set(state);
}, 100); // 100ms debounce

export const useDocumentStore = create<DocumentStore>((set) => ({
  // ... existing state
  
  // Replace direct set with debounced version for bulk updates
  syncState: (state) => debouncedSync(set, state),
  
  // Keep individual setters immediate for UI responsiveness
  setIsLoading: (isLoading) => set({ isLoading }),
}));
```

## Phase 2: Architecture Fix (P1 High - Week 2)

### Fix 2.1: Move Embedding to Web Workers

**File:** `gogga-frontend/src/lib/embeddingWorkerManager.ts` (NEW)

```typescript
/**
 * Web Worker manager for off-main-thread embedding
 */
export class EmbeddingWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  
  async init(): Promise<void> {
    if (this.worker) return;
    
    // Use existing parallelEmbedding worker
    this.worker = new Worker(
      new URL('./embeddingWorker.ts', import.meta.url),
      { type: 'module' }
    );
    
    this.worker.onmessage = (e) => {
      const { id, embedding, error } = e.data;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        error ? pending.reject(new Error(error)) : pending.resolve(embedding);
        this.pendingRequests.delete(id);
      }
    };
  }
  
  async embed(text: string, isQuery = false): Promise<number[]> {
    await this.init();
    
    const id = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ id, text, isQuery });
    });
  }
}

export const embeddingWorkerManager = new EmbeddingWorkerManager();
```

### Fix 2.2: RxDB Reactive Subscriptions

**File:** `gogga-frontend/src/hooks/useRAGSubscription.ts` (NEW)

```typescript
import { useEffect, useState } from 'react';
import { getDatabase } from '@/lib/rxdb/database';
import type { Document } from '@/lib/db';

/**
 * Reactive hook for session documents using RxDB subscriptions
 * Replaces polling with push-based updates
 */
export function useSessionDocuments(sessionId: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    let subscription: any;
    
    async function subscribe() {
      const db = await getDatabase();
      
      // Create reactive query
      const query = db.documents.find({
        selector: {
          $or: [
            { activeSessions: { $elemMatch: { $eq: sessionId } } },
            { sessionId: sessionId }
          ]
        }
      });
      
      // Subscribe to changes
      subscription = query.$.subscribe(docs => {
        setDocuments(docs.map(d => ({
          ...d.toJSON(),
          // Convert dates once
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
          lastAccessedAt: new Date(d.lastAccessedAt),
        })));
        setIsLoading(false);
      });
    }
    
    subscribe();
    
    return () => subscription?.unsubscribe();
  }, [sessionId]);
  
  return { documents, isLoading };
}
```

### Fix 2.3: Add activeSessions Index

**File:** `gogga-frontend/src/lib/rxdb/schemas.ts`

```typescript
export const documentSchema: RxJsonSchema<DocumentDoc> = {
  // ... existing schema
  indexes: [
    'userId',
    'originSessionId',
    'sessionId', // Legacy
    'lastAccessedAt',
    // Add compound index for session queries
    ['userId', 'lastAccessedAt'],
  ],
  // Note: RxDB doesn't support array element indexes directly
  // Use compound queries with userId + JS filter for activeSessions
};
```

## Phase 3: Polish (P2 Medium - Week 3)

### Fix 3.1: Progress Indicators

**File:** `gogga-frontend/src/components/rag/EmbeddingProgress.tsx` (NEW)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface EmbeddingProgressProps {
  isEmbedding: boolean;
  current: number;
  total: number;
}

export function EmbeddingProgress({ isEmbedding, current, total }: EmbeddingProgressProps) {
  if (!isEmbedding || total === 0) return null;
  
  const percent = Math.round((current / total) * 100);
  
  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 w-64 z-50">
      <div className="text-sm font-medium mb-2">
        Processing documents...
      </div>
      <Progress value={percent} className="h-2" />
      <div className="text-xs text-gray-500 mt-1">
        {current} of {total} documents
      </div>
    </div>
  );
}
```

### Fix 3.2: Token Budget Enforcement

**File:** `gogga-frontend/src/lib/tokenBudget.ts` (NEW)

```typescript
export const TOKEN_BUDGETS = {
  free:  { state: 1000, rag: 0,    volatile: 4000, response: 4000 },
  jive:  { state: 2000, rag: 3000, volatile: 6000, response: 5000 },
  jigga: { state: 3000, rag: 6000, volatile: 8000, response: 8000 },
} as const;

/**
 * Assemble RAG context respecting token budget
 */
export function assembleRAGContext(
  tier: 'free' | 'jive' | 'jigga',
  chunks: { text: string; score: number }[]
): { context: string; tokensUsed: number; truncated: boolean } {
  const budget = TOKEN_BUDGETS[tier].rag;
  
  if (budget === 0) {
    return { context: '', tokensUsed: 0, truncated: false };
  }
  
  let tokensUsed = 0;
  const includedChunks: string[] = [];
  let truncated = false;
  
  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.text);
    
    if (tokensUsed + chunkTokens > budget) {
      truncated = true;
      break;
    }
    
    includedChunks.push(chunk.text);
    tokensUsed += chunkTokens;
  }
  
  const context = includedChunks.length > 0
    ? `[DOCUMENT CONTEXT]\n${includedChunks.join('\n---\n')}\n[END DOCUMENT CONTEXT]`
    : '';
  
  return { context, tokensUsed, truncated };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

## Testing Checklist

### Unit Tests

```typescript
// __tests__/rag/pdfExtraction.test.ts
describe('PDF Extraction', () => {
  it('should throw clear error for encrypted PDFs', async () => {
    const encryptedPdf = new File([...], 'encrypted.pdf', { type: 'application/pdf' });
    await expect(extractPdfText(encryptedPdf)).rejects.toThrow(/encrypted/i);
  });
  
  it('should validate extracted text quality', () => {
    expect(isValidText('Normal text content')).toBe(true);
    expect(isValidText('aaaaaaaaaaaaaaaaaaa')).toBe(false);
    expect(isValidText('\x00\x01\x02\x03\x04')).toBe(false);
  });
});

// __tests__/rag/embeddingCache.test.ts
describe('Embedding Cache', () => {
  it('should persist embeddings to RxDB', async () => {
    const manager = new RagManager();
    await manager.storeEmbeddings('doc-1', mockEmbeddingResult);
    
    // New instance should find cached embeddings
    const manager2 = new RagManager();
    const cached = await manager2.getEmbeddings('doc-1', 'session-1');
    expect(cached).toBeTruthy();
    expect(cached!.vectors).toEqual(mockEmbeddingResult.vectors);
  });
});

// __tests__/rag/indexedQueries.test.ts
describe('Indexed Queries', () => {
  it('should use selector instead of full scan', async () => {
    // Add 100 test documents
    // Measure query time - should be <50ms
    const start = performance.now();
    await getActiveDocumentsForSession('session-1');
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
});
```

### Performance Benchmarks

```typescript
// __tests__/rag/performance.bench.ts
import { bench, describe } from 'vitest';

describe('RAG Performance', () => {
  bench('document load (10 docs)', async () => {
    await getActiveDocumentsForSession('session-with-10-docs');
  });
  
  bench('embedding retrieval (cached)', async () => {
    await ragManager.getEmbeddings('cached-doc-id', 'session-1');
  });
  
  bench('semantic search (5 docs)', async () => {
    await ragManager.retrieveSemantic('session-1', 'test query', 5);
  });
});
```
