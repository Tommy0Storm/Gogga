/**
 * GOGGA Parallel Embedding Manager
 * 
 * Coordinates Web Workers for parallel embedding generation.
 * Uses navigator.hardwareConcurrency to scale worker count.
 * Integrates with Memory Storage for embedding caching.
 */

import { getCachedEmbedding, cacheEmbedding } from './memoryStorage';
import type { EmbeddingRequest, EmbeddingResponse } from './embeddingWorker';

// ============================================
// Types
// ============================================

interface EmbeddingJob {
  id: string;
  texts: string[];
  resolve: (embeddings: number[][]) => void;
  reject: (error: Error) => void;
  onProgress: ((completed: number, total: number) => void) | undefined;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
  currentJobId: string | null;
}

// ============================================
// Parallel Embedding Manager
// ============================================

class ParallelEmbeddingManager {
  private workers: WorkerState[] = [];
  private jobQueue: EmbeddingJob[] = [];
  private activeJobs: Map<string, EmbeddingJob> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  
  // Configuration
  private maxWorkers: number;
  private useCaching: boolean;
  
  constructor() {
    // Use half of available cores, min 1, max 4
    const cores = typeof navigator !== 'undefined' 
      ? navigator.hardwareConcurrency || 2 
      : 2;
    this.maxWorkers = Math.min(Math.max(1, Math.floor(cores / 2)), 4);
    this.useCaching = true;
    
    console.log(`[ParallelEmbedding] Using ${this.maxWorkers} workers`);
  }
  
  /**
   * Initialize workers lazily
   * Uses thread-safe initialization pattern to prevent race conditions
   */
  private async init(): Promise<void> {
    // Fast path: already initialized
    if (this.initialized) return;
    
    // Wait for in-progress initialization
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    
    // CRITICAL: Create and store promise SYNCHRONOUSLY before any await
    // This ensures all concurrent calls get the same promise
    const initPromise = this.createWorkers();
    this.initPromise = initPromise;
    
    try {
      await initPromise;
      this.initialized = true;
    } catch (error) {
      // Clear promise so next call can retry
      if (this.initPromise === initPromise) {
        this.initPromise = null;
      }
      throw error;
    }
    // NOTE: We intentionally do NOT clear this.initPromise
    // Keeping the resolved promise allows subsequent calls to return immediately
  }
  
