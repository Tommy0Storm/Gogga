/**
 * GOGGA Local Embedding Engine
 * Uses @huggingface/transformers for browser-based semantic embeddings
 * Model: intfloat/e5-small-v2 (384-dim vectors) - stored locally for IP protection
 * 
 * Architecture:
 * - Primary: transformers.js pipeline for feature extraction
 * - Fallback: Direct ONNX Runtime with custom tokenizer
 * - Web Workers: Optional parallel processing via parallelEmbedding.ts
 * 
 * Location: /assets/.models/v2e5s/core.onnx (obfuscated path)
 * 
 * TypeScript 5.9 / Python 3.14 Synergy:
 * - Uses dynamic import() for lazy loading (equivalent to `import defer` pattern)
 * - Python 3.14 deferred annotations (PEP 649) parallels this client-side pattern
 * - Embedding model only loads when JIGGA tier user first accesses semantic RAG
 * - Reduces initial bundle size by ~50MB (ONNX model + tokenizer)
 * 
 * Future: When `import defer` is widely supported, can convert to:
 *   import defer * as transformers from '@huggingface/transformers'
 */

import type { Document } from './db';
import { generateParallelEmbeddings } from './rxdb/parallelEmbedding';

// Types for the embedding engine
export interface EmbeddingResult {
  vectors: number[][];
  chunks: string[];
  metadata: {
    model: string;
    dimension: number;
    processingTimeMs: number;
    chunkCount: number;
  };
}

export interface EmbeddingEngineConfig {
  modelPath?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  maxTokens?: number;
  useWebGPU?: boolean;
}

// E5 model specifics
const E5_CONFIG = {
  MODEL_ID: 'intfloat/e5-small-v2',
  DIMENSION: 384,
  MAX_SEQUENCE_LENGTH: 512,
  LOCAL_MODEL_PATH: '/assets/.models/v2e5s/core.onnx',
  CHUNK_SIZE_WORDS: 200,
  CHUNK_OVERLAP_WORDS: 30,
} as const;

// Performance configuration
interface PerformanceConfig {
  useWebGPU: boolean;
  quantization: 'q4' | 'q8' | 'fp16' | 'fp32';
  isWebGPUAvailable: boolean;
}

// Cache WebGPU availability check
let webGPUAvailabilityCache: boolean | null = null;

/**
 * Check if WebGPU is available for acceleration
 * Caches result for performance
 */
async function checkWebGPUAvailability(): Promise<boolean> {
  if (webGPUAvailabilityCache !== null) {
    return webGPUAvailabilityCache;
  }
  
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    webGPUAvailabilityCache = false;
    return false;
  }
  
  try {
    const adapter = await (navigator as any).gpu?.requestAdapter();
    webGPUAvailabilityCache = !!adapter;
    console.log(`[EmbeddingEngine] WebGPU availability: ${webGPUAvailabilityCache}`);
    return webGPUAvailabilityCache;
  } catch {
    webGPUAvailabilityCache = false;
    return false;
  }
}

/**
 * Get optimal performance configuration based on device capabilities
 */
async function getOptimalConfig(): Promise<PerformanceConfig> {
  const isWebGPUAvailable = await checkWebGPUAvailability();
  
  return {
    // Use WebGPU if available (10-50x faster)
    useWebGPU: isWebGPUAvailable,
    // Use q4 with WebGPU (faster), q8 with WASM (better accuracy)
    quantization: isWebGPUAvailable ? 'q4' : 'q8',
    isWebGPUAvailable,
  };
}

// Singleton for transformers.js pipeline
let embeddingPipeline: any = null;
let pipelineLoading: Promise<any> | null = null;
let currentPipelineConfig: PerformanceConfig | null = null;

/**
 * Configure ONNX Runtime Web for optimal browser performance
 * Must be called before any pipeline initialization
 */
async function configureOnnxRuntime(): Promise<void> {
  try {
    // Dynamic import ONNX Runtime Web directly to configure WASM
    const ort = await import('onnxruntime-web');
    
    // Reduce threading to avoid chunk loading issues with Turbopack
    // Single-threaded is more reliable for initial load
    ort.env.wasm.numThreads = 1;
    
    // Use CDN-hosted WASM files to avoid chunk loading issues
    // This bypasses Turbopack's chunk splitting for WASM binaries
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
    
    // Disable proxy workers to simplify loading
    ort.env.wasm.proxy = false;
    
    console.log('[EmbeddingEngine] ONNX Runtime configured:', {
      numThreads: ort.env.wasm.numThreads,
      wasmPaths: ort.env.wasm.wasmPaths,
    });
  } catch (error) {
    console.warn('[EmbeddingEngine] Could not configure ONNX Runtime directly:', error);
    // Continue anyway - transformers.js will use its own defaults
  }
}

