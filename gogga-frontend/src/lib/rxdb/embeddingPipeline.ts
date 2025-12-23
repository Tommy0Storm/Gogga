/**
 * GOGGA RxDB Embedding Pipeline
 * Automatic embedding generation for documents using RxDB observables
 * 
 * Features:
 * - Reactive: Automatically processes new documents
 * - Resumable: Tracks progress, resumes after page refresh
 * - Parallel: Uses WebWorkers for concurrent embedding (capped at 4)
 * - Backpressure: Processes in batches to avoid memory issues
 */

import { filter, debounceTime, switchMap, takeUntil, Subject } from 'rxjs';
import { getDatabase, generateId } from './database';
import { storeVectorEmbeddingsBulk, hasVectorsForDocument } from './vectorCollection';
import { batchArray, requestIdlePromise, PROMISE_RESOLVE_TRUE } from './performanceUtils';
import { chunkTextForEmbedding, embeddingEngine } from '../embeddingEngine';
import type { DocumentDoc } from './schemas';

// Pipeline configuration
const PIPELINE_CONFIG = {
  // Maximum concurrent embedding operations
  MAX_CONCURRENT: 4,
  
  // Batch size for bulk operations
  BATCH_SIZE: 10,
  
  // Debounce time for document changes (ms)
  DEBOUNCE_MS: 500,
  
  // Progress storage key
  PROGRESS_KEY: 'gogga_embedding_pipeline_progress',
} as const;

// Pipeline state
interface PipelineState {
  isRunning: boolean;
  pendingDocIds: Set<string>;
  processingDocIds: Set<string>;
  completedCount: number;
  errorCount: number;
  lastError?: string;
}

// Pipeline progress (persisted)
interface PipelineProgress {
  completedDocIds: string[];
  lastRunAt: string;
}

// Singleton state
let pipelineState: PipelineState = {
  isRunning: false,
  pendingDocIds: new Set(),
  processingDocIds: new Set(),
  completedCount: 0,
  errorCount: 0,
};

// Shutdown signal
const shutdown$ = new Subject<void>();

// Progress change callbacks
const progressCallbacks: Set<(state: PipelineState) => void> = new Set();

/**
 * Subscribe to pipeline progress updates
 */
export function onPipelineProgress(
  callback: (state: PipelineState) => void
): () => void {
  progressCallbacks.add(callback);
  return () => progressCallbacks.delete(callback);
}

/**
 * Notify progress callbacks
 */
function notifyProgress(): void {
  for (const callback of progressCallbacks) {
    try {
      callback({ ...pipelineState });
    } catch (e) {
      console.error('[EmbeddingPipeline] Progress callback error:', e);
    }
  }
}

/**
 * Load persisted pipeline progress
 */
