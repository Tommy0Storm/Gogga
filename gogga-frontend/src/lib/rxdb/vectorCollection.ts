/**
 * GOGGA RxDB Vector Collection
 * Persistent vector embeddings with Distance-to-Samples indexing
 *
 * Uses 5 pre-computed sample vectors to create indexes for fast similarity search
 * Query time: ~88ms vs ~765ms for full scan (>8x faster)
 *
 * Algorithm:
 * 1. Pre-compute 5 sample vectors from diverse documents
 * 2. For each new embedding, calculate distance to all 5 samples
 * 3. Store distances as fixed-length strings (sortable in IndexedDB)
 * 4. Query by finding similar index values, then rank by actual similarity
 */

import {
  euclideanDistance,
  cosineSimilarity,
  manhattanDistance,
} from 'rxdb/plugins/vector';
import { sortByObjectNumberProperty } from 'rxdb/plugins/core';
import { getDatabase, generateId } from './database';
import {
  batchArray,
  PROMISE_RESOLVE_TRUE,
  arrayFilterNotEmpty,
} from './performanceUtils';
import type {
  VectorEmbeddingDoc,
  VectorEmbeddingCollection,
  VectorEmbeddingDocument,
} from './schemas';

// E5-small-v2 dimension
const EMBEDDING_DIMENSION = 384;

// Number of sample vectors for Distance-to-Samples indexing
const NUM_SAMPLE_VECTORS = 5;

// Sample vectors storage key
const SAMPLE_VECTORS_KEY = 'gogga_sample_vectors';

// Index value precision (10 chars for IndexedDB sorting)
const INDEX_VALUE_LENGTH = 10;

// Cached sample vectors
let sampleVectors: number[][] | null = null;

/**
 * Convert a distance value to a fixed-length string for IndexedDB indexing
 * Uses exponential notation to handle the range of possible values
 */
function distanceToIndexString(distance: number): string {
  // Clamp distance to reasonable range
  const clamped = Math.max(0, Math.min(distance, 999999.99));

  // Convert to fixed-width string (pad with zeros)
  const normalized = clamped.toFixed(4);
  return normalized.padStart(INDEX_VALUE_LENGTH, '0');
}

/**
 * Parse index string back to distance
 */
function indexStringToDistance(indexStr: string): number {
  return parseFloat(indexStr);
}

/**
 * Generate initial sample vectors using random unit vectors
 * These are used when no documents exist yet
 */
function generateRandomSampleVectors(): number[][] {
  return Array.from({ length: NUM_SAMPLE_VECTORS }, () => {
    // Generate random unit vector
    const vec = Array.from(
      { length: EMBEDDING_DIMENSION },
      () => (Math.random() - 0.5) * 2
    );

    // Normalize to unit length
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return vec.map((v) => v / norm);
  });
}

/**
 * Get or create sample vectors for Distance-to-Samples indexing
 * Sample vectors are stored in localStorage for persistence
 */
export async function getSampleVectors(): Promise<number[][]> {
  // Return cached vectors
  if (sampleVectors) return sampleVectors;

  // Try to load from localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(SAMPLE_VECTORS_KEY);
    if (stored) {
      try {
        sampleVectors = JSON.parse(stored);
        if (sampleVectors && sampleVectors.length === NUM_SAMPLE_VECTORS) {
          return sampleVectors;
        }
      } catch {
        // Invalid stored data, regenerate
      }
    }
  }

  // Generate new sample vectors
  sampleVectors = await generateOptimalSampleVectors();

  // Store in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(SAMPLE_VECTORS_KEY, JSON.stringify(sampleVectors));
  }

  return sampleVectors;
}

/**
 * Generate optimal sample vectors from existing embeddings
 * Uses k-means++ style initialization for diverse samples
 */