/**
 * Lazy-load the transformers.js feature extraction pipeline
 * Uses the local ONNX model for embedding generation
 * 
 * Performance optimizations applied:
 * - Auto-detects WebGPU for 10-50x acceleration
 * - Uses q4 quantization with WebGPU (75% smaller, faster)
 * - Uses q8 quantization with WASM (balance of size/accuracy)
 * - Browser Cache API for model persistence
 */
async function getEmbeddingPipeline(forceWebGPU?: boolean): Promise<any> {
  // Get optimal config
  const optimalConfig = await getOptimalConfig();
  const useWebGPU = forceWebGPU ?? optimalConfig.useWebGPU;
  
  // Check if we can reuse existing pipeline
  if (embeddingPipeline && currentPipelineConfig?.useWebGPU === useWebGPU) {
    return embeddingPipeline;
  }
  
  if (pipelineLoading) return pipelineLoading;
  
  pipelineLoading = (async () => {
    try {
      // Configure ONNX Runtime before loading pipeline
      await configureOnnxRuntime();
      
      // Dynamic import to avoid SSR issues
      const { pipeline, env } = await import('@huggingface/transformers');
      
      // Configure for browser usage (only if env is defined)
      if (env) {
        // Disable local models - we use HuggingFace Hub hosted models
        env.allowLocalModels = false;
        // Enable remote model downloads from HuggingFace Hub
        env.allowRemoteModels = true;
        
        // Suppress verbose logging (e.g., "Unable to determine content-length" warnings)
        // This is a benign message when the server doesn't send Content-Length headers
        // Using type assertion since logLevel exists at runtime but not in type definitions
        (env as any).logLevel = 'error'; // Only show errors, not warnings/info
        
        // CRITICAL: Disable ALL filesystem access to prevent "Unable to add filesystem: <illegal path>" errors
        // In browser environments, we can't use Node.js fs module - use browser cache or in-memory only
        // Both settings MUST be disabled - they control different code paths in transformers.js:
        // - useFS: Controls getFile() function filesystem access
        // - useFSCache: Controls getModelFile() FileCache that uses fs.promises
        env.useFS = false;
        env.useFSCache = false;
        
        // Check if Cache API is available before enabling browser cache
        // This prevents "Browser cache is not available" errors in incognito/restricted browsers
        let cacheAvailable = false;
        try {
          if (typeof window !== 'undefined' && 'caches' in window) {
            // Actually test the Cache API - some browsers have 'caches' but it throws
            await window.caches.open('gogga-embedding-cache');
            await window.caches.delete('gogga-embedding-cache');
            cacheAvailable = true;
            console.log('[EmbeddingEngine] Browser Cache API available');
          }
        } catch (e) {
          console.warn('[EmbeddingEngine] Cache API not available - using in-memory cache:', e);
        }
        env.useBrowserCache = cacheAvailable;
        
        // Note: ONNX WASM configuration is done via configureOnnxRuntime() above
        // transformers.js env.backends.onnx is read-only at runtime
      }
      
      // Create feature extraction pipeline
      // Uses Xenova's quantized version from HuggingFace Hub
      const device = useWebGPU && typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu ? 'webgpu' : 'wasm';
      
      // Select optimal quantization: q4 for WebGPU (faster), q8 for WASM (balanced)
      const dtype = device === 'webgpu' ? 'q4' : 'q8';
      
      console.log(`[EmbeddingEngine] Initializing pipeline: device=${device}, dtype=${dtype}, cache=${env?.useBrowserCache ? 'browser' : 'in-memory'}`);
      
      // Progress callback to show model download status
      const progressCallback = (progress: { status: string; file?: string; loaded?: number; total?: number; progress?: number }) => {
        if (progress.status === 'download' && progress.file && progress.total) {
          const percent = progress.progress ? Math.round(progress.progress * 100) : 
                          progress.loaded ? Math.round((progress.loaded / progress.total) * 100) : 0;
          console.log(`[EmbeddingEngine] Downloading ${progress.file}: ${percent}%`);
        } else if (progress.status === 'ready') {
          console.log('[EmbeddingEngine] Model ready');
        } else if (progress.status === 'loading') {
          console.log(`[EmbeddingEngine] Loading ${progress.file || 'model'}...`);
        }
      };
      
      embeddingPipeline = await pipeline(
        'feature-extraction',
        'Xenova/e5-small-v2', // Xenova's quantized version for browser
        { 
          device,
          dtype, // Optimal quantization based on device
          progress_callback: progressCallback,
        }
      );
      
      // Store current config for reuse check
      currentPipelineConfig = { useWebGPU, quantization: dtype as any, isWebGPUAvailable: optimalConfig.isWebGPUAvailable };
      
      console.log(`[EmbeddingEngine] Pipeline initialized: WebGPU=${useWebGPU}, quantization=${dtype}`);
      return embeddingPipeline;
    } catch (error) {
      console.error('[EmbeddingEngine] Failed to initialize pipeline:', error);
      throw error;
    }
  })();
  
  return pipelineLoading;
}