function loadProgress(): PipelineProgress {
  if (typeof window === 'undefined') {
    return { completedDocIds: [], lastRunAt: '' };
  }
  
  try {
    const stored = localStorage.getItem(PIPELINE_CONFIG.PROGRESS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Invalid stored data
  }
  
  return { completedDocIds: [], lastRunAt: '' };
}

/**
 * Save pipeline progress
 */
function saveProgress(docId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const progress = loadProgress();
    if (!progress.completedDocIds.includes(docId)) {
      progress.completedDocIds.push(docId);
    }
    progress.lastRunAt = new Date().toISOString();
    
    // Keep only last 1000 doc IDs to prevent localStorage bloat
    if (progress.completedDocIds.length > 1000) {
      progress.completedDocIds = progress.completedDocIds.slice(-1000);
    }
    
    localStorage.setItem(PIPELINE_CONFIG.PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('[EmbeddingPipeline] Failed to save progress:', e);
  }
}

/**
 * Process a single document to generate embeddings
 */
async function processDocument(doc: DocumentDoc): Promise<boolean> {
  try {
    pipelineState.processingDocIds.add(doc.id);
    notifyProgress();
    
    // Skip if already has vectors
    if (await hasVectorsForDocument(doc.id)) {
      console.log(`[EmbeddingPipeline] Document ${doc.id} already has vectors, skipping`);
      return true;
    }
    
    // Chunk the document content
    const chunks = chunkTextForEmbedding(doc.content);
    
    if (chunks.length === 0) {
      console.log(`[EmbeddingPipeline] Document ${doc.id} has no chunks, skipping`);
      return true;
    }
    
    // Initialize embedding engine if needed
    await embeddingEngine.init();
    
    // Generate embeddings for all chunks
    const embeddings: Array<{
      documentId: string;
      chunkIndex: number;
      sessionId: string;
      text: string;
      embedding: number[];
    }> = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      
      // Use embeddingEngine for passage embedding (isQuery = false)
      const embedding = await embeddingEngine.embedText(chunk, false);
      
      embeddings.push({
        documentId: doc.id,
        chunkIndex: i,
        sessionId: doc.sessionId,
        text: chunk,
        embedding,
      });
    }
    
    // Bulk store all embeddings
    await storeVectorEmbeddingsBulk(embeddings);
    
    console.log(`[EmbeddingPipeline] Generated ${embeddings.length} embeddings for document ${doc.id}`);
    
    // Save progress
    saveProgress(doc.id);
    pipelineState.completedCount++;
    
    return true;
  } catch (error) {
    console.error(`[EmbeddingPipeline] Error processing document ${doc.id}:`, error);
    pipelineState.errorCount++;
    pipelineState.lastError = error instanceof Error ? error.message : String(error);
    return false;
  } finally {
    pipelineState.processingDocIds.delete(doc.id);
    pipelineState.pendingDocIds.delete(doc.id);
    notifyProgress();
  }
}

/**
 * Process pending documents in parallel batches
 */
async function processPendingDocuments(): Promise<void> {
  const db = await getDatabase();
  
  // Get all documents that need processing
  const allDocs = await db.documents.find().exec();
  
  // Filter to documents without embeddings
  const docsNeedingEmbeddings: DocumentDoc[] = [];
  
  for (const doc of allDocs) {
    const hasVectors = await hasVectorsForDocument(doc.id);
    if (!hasVectors && !pipelineState.processingDocIds.has(doc.id)) {
      // Cast to DocumentDoc (safe because we're just reading data)
      docsNeedingEmbeddings.push(doc.toJSON() as DocumentDoc);
    }
  }
  
  if (docsNeedingEmbeddings.length === 0) {
    console.log('[EmbeddingPipeline] No documents need embedding');
    return;
  }
  
  console.log(`[EmbeddingPipeline] Processing ${docsNeedingEmbeddings.length} documents`);
  
  // Add to pending set
  for (const doc of docsNeedingEmbeddings) {
    pipelineState.pendingDocIds.add(doc.id);
  }
  notifyProgress();
  
  // Process in batches using RxDB performance utilities
  const batches = batchArray(docsNeedingEmbeddings, PIPELINE_CONFIG.BATCH_SIZE);
  
  for (const batch of batches) {
    // Process batch with limited concurrency using batchArray
    const concurrentChunks = batchArray(batch, PIPELINE_CONFIG.MAX_CONCURRENT);
    
    for (const chunk of concurrentChunks) {
      await Promise.all(chunk.map(doc => processDocument(doc)));
      // Yield to browser between concurrent chunks to prevent UI freezing
      // Using 100ms minimum for complex embedding operations
      await requestIdlePromise(100);
    }
  }
  
  console.log(`[EmbeddingPipeline] Completed processing ${pipelineState.completedCount} documents`);
}

/**
 * Start the embedding pipeline
 * Sets up reactive subscription to document changes
 */