async function generateOptimalSampleVectors(): Promise<number[][]> {
  const db = await getDatabase();
  const existingVectors = await db.vectorEmbeddings.find().exec();

  // If not enough existing vectors, use random
  if (existingVectors.length < NUM_SAMPLE_VECTORS * 3) {
    console.log(
      '[VectorCollection] Not enough existing vectors, using random samples'
    );
    return generateRandomSampleVectors();
  }

  // Use k-means++ style selection for diverse samples
  const samples: number[][] = [];
  // Convert DeepReadonlyArray to mutable number[]
  const available: number[][] = existingVectors
    .map((doc) => [...doc.embedding])
    .filter((v): v is number[] => v.length === EMBEDDING_DIMENSION);

  if (available.length === 0) {
    return generateRandomSampleVectors();
  }

  // First sample: random
  const firstIdx = Math.floor(Math.random() * available.length);
  const firstVec = available[firstIdx];
  if (firstVec) {
    samples.push(firstVec);
  }

  // Subsequent samples: choose point furthest from existing samples
  while (
    samples.length < NUM_SAMPLE_VECTORS &&
    samples.length < available.length
  ) {
    let maxMinDist = -1;
    let bestIdx = 0;

    for (let i = 0; i < available.length; i++) {
      const vec = available[i];
      if (!vec) continue;

      // Find minimum distance to any existing sample
      const minDist = Math.min(
        ...samples.map((sample) => euclideanDistance(vec, sample))
      );

      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        bestIdx = i;
      }
    }

    const bestVec = available[bestIdx];
    if (bestVec) {
      samples.push(bestVec);
    }
  }

  // Pad with random vectors if needed
  while (samples.length < NUM_SAMPLE_VECTORS) {
    const randomVecs = generateRandomSampleVectors();
    const needed = NUM_SAMPLE_VECTORS - samples.length;
    samples.push(...randomVecs.slice(0, needed));
  }

  console.log('[VectorCollection] Generated optimal sample vectors');
  return samples;
}

/**
 * Calculate index values for a new embedding
 */
export async function calculateIndexValues(
  embedding: number[]
): Promise<{
  idx0: string;
  idx1: string;
  idx2: string;
  idx3: string;
  idx4: string;
}> {
  const samples = await getSampleVectors();

  // Helper to safely get sample vector
  const getSample = (idx: number): number[] => {
    const sample = samples[idx];
    if (!sample) throw new Error(`Sample vector ${idx} not found`);
    return sample;
  };

  return {
    idx0: distanceToIndexString(euclideanDistance(embedding, getSample(0))),
    idx1: distanceToIndexString(euclideanDistance(embedding, getSample(1))),
    idx2: distanceToIndexString(euclideanDistance(embedding, getSample(2))),
    idx3: distanceToIndexString(euclideanDistance(embedding, getSample(3))),
    idx4: distanceToIndexString(euclideanDistance(embedding, getSample(4))),
  };
}

/**
 * Store a vector embedding with index values
 */
export async function storeVectorEmbedding(
  documentId: string,
  chunkIndex: number,
  sessionId: string,
  text: string,
  embedding: number[]
): Promise<string> {
  const db = await getDatabase();

  // Calculate index values
  const indexValues = await calculateIndexValues(embedding);

  const doc: VectorEmbeddingDoc = {
    id: generateId(),
    documentId,
    chunkIndex,
    sessionId,
    text,
    embedding,
    ...indexValues,
    createdAt: new Date().toISOString(),
  };

  await db.vectorEmbeddings.insert(doc);
  return doc.id;
}

/**
 * Store multiple vector embeddings in bulk
 */