/**
 * Split text into overlapping chunks optimized for E5 model
 */
export function chunkTextForEmbedding(
  text: string,
  chunkSizeWords: number = E5_CONFIG.CHUNK_SIZE_WORDS,
  overlapWords: number = E5_CONFIG.CHUNK_OVERLAP_WORDS
): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ');
  
  if (words.length <= chunkSizeWords) {
    return [normalized];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < words.length) {
    const end = Math.min(start + chunkSizeWords, words.length);
    const chunk = words.slice(start, end).join(' ');
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // Move forward with overlap
    start += chunkSizeWords - overlapWords;
    
    // Prevent infinite loop if overlap >= size
    if (start <= chunks.length - 1) {
      start = chunks.length;
    }
  }
  
  return chunks.length > 0 ? chunks : [normalized];
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * L2 normalize a vector in-place and return it
 */
function normalizeVector(vector: number[]): number[] {
  let norm = 0;
  for (const val of vector) {
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      const current = vector[i];
      if (current !== undefined) {
        vector[i] = current / norm;
      }
    }
  }
  
  return vector;
}

/**
 * Main embedding engine class
 * Generates embeddings for documents using E5-small-v2 model
 */
export class EmbeddingEngine {
    /**
     * Get backend type (webgpu/wasm)
     */
    getBackend(): string {
      if (
        this.config.useWebGPU &&
        typeof navigator !== 'undefined' &&
        'gpu' in navigator &&
        (navigator as any).gpu
      ) {
        return 'webgpu';
      }
      return 'wasm';
    }
  private config: Required<EmbeddingEngineConfig>;
  private initialized = false;
  
  constructor(config?: EmbeddingEngineConfig) {
    this.config = {
      modelPath: config?.modelPath ?? E5_CONFIG.LOCAL_MODEL_PATH,
      chunkSize: config?.chunkSize ?? E5_CONFIG.CHUNK_SIZE_WORDS,
      chunkOverlap: config?.chunkOverlap ?? E5_CONFIG.CHUNK_OVERLAP_WORDS,
      maxTokens: config?.maxTokens ?? E5_CONFIG.MAX_SEQUENCE_LENGTH,
      useWebGPU: config?.useWebGPU ?? false,
    };
  }
  