export async function startEmbeddingPipeline(): Promise<void> {
  if (pipelineState.isRunning) {
    console.log('[EmbeddingPipeline] Pipeline already running');
    return;
  }
  
  console.log('[EmbeddingPipeline] Starting pipeline...');
  pipelineState.isRunning = true;
  notifyProgress();
  
  const db = await getDatabase();
  
  // Process existing documents first
  await processPendingDocuments();
  
  // Subscribe to document changes
  db.documents.$
    .pipe(
      // Debounce rapid changes
      debounceTime(PIPELINE_CONFIG.DEBOUNCE_MS),
      
      // Filter for insert events
      filter(event => event.operation === 'INSERT'),
      
      // Stop on shutdown
      takeUntil(shutdown$)
    )
    .subscribe({
      next: async (event) => {
        console.log('[EmbeddingPipeline] New document detected:', event.documentId);
        
        // Get the document
        const doc = await db.documents.findOne(event.documentId).exec();
        if (doc) {
          await processDocument(doc.toJSON() as DocumentDoc);
        }
      },
      error: (error) => {
        console.error('[EmbeddingPipeline] Subscription error:', error);
        pipelineState.lastError = error.message;
        notifyProgress();
      },
    });
  
  console.log('[EmbeddingPipeline] Pipeline started');
}

/**
 * Stop the embedding pipeline
 */
export function stopEmbeddingPipeline(): void {
  if (!pipelineState.isRunning) return;
  
  console.log('[EmbeddingPipeline] Stopping pipeline...');
  shutdown$.next();
  
  pipelineState.isRunning = false;
  pipelineState.pendingDocIds.clear();
  pipelineState.processingDocIds.clear();
  notifyProgress();
  
  console.log('[EmbeddingPipeline] Pipeline stopped');
}

/**
 * Get current pipeline state
 */
export function getPipelineState(): PipelineState {
  return { ...pipelineState };
}

/**
 * Force reprocess a specific document
 */
export async function reprocessDocument(documentId: string): Promise<boolean> {
  const db = await getDatabase();
  const doc = await db.documents.findOne(documentId).exec();
  
  if (!doc) {
    console.error(`[EmbeddingPipeline] Document ${documentId} not found`);
    return false;
  }
  
  // Delete existing vectors
  const vectors = await db.vectorEmbeddings.find({
    selector: { documentId }
  }).exec();
  
  await Promise.all(vectors.map(v => v.remove()));
  
  // Reprocess
  return processDocument(doc.toJSON() as DocumentDoc);
}

/**
 * Process a single document on-demand (for immediate use)
 * Returns the embeddings directly
 */
export async function processDocumentImmediate(doc: DocumentDoc): Promise<number[][]> {
  await embeddingEngine.init();
  const chunks = chunkTextForEmbedding(doc.content);
  const embeddings: number[][] = [];
  
  for (const chunk of chunks) {
    const embedding = await embeddingEngine.embedText(chunk, false);
    embeddings.push(embedding);
  }
  
  // Also store for future use
  const bulkData = embeddings.map((embedding, i) => {
    const chunkText = chunks[i];
    return {
      documentId: doc.id,
      chunkIndex: i,
      sessionId: doc.sessionId,
      text: chunkText ?? '',
      embedding,
    };
  });
  await storeVectorEmbeddingsBulk(bulkData);
  
  return embeddings;
}

/**
 * Generate embedding for a query
 * Uses "query: " prefix for E5 model
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  await embeddingEngine.init();
  
  // Use embeddingEngine with isQuery = true
  return embeddingEngine.embedText(query, true);
}

/**
 * Clear all pipeline progress
 */
export function clearPipelineProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIPELINE_CONFIG.PROGRESS_KEY);
  pipelineState.completedCount = 0;
  pipelineState.errorCount = 0;
  delete pipelineState.lastError;
  notifyProgress();
}

/**
 * Get pipeline statistics
 */
export function getPipelineStats(): {
  isRunning: boolean;
  pending: number;
  processing: number;
  completed: number;
  errors: number;
  lastError?: string;
} {
  const result: {
    isRunning: boolean;
    pending: number;
    processing: number;
    completed: number;
    errors: number;
    lastError?: string;
  } = {
    isRunning: pipelineState.isRunning,
    pending: pipelineState.pendingDocIds.size,
    processing: pipelineState.processingDocIds.size,
    completed: pipelineState.completedCount,
    errors: pipelineState.errorCount,
  };
  
  if (pipelineState.lastError) {
    result.lastError = pipelineState.lastError;
  }
  
  return result;
}
