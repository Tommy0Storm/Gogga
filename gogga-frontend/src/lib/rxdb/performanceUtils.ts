/**
 * GOGGA RxDB Performance Utilities
 * 
 * Re-exports useful performance utilities from RxDB's internal utils.
 * These are battle-tested utilities used throughout RxDB for optimal performance.
 * 
 * @see https://github.com/pubkey/rxdb/tree/master/src/plugins/utils
 */

// Vector similarity functions (from rxdb/plugins/vector)
export {
  cosineSimilarity,
  euclideanDistance,
  manhattanDistance,
  jaccardSimilarity,
} from 'rxdb/plugins/vector';

// Promise utilities - for async performance optimization
export {
  // Resolves on next tick - useful for yielding to event loop
  nextTick,
  // Wait for specified milliseconds
  promiseWait,
  // Pre-resolved promises for better performance (avoids creating new Promise objects)
  PROMISE_RESOLVE_TRUE,
  PROMISE_RESOLVE_FALSE,
  PROMISE_RESOLVE_NULL,
  PROMISE_RESOLVE_VOID,
  // Request idle callback wrapper - runs when browser is idle
  requestIdlePromise,
  requestIdlePromiseNoQueue,
  requestIdleCallbackIfAvailable,
  // Run promises in series instead of parallel
  promiseSeries,
  // Check if value is a promise
  isPromise,
  // Convert value to promise
  toPromise,
} from 'rxdb/plugins/utils';

// Array utilities - for efficient array operations
export {
  // Split array into batches for chunked processing
  batchArray,
  // Get last element without modifying array
  lastOfArray,
  // Shuffle array (Fisher-Yates)
  shuffleArray,
  // Get random element from array
  randomOfArray,
  // Convert single item or array to array
  toArray,
  // Remove one matching item from array
  removeOneFromArrayIfMatches,
  // Check if any item in ar1 exists in ar2
  isOneItemOfArrayInOtherArray,
  // Filter out null/undefined values with proper typing
  arrayFilterNotEmpty,
  // Count items from start until condition fails
  countUntilNotMatching,
  // Async filter function
  asyncFilter,
  // Sum all numbers in array
  sumNumberArray,
} from 'rxdb/plugins/utils';

// Object utilities - for efficient object operations
export {
  // Fast deep clone
  clone,
  // Shallow clone (faster than deep clone when sufficient)
  flatClone,
  // Deep equal comparison
  deepEqual,
  // Check if object has own property
  hasProperty,
  // Get/set nested object properties
  getProperty,
  setProperty,
} from 'rxdb/plugins/utils';

// String utilities
export {
  // Generate random string (alphanumeric)
  randomToken,
  // Uppercase first letter
  ucfirst,
} from 'rxdb/plugins/utils';

// Hash utilities
export {
  // Default SHA256 hash function
  defaultHashSha256,
  // Fast string hash (for non-crypto purposes)
  hashStringToNumber,
} from 'rxdb/plugins/utils';

// Other utilities
export {
  // Run function X times
  runXTimes,
  // Assert value is not null/undefined/false
  ensureNotFalsy,
  // Assert value is integer
  ensureInteger,
  // RxJS shareReplay defaults for proper cleanup
  RXJS_SHARE_REPLAY_DEFAULTS,
} from 'rxdb/plugins/utils';

// Time utilities
export {
  // Get current timestamp (high precision)
  now,
} from 'rxdb/plugins/utils';

/**
 * Performance best practices from RxDB:
 * 
 * 1. Use pre-resolved promises (PROMISE_RESOLVE_*) instead of Promise.resolve()
 *    - Avoids creating new Promise objects each time
 * 
 * 2. Use batchArray() for chunked processing of large arrays
 *    - Prevents blocking the main thread
 *    - Allows UI updates between batches
 * 
 * 3. Use requestIdlePromise() for non-urgent operations
 *    - Runs when browser is idle
 *    - Doesn't block user interactions
 * 
 * 4. Use flatClone() instead of clone() when deep cloning isn't needed
 *    - Much faster for shallow objects
 * 
 * 5. Use promiseSeries() when order matters and parallel isn't needed
 *    - Avoids overwhelming resources
 *    - Better error handling
 * 
 * 6. Use arrayFilterNotEmpty() to filter null/undefined with proper TypeScript types
 *    - Cleaner than manual filtering
 *    - Proper type narrowing
 */

// Re-export as a namespace for convenient access
export const RxDBPerf = {
  // Common patterns
  async processInBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>,
    yieldBetweenBatches = true
  ): Promise<R[]> {
    const { batchArray, requestIdlePromise } = await import('rxdb/plugins/utils');
    const batches = batchArray(items, batchSize);
    const results: R[] = [];
    
    for (const batch of batches) {
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      if (yieldBetweenBatches) {
        await requestIdlePromise(100); // Yield with 100ms timeout
      }
    }
    
    return results;
  },

  /**
   * Run a function when the browser is idle, with a timeout fallback
   */
  async runWhenIdle<T>(fn: () => T | Promise<T>, timeout = 5000): Promise<T> {
    const { requestIdlePromise } = await import('rxdb/plugins/utils');
    await requestIdlePromise(timeout);
    return fn();
  },

  /**
   * Debounced batch processor - collects items and processes them in batches
   */
  createBatchProcessor<T, R>(
    processor: (items: T[]) => Promise<R[]>,
    options: {
      maxBatchSize?: number;
      maxWaitMs?: number;
    } = {}
  ): {
    add: (item: T) => Promise<R>;
    flush: () => Promise<void>;
  } {
    const { maxBatchSize = 50, maxWaitMs = 100 } = options;
    const pending: Array<{ item: T; resolve: (r: R) => void; reject: (e: Error) => void }> = [];
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;

    const flush = async () => {
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
      
      if (pending.length === 0) return;
      
      const batch = pending.splice(0, maxBatchSize);
      try {
        const results = await processor(batch.map(p => p.item));
        batch.forEach((p, i) => {
          const result = results[i];
          if (result !== undefined) {
            p.resolve(result);
          } else {
            p.reject(new Error('Processor returned undefined for item'));
          }
        });
      } catch (error) {
        batch.forEach(p => p.reject(error as Error));
      }
    };

    return {
      add: (item: T): Promise<R> => {
        return new Promise((resolve, reject) => {
          pending.push({ item, resolve, reject });
          
          if (pending.length >= maxBatchSize) {
            flush();
          } else if (!flushTimeout) {
            flushTimeout = setTimeout(flush, maxWaitMs);
          }
        });
      },
      flush,
    };
  },
};