  /**
   * Initialize the embedding engine (lazy loading)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[EmbeddingEngine] init() called, waiting for pipeline...');
    await getEmbeddingPipeline(this.config.useWebGPU);
    console.log('[EmbeddingEngine] init() complete');
    this.initialized = true;
  }
  
  /**
   * Generate embeddings for a single text string
   * E5 models require "query: " or "passage: " prefix
   */
  async embedText(text: string, isQuery = false): Promise<number[]> {
    console.log(`[EmbeddingEngine] embedText called, isQuery=${isQuery}, text length=${text.length}`);
    
    await this.init();
    
    console.log('[EmbeddingEngine] Getting pipeline for inference...');
    const pipeline = await getEmbeddingPipeline(this.config.useWebGPU);
    
    // E5 requires specific prefixes
    const prefixedText = isQuery ? `query: ${text}` : `passage: ${text}`;
    
    // Truncate if too long (rough character estimate)
    const truncatedText = prefixedText.slice(0, this.config.maxTokens * 4);
    
    console.log('[EmbeddingEngine] Running inference...');
    const startTime = performance.now();
    
    // Add timeout wrapper to prevent indefinite hanging
    const timeoutMs = 30000; // 30 second timeout
    const result = await Promise.race([
      pipeline(truncatedText, {
        pooling: 'mean',
        normalize: true,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Embedding inference timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
    
    const duration = performance.now() - startTime;
    console.log(`[EmbeddingEngine] Inference complete in ${duration.toFixed(0)}ms`);
    
    // Extract the embedding vector
    const embedding = Array.from((result as any).data as Float32Array);
    return embedding;
  }
  
  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedTexts(texts: string[], isQuery = false): Promise<number[][]> {
    await this.init();
    
    const pipeline = await getEmbeddingPipeline(this.config.useWebGPU);
    
    // Add E5 prefixes
    const prefix = isQuery ? 'query: ' : 'passage: ';
    const prefixedTexts = texts.map(t => 
      (prefix + t).slice(0, this.config.maxTokens * 4)
    );
    
    const results: number[][] = [];
    
    // Process in smaller batches to avoid memory issues
    const batchSize = 4;
    for (let i = 0; i < prefixedTexts.length; i += batchSize) {
      const batch = prefixedTexts.slice(i, i + batchSize);
      
      for (const text of batch) {
        const result = await pipeline(text, {
          pooling: 'mean',
          normalize: true,
        });
        results.push(Array.from(result.data as Float32Array));
      }
    }
    
    return results;
  }
  
  /**
   * Generate embeddings using Web Workers (off main thread)
   * Significantly faster for large batches, doesn't block UI
   * @param texts - Array of texts to embed
   * @param onProgress - Optional progress callback
   * @returns Array of embedding vectors
   */
  async embedTextsParallel(
    texts: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<number[][]> {
    // Add passage prefix for E5 model
    const prefixedTexts = texts.map(t => 
      ('passage: ' + t).slice(0, this.config.maxTokens * 4)
    );
    
    // Use parallel workers - runs off main thread
    return generateParallelEmbeddings(prefixedTexts, onProgress);
  }
  
  /**
   * Generate embeddings for a document with automatic chunking
   * Uses Web Workers for parallel processing when available
   * @param doc - Document to process
   * @param useWorkers - Use Web Workers for off-main-thread processing (default: true)
   * @param onProgress - Optional progress callback
   */
  async generateDocumentEmbeddings(
    doc: Document,
    useWorkers = true,
    onProgress?: (completed: number, total: number) => void
  ): Promise<EmbeddingResult> {
    const startTime = performance.now();
    
    if (!doc.content || doc.content.trim().length === 0) {
      return {
        vectors: [],
        chunks: [],
        metadata: {
          model: E5_CONFIG.MODEL_ID,
          dimension: E5_CONFIG.DIMENSION,
          processingTimeMs: 0,
          chunkCount: 0,
        },
      };
    }
    
    // Use existing chunks if available, otherwise create new ones
    const chunks = doc.chunks && doc.chunks.length > 0 
      ? doc.chunks 
      : chunkTextForEmbedding(
          doc.content,
          this.config.chunkSize,
          this.config.chunkOverlap
        );
    
    // Generate embeddings - use workers if available (off main thread)
    let vectors: number[][];
    
    if (useWorkers && typeof window !== 'undefined') {
      // Use Web Workers for parallel, non-blocking embedding
      console.log(`[EmbeddingEngine] Using Web Workers for ${chunks.length} chunks`);
      vectors = await this.embedTextsParallel(chunks, onProgress);
    } else {
      // Fallback to main thread embedding
      console.log(`[EmbeddingEngine] Using main thread for ${chunks.length} chunks`);
      vectors = await this.embedTexts(chunks, false);
    }
    
    const endTime = performance.now();
    
    return {
      vectors,
      chunks,
      metadata: {
        model: E5_CONFIG.MODEL_ID,
        dimension: E5_CONFIG.DIMENSION,
        processingTimeMs: Math.round(endTime - startTime),
        chunkCount: chunks.length,
      },
    };
  }
  
  /**
   * Generate a query embedding (uses "query: " prefix)
   */
  async embedQuery(query: string): Promise<number[]> {
    return this.embedText(query, true);
  }
  
  /**
   * Find the most similar chunks to a query
   */
  async findSimilarChunks(
    queryEmbedding: number[],
    documentEmbeddings: { docId: string; chunkIndex: number; vector: number[] }[],
    topK = 5
  ): Promise<{ docId: string; chunkIndex: number; score: number }[]> {
    const scored = documentEmbeddings.map(({ docId, chunkIndex, vector }) => ({
      docId,
      chunkIndex,
      score: cosineSimilarity(queryEmbedding, vector),
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, topK);
  }
  
  /**
   * Get model configuration
   */
  getConfig() {
    return {
      model: E5_CONFIG.MODEL_ID,
      dimension: E5_CONFIG.DIMENSION,
      maxSequenceLength: E5_CONFIG.MAX_SEQUENCE_LENGTH,
      ...this.config,
    };
  }
  
  /**
   * Check if WebGPU is available for acceleration
   */
  static async isWebGPUAvailable(): Promise<boolean> {
    if (typeof navigator === 'undefined') return false;
    return 'gpu' in navigator && !!(await (navigator as any).gpu?.requestAdapter());
  }
}

// Export singleton instance for convenience
export const embeddingEngine = new EmbeddingEngine();

// Export config for reference
export { E5_CONFIG };

export default EmbeddingEngine;