  private async createWorkers(): Promise<void> {
    // Only create workers in browser environment
    if (typeof window === 'undefined') {
      console.warn('[ParallelEmbedding] Workers not available in Node.js');
      return;
    }
    
    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = new Worker(
          new URL('./embeddingWorker.ts', import.meta.url),
          { type: 'module' }
        );
        
        worker.onmessage = (event: MessageEvent<EmbeddingResponse>) => {
          this.handleWorkerMessage(i, event.data);
        };
        
        worker.onerror = (error) => {
          console.error(`[ParallelEmbedding] Worker ${i} error:`, error);
          this.handleWorkerError(i, error);
        };
        
        this.workers.push({
          worker,
          busy: false,
          currentJobId: null,
        });
        
        console.log(`[ParallelEmbedding] Worker ${i} created`);
      } catch (error) {
        console.error(`[ParallelEmbedding] Failed to create worker ${i}:`, error);
      }
    }
  }
  
  /**
   * Handle message from worker
   */
  private handleWorkerMessage(workerIndex: number, response: EmbeddingResponse): void {
    const job = this.activeJobs.get(response.id);
    
    if (!job) {
      // Model loading progress, not a job
      if (response.id === 'model-loading') {
        console.log(`[ParallelEmbedding] Model loading: ${response.progress?.completed}%`);
      }
      return;
    }
    
    switch (response.type) {
      case 'result':
        // Cache embeddings if enabled
        if (this.useCaching && response.embeddings) {
          this.cacheResults(job.texts, response.embeddings);
        }
        
        job.resolve(response.embeddings || []);
        this.completeJob(workerIndex, response.id);
        break;
        
      case 'progress':
        if (job.onProgress && response.progress) {
          job.onProgress(response.progress.completed, response.progress.total);
        }
        break;
        
      case 'error':
        job.reject(new Error(response.error || 'Unknown worker error'));
        this.completeJob(workerIndex, response.id);
        break;
    }
  }
  
  /**
   * Handle worker error
   */
  private handleWorkerError(workerIndex: number, _error: ErrorEvent): void {
    const state = this.workers[workerIndex];
    if (state?.currentJobId) {
      const job = this.activeJobs.get(state.currentJobId);
      if (job) {
        job.reject(new Error('Worker crashed'));
        this.activeJobs.delete(state.currentJobId);
      }
    }
    
    // Mark worker as available again
    if (state) {
      state.busy = false;
      state.currentJobId = null;
    }
    
    // Try to process next job
    this.processQueue();
  }
  
  /**
   * Complete a job and process queue
   */
  private completeJob(workerIndex: number, jobId: string): void {
    this.activeJobs.delete(jobId);
    
    const state = this.workers[workerIndex];
    if (state) {
      state.busy = false;
      state.currentJobId = null;
    }
    
    // Process next job in queue
    this.processQueue();
  }
  
  /**
   * Cache embedding results
   */
  private async cacheResults(texts: string[], embeddings: number[][]): Promise<void> {
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const embedding = embeddings[i];
      if (text === undefined || embedding === undefined) continue;
      try {
        await cacheEmbedding(text, embedding);
      } catch (error) {
        // Ignore caching errors
        console.warn('[ParallelEmbedding] Cache write failed:', error);
      }
    }
  }
  
  /**
   * Process jobs in queue
   */
  private processQueue(): void {
    if (this.jobQueue.length === 0) return;
    
    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) return;
    
    const job = this.jobQueue.shift();
    if (!job) return;
    
    // Mark worker as busy
    const workerIndex = this.workers.indexOf(availableWorker);
    availableWorker.busy = true;
    availableWorker.currentJobId = job.id;
    
    // Track active job
    this.activeJobs.set(job.id, job);
    
    // Send to worker
    availableWorker.worker.postMessage({
      type: 'embed',
      id: job.id,
      texts: job.texts,
      batchSize: 5,
    } as EmbeddingRequest);
    
    console.log(`[ParallelEmbedding] Job ${job.id} assigned to worker ${workerIndex}`);
    
    // Try to process more jobs
    this.processQueue();
  }
  
  /**
   * Generate embeddings for texts
   * Uses caching and parallel workers for optimal performance
   */
  async generateEmbeddings(
    texts: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<number[][]> {
    await this.init();
    
    // If no workers available, fall back to sync
    if (this.workers.length === 0) {
      throw new Error('Workers not available, use sync embedding instead');
    }
    
    // Check cache for existing embeddings
    const results: (number[] | null)[] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    
    if (this.useCaching) {
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (text === undefined) continue;
        const cached = await getCachedEmbedding(text);
        results[i] = cached;
        if (!cached) {
          uncachedTexts.push(text);
          uncachedIndices.push(i);
        }
      }
      
      console.log(`[ParallelEmbedding] Cache: ${texts.length - uncachedTexts.length}/${texts.length} hits`);
    } else {
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (text === undefined) continue;
        results[i] = null;
        uncachedTexts.push(text);
        uncachedIndices.push(i);
      }
    }
    
    // All cached, return immediately
    if (uncachedTexts.length === 0) {
      return results as number[][];
    }
    
    // Generate embeddings for uncached texts
    return new Promise((resolve, reject) => {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const job: EmbeddingJob = {
        id: jobId,
        texts: uncachedTexts,
        resolve: (embeddings) => {
          // Merge cached and new embeddings
          for (let i = 0; i < embeddings.length; i++) {
            const idx = uncachedIndices[i];
            const embedding = embeddings[i];
            if (idx !== undefined && embedding !== undefined) {
              results[idx] = embedding;
            }
          }
          resolve(results as number[][]);
        },
        reject,
        onProgress,
      };
      
      this.jobQueue.push(job);
      this.processQueue();
    });
  }
  
  /**
   * Generate single embedding (convenience method)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    const result = embeddings[0];
    if (!result) {
      throw new Error('Failed to generate embedding');
    }
    return result;
  }
  
  /**
   * Enable or disable caching
   */
  setCaching(enabled: boolean): void {
    this.useCaching = enabled;
  }
  
  /**
   * Get current status
   */
  getStatus(): {
    workers: number;
    busy: number;
    queueLength: number;
    activeJobs: number;
  } {
    return {
      workers: this.workers.length,
      busy: this.workers.filter(w => w.busy).length,
      queueLength: this.jobQueue.length,
      activeJobs: this.activeJobs.size,
    };
  }
  
  /**
   * Terminate all workers
   */
  terminate(): void {
    for (const state of this.workers) {
      state.worker.terminate();
    }
    this.workers = [];
    this.initialized = false;
    
    // Reject pending jobs
    for (const job of this.jobQueue) {
      job.reject(new Error('Manager terminated'));
    }
    for (const job of this.activeJobs.values()) {
      job.reject(new Error('Manager terminated'));
    }
    
    this.jobQueue = [];
    this.activeJobs.clear();
    
    console.log('[ParallelEmbedding] All workers terminated');
  }
}

// Singleton instance
let managerInstance: ParallelEmbeddingManager | null = null;

/**
 * Get the parallel embedding manager instance
 */
export function getParallelEmbeddingManager(): ParallelEmbeddingManager {
  if (!managerInstance) {
    managerInstance = new ParallelEmbeddingManager();
  }
  return managerInstance;
}

/**
 * Generate embeddings using parallel workers
 */
export async function generateParallelEmbeddings(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const manager = getParallelEmbeddingManager();
  return manager.generateEmbeddings(texts, onProgress);
}

/**
 * Generate single embedding using parallel workers
 */
export async function generateParallelEmbedding(text: string): Promise<number[]> {
  const manager = getParallelEmbeddingManager();
  return manager.generateEmbedding(text);
}

export { ParallelEmbeddingManager };