export async function storeVectorEmbeddingsBulk(
  embeddings: Array<{
    documentId: string;
    chunkIndex: number;
    sessionId: string;
    text: string;
    embedding: number[];
  }>
): Promise<string[]> {
  const db = await getDatabase();
  const samples = await getSampleVectors();

  // Helper to safely get sample vector
  const getSample = (idx: number): number[] => {
    const sample = samples[idx];
    if (!sample) throw new Error(`Sample vector ${idx} not found`);
    return sample;
  };

  const docs: VectorEmbeddingDoc[] = embeddings.map((item) => {
    const indexValues = {
      idx0: distanceToIndexString(
        euclideanDistance(item.embedding, getSample(0))
      ),
      idx1: distanceToIndexString(
        euclideanDistance(item.embedding, getSample(1))
      ),
      idx2: distanceToIndexString(
        euclideanDistance(item.embedding, getSample(2))
      ),
      idx3: distanceToIndexString(
        euclideanDistance(item.embedding, getSample(3))
      ),
      idx4: distanceToIndexString(
        euclideanDistance(item.embedding, getSample(4))
      ),
    };

    return {
      id: generateId(),
      documentId: item.documentId,
      chunkIndex: item.chunkIndex,
      sessionId: item.sessionId,
      text: item.text,
      embedding: item.embedding,
      ...indexValues,
      createdAt: new Date().toISOString(),
    };
  });

  await db.vectorEmbeddings.bulkInsert(docs);
  return docs.map((d) => d.id);
}

/**
 * Find similar vectors using Distance-to-Samples index
 * Much faster than full scan for large collections
 */
export async function findSimilarVectors(
  queryEmbedding: number[],
  topK: number = 5,
  sessionId?: string,
  threshold: number = 0.5
): Promise<
  Array<{
    id: string;
    documentId: string;
    chunkIndex: number;
    text: string;
    score: number;
  }>
> {
  const db = await getDatabase();
  const samples = await getSampleVectors();

  // Calculate query's distance to samples
  const queryDistances = samples.map((sample) =>
    euclideanDistance(queryEmbedding, sample)
  );

  // Define search ranges (±tolerance for each index)
  const tolerance = 2.0; // Adjust based on your data distribution

  // Build query with index ranges
  let query = db.vectorEmbeddings.find();

  // Optionally filter by session
  if (sessionId) {
    query = query.where('sessionId').eq(sessionId);
  }

  // Get candidates using first index as primary filter
  const firstDistance = queryDistances[0] ?? 0;
  const idx0Min = distanceToIndexString(Math.max(0, firstDistance - tolerance));
  const idx0Max = distanceToIndexString(firstDistance + tolerance);

  const candidates = await db.vectorEmbeddings
    .find({
      selector: {
        idx0: {
          $gte: idx0Min,
          $lte: idx0Max,
        },
        ...(sessionId ? { sessionId } : {}),
      },
    })
    .exec();

  // Calculate actual similarity for candidates
  const results = candidates.map((doc) => {
    // Convert DeepReadonlyArray to mutable array for safe indexing
    const embedding = [...doc.embedding];

    // Cosine similarity (vectors are normalized by E5)
    const dotProduct = queryEmbedding.reduce(
      (sum, a, i) => sum + a * (embedding[i] ?? 0),
      0
    );

    return {
      id: doc.id,
      documentId: doc.documentId,
      chunkIndex: doc.chunkIndex,
      text: doc.text,
      score: dotProduct, // Cosine similarity
    };
  });

  // Filter by threshold and sort by score
  return results
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Find all vectors for a document
 */
export async function getVectorsForDocument(
  documentId: string
): Promise<VectorEmbeddingDoc[]> {
  const db = await getDatabase();
  const docs = await db.vectorEmbeddings
    .find({
      selector: { documentId },
    })
    .exec();

  // Convert DeepReadonlyObject to mutable VectorEmbeddingDoc
  return docs.map((d) => {
    const json = d.toJSON();
    return {
      ...json,
      embedding: [...json.embedding],
    } as VectorEmbeddingDoc;
  });
}

/**
 * Delete vectors for a document
 * Uses bulkRemove for better performance
 */
export async function deleteVectorsForDocument(
  documentId: string
): Promise<number> {
  const db = await getDatabase();
  const vectors = await db.vectorEmbeddings
    .find({
      selector: { documentId },
    })
    .exec();

  if (vectors.length === 0) return 0;

  const ids = vectors.map((v) => v.id);
  await db.vectorEmbeddings.bulkRemove(ids);
  return vectors.length;
}

/**
 * Delete vectors for a session
 * Uses bulkRemove for better performance
 */
export async function deleteVectorsForSession(
  sessionId: string
): Promise<number> {
  const db = await getDatabase();
  const vectors = await db.vectorEmbeddings
    .find({
      selector: { sessionId },
    })
    .exec();

  if (vectors.length === 0) return 0;

  const ids = vectors.map((v) => v.id);
  await db.vectorEmbeddings.bulkRemove(ids);
  return vectors.length;
}

/**
 * Get vector statistics
 */
export async function getVectorStats(): Promise<{
  totalVectors: number;
  totalDocuments: number;
  vectorsBySession: Map<string, number>;
  averageVectorsPerDoc: number;
}> {
  const db = await getDatabase();
  const allVectors = await db.vectorEmbeddings.find().exec();

  const documentIds = new Set(allVectors.map((v) => v.documentId));
  const sessionCounts = new Map<string, number>();

  for (const vec of allVectors) {
    const count = sessionCounts.get(vec.sessionId) || 0;
    sessionCounts.set(vec.sessionId, count + 1);
  }

  return {
    totalVectors: allVectors.length,
    totalDocuments: documentIds.size,
    vectorsBySession: sessionCounts,
    averageVectorsPerDoc:
      documentIds.size > 0 ? allVectors.length / documentIds.size : 0,
  };
}

/**
 * Check if vectors exist for a document
 */
export async function hasVectorsForDocument(
  documentId: string
): Promise<boolean> {
  const db = await getDatabase();
  const count = await db.vectorEmbeddings
    .count({
      selector: { documentId },
    })
    .exec();
  return count > 0;
}

/**
 * Recalculate sample vectors based on current data
 * Should be called periodically or when data distribution changes significantly
 */
export async function recalibrateSampleVectors(): Promise<void> {
  // Clear cached samples
  sampleVectors = null;

  // Clear stored samples
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SAMPLE_VECTORS_KEY);
  }

  // Regenerate
  sampleVectors = await generateOptimalSampleVectors();

  // Store new samples
  if (typeof window !== 'undefined') {
    localStorage.setItem(SAMPLE_VECTORS_KEY, JSON.stringify(sampleVectors));
  }

  console.log('[VectorCollection] Sample vectors recalibrated');

  // Note: Existing vectors will use old index values until re-indexed
  // For a full re-index, use reindexAllVectors()
}

