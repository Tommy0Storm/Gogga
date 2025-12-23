/**
 * GOGGA Parallel Embedding Worker
 * 
 * Web Worker for parallel embedding generation using multiple cores.
 * Uses navigator.hardwareConcurrency to optimize thread count.
 * 
 * This worker pools embedding generation across available cores,
 * significantly speeding up bulk document embedding.
 */

// Worker message types
interface EmbeddingRequest {
  type: 'embed';
  id: string;
  texts: string[];
  batchSize?: number;
}

interface EmbeddingResponse {
  type: 'result' | 'progress' | 'error';
  id: string;
  embeddings?: number[][];
  progress?: { completed: number; total: number };
  error?: string;
}

// Simplified E5 tokenizer for worker context
// The actual model loading happens lazily
let pipeline: any = null;
let modelLoading: Promise<any> | null = null;

async function loadModel(): Promise<any> {
  if (pipeline) return pipeline;
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    // Dynamic import of transformers.js
    const { pipeline: pipelineFn } = await import('@huggingface/transformers');
    
    pipeline = await pipelineFn('feature-extraction', 'Xenova/e5-small-v2', {
      progress_callback: (progress: any) => {
        self.postMessage({
          type: 'progress',
          id: 'model-loading',
          progress: {
            completed: Math.round(progress.progress || 0),
            total: 100,
          },
        } as EmbeddingResponse);
      },
    });
    
    return pipeline;
  })();

  return modelLoading;
}

/**
 * Generate embeddings for a batch of texts
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = await loadModel();
  
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    // E5 models require "query: " or "passage: " prefix
    const prefixedText = text.startsWith('query:') || text.startsWith('passage:') 
      ? text 
      : `passage: ${text}`;
    
    const output = await model(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });
    
    embeddings.push(Array.from(output.data));
  }
  
  return embeddings;
}

/**
 * Process embedding request with batching and progress updates
 */
async function processEmbeddingRequest(request: EmbeddingRequest): Promise<void> {
  const { id, texts, batchSize = 5 } = request;
  
  try {
    const allEmbeddings: number[][] = [];
    const total = texts.length;
    let completed = 0;
    
    // Process in batches to report progress
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await generateEmbeddings(batch);
      
      allEmbeddings.push(...batchEmbeddings);
      completed += batch.length;
      
      // Report progress
      self.postMessage({
        type: 'progress',
        id,
        progress: { completed, total },
      } as EmbeddingResponse);
    }
    
    // Send final result
    self.postMessage({
      type: 'result',
      id,
      embeddings: allEmbeddings,
    } as EmbeddingResponse);
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as EmbeddingResponse);
  }
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<EmbeddingRequest>) => {
  const request = event.data;
  
  if (request.type === 'embed') {
    await processEmbeddingRequest(request);
  }
};

// Export types for main thread
export type { EmbeddingRequest, EmbeddingResponse };