/**
 * Re-index all vectors with current sample vectors
 * Use after recalibrating sample vectors
 *
 * Performance: Uses batchArray and requestIdlePromise to avoid UI blocking
 */
export async function reindexAllVectors(): Promise<number> {
  const db = await getDatabase();
  const samples = await getSampleVectors();

  // Helper to safely get sample vector
  const getSample = (idx: number): number[] => {
    const sample = samples[idx];
    if (!sample) throw new Error(`Sample vector ${idx} not found`);
    return sample;
  };

  const allVectors = await db.vectorEmbeddings.find().exec();
  let count = 0;

  // Process in batches to avoid UI blocking
  const batches = batchArray(allVectors, 20);

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (vec) => {
        // Convert DeepReadonlyArray to mutable array
        const embedding = [...vec.embedding];

        const newIndexValues = {
          idx0: distanceToIndexString(
            euclideanDistance(embedding, getSample(0))
          ),
          idx1: distanceToIndexString(
            euclideanDistance(embedding, getSample(1))
          ),
          idx2: distanceToIndexString(
            euclideanDistance(embedding, getSample(2))
          ),
          idx3: distanceToIndexString(
            euclideanDistance(embedding, getSample(3))
          ),
          idx4: distanceToIndexString(
            euclideanDistance(embedding, getSample(4))
          ),
        };

        await vec.patch(newIndexValues);
        count++;
      })
    );

    // Yield to browser between batches (imported from performanceUtils)
    try {
      const { requestIdlePromise } = await import('./performanceUtils');
      await requestIdlePromise(50);
    } catch {
      // performanceUtils not available, skip idle wait
    }
  }

  console.log(`[VectorCollection] Re-indexed ${count} vectors`);
  return count;
}

// ============================================================================
// Index Range Vector Search (Faster Alternative)
// ============================================================================

/**
 * Find similar vectors using index range queries
 * Much faster than full scan (~88ms vs ~765ms) at slight precision cost
 *
 * Algorithm: For each sample vector, query documents within an index range
 * based on the query embedding's distance to that sample.
 *
 * @param queryEmbedding - The query embedding vector
 * @param topK - Maximum results to return (default 10)
 * @param sessionId - Optional session filter
 * @param indexDistance - Range multiplier (lower = faster, less precise, default 0.003)
 */
export async function vectorSearchIndexRange(
  queryEmbedding: number[],
  topK: number = 10,
  sessionId?: string,
  indexDistance: number = 0.003
): Promise<{
  results: Array<{
    id: string;
    documentId: string;
    chunkIndex: number;
    text: string;
    score: number;
  }>;
  docReads: number;
}> {
  const db = await getDatabase();
  const samples = await getSampleVectors();

  // Calculate query's distance to each sample
  const queryDistances = samples.map((sample) =>
    euclideanDistance(queryEmbedding, sample)
  );

  // Collect candidate documents from all index ranges
  const candidates = new Set<VectorEmbeddingDocument>();
  let docReads = 0;

  await Promise.all(
    queryDistances.map(async (distance, i) => {
      const range = distance * indexDistance;
      const minIndex = distanceToIndexString(Math.max(0, distance - range));
      const maxIndex = distanceToIndexString(distance + range);

      const indexField = `idx${i}` as
        | 'idx0'
        | 'idx1'
        | 'idx2'
        | 'idx3'
        | 'idx4';

      const docs = await db.vectorEmbeddings
        .find({
          selector: {
            [indexField]: {
              $gt: minIndex,
              $lt: maxIndex,
            },
            ...(sessionId ? { sessionId } : {}),
          },
          sort: [{ [indexField]: 'asc' }],
        })
        .exec();

      docs.forEach((d) => candidates.add(d));
      docReads += docs.length;
    })
  );

  // Calculate actual distances/similarities for all candidates
  const docsWithDistance = Array.from(candidates).map((doc) => {
    const embedding = [...doc.embedding];
    const distance = euclideanDistance(embedding, queryEmbedding);
    // Convert distance to similarity score (closer = higher score)
    const score = 1 / (1 + distance);

    return {
      id: doc.id,
      documentId: doc.documentId,
      chunkIndex: doc.chunkIndex,
      text: doc.text,
      score,
      distance,
    };
  });

  // Sort by distance (ascending) and take top K
  const sorted = docsWithDistance
    .sort(sortByObjectNumberProperty('distance'))
    .slice(0, topK)
    .map(({ distance: _d, ...rest }) => rest); // Remove distance from result

  return {
    results: sorted,
    docReads,
  };
}

/**
 * Find similar vectors using index similarity (both directions)
 * Queries a fixed number of documents per index side
 * More predictable read count than index range
 *
 * @param queryEmbedding - The query embedding vector
 * @param docsPerIndexSide - Docs to fetch per direction per index (default 50)
 * @param topK - Maximum results to return (default 10)
 * @param sessionId - Optional session filter
 */
export async function vectorSearchIndexSimilarity(
  queryEmbedding: number[],
  docsPerIndexSide: number = 50,
  topK: number = 10,
  sessionId?: string
): Promise<{
  results: Array<{
    id: string;
    documentId: string;
    chunkIndex: number;
    text: string;
    score: number;
  }>;
  docReads: number;
}> {
  const db = await getDatabase();
  const samples = await getSampleVectors();

  // Calculate query's distance to each sample
  const queryDistances = samples.map((sample) =>
    euclideanDistance(queryEmbedding, sample)
  );

  const candidates = new Set<VectorEmbeddingDocument>();
  let docReads = 0;

  // For each index, fetch docs in both ascending and descending order
  await Promise.all(
    queryDistances.flatMap((distance, i) => {
      const targetIndex = distanceToIndexString(distance);
      const indexField = `idx${i}` as
        | 'idx0'
        | 'idx1'
        | 'idx2'
        | 'idx3'
        | 'idx4';

      return [
        // Ascending (docs with larger index values)
        db.vectorEmbeddings
          .find({
            selector: {
              [indexField]: { $gte: targetIndex },
              ...(sessionId ? { sessionId } : {}),
            },
            sort: [{ [indexField]: 'asc' }],
            limit: docsPerIndexSide,
          })
          .exec()
          .then((docs) => {
            docs.forEach((d) => candidates.add(d));
            docReads += docs.length;
          }),
        // Descending (docs with smaller index values)
        // Note: RxDB descending sort can be slower with IndexedDB
        db.vectorEmbeddings
          .find({
            selector: {
              [indexField]: { $lte: targetIndex },
              ...(sessionId ? { sessionId } : {}),
            },
            sort: [{ [indexField]: 'desc' }],
            limit: docsPerIndexSide,
          })
          .exec()
          .then((docs) => {
            docs.forEach((d) => candidates.add(d));
            docReads += docs.length;
          }),
      ];
    })
  );

  // Calculate actual distances for candidates
  const docsWithDistance = Array.from(candidates).map((doc) => {
    const embedding = [...doc.embedding];
    const distance = euclideanDistance(embedding, queryEmbedding);
    const score = 1 / (1 + distance);

    return {
      id: doc.id,
      documentId: doc.documentId,
      chunkIndex: doc.chunkIndex,
      text: doc.text,
      score,
      distance,
    };
  });

  const sorted = docsWithDistance
    .sort(sortByObjectNumberProperty('distance'))
    .slice(0, topK)
    .map(({ distance: _d, ...rest }) => rest);

  return {
    results: sorted,
    docReads,
  };
}

/**
 * Full table scan search (baseline for comparison)
 * Slower but guarantees optimal results
 *
 * @param queryEmbedding - The query embedding vector
 * @param topK - Maximum results to return (default 10)
 * @param sessionId - Optional session filter
 * @param useCosineSimilarity - Use cosine similarity instead of euclidean distance
 */
export async function vectorSearchFullScan(
  queryEmbedding: number[],
  topK: number = 10,
  sessionId?: string,
  useCosineSimilarity: boolean = true
): Promise<{
  results: Array<{
    id: string;
    documentId: string;
    chunkIndex: number;
    text: string;
    score: number;
  }>;
  docReads: number;
}> {
  const db = await getDatabase();

  // Fetch all candidates (optionally filtered by session)
  const candidates = await db.vectorEmbeddings
    .find({
      selector: sessionId ? { sessionId } : {},
    })
    .exec();

  // Calculate similarity for each
  const withScores = candidates.map((doc) => {
    const embedding = [...doc.embedding];

    let score: number;
    if (useCosineSimilarity) {
      score = cosineSimilarity(queryEmbedding, embedding);
    } else {
      // Convert distance to similarity
      const distance = euclideanDistance(queryEmbedding, embedding);
      score = 1 / (1 + distance);
    }

    return {
      id: doc.id,
      documentId: doc.documentId,
      chunkIndex: doc.chunkIndex,
      text: doc.text,
      score,
    };
  });

  // Sort by score (descending for similarity)
  const sorted = withScores.sort((a, b) => b.score - a.score).slice(0, topK);

  return {
    results: sorted,
    docReads: candidates.length,
  };
}

// Re-export vector utilities for convenience
export {
  euclideanDistance,
  cosineSimilarity,
  manhattanDistance,
  sortByObjectNumberProperty,
};
