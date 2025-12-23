/**
 * GOGGA RAG Manager
 * Unified retrieval system supporting two modes:
 * - Basic (JIVE): Fast keyword-based context retrieval
 * - Semantic (JIGGA): Vector similarity with E5 embeddings
 * 
 * Session-Scoped RAG (v8):
 * - Documents belong to user's pool, not sessions
 * - Documents are ACTIVATED per session via activeSessions[]
 * - RAG retrieval ONLY returns docs where activeSessions.includes(sessionId)
 * - See docs/SESSION_SCOPED_RAG_DESIGN.md for architecture details
 * 
 * Features:
 * - RxDB-persisted embeddings (survives page refresh)
 * - Fast Distance-to-Samples vector search
 * - Tiered retrieval strategies
 * - Metrics emission for JIGGA analytics
 */

import { EmbeddingEngine, cosineSimilarity, chunkTextForEmbedding } from './embeddingEngine';
import { emitMetric } from './ragMetrics';
import { batchArray, requestIdlePromise, arrayFilterNotEmpty } from './rxdb/performanceUtils';
import {
  hasVectorsForDocument,
  getVectorsForDocument,
  storeVectorEmbeddingsBulk,
  findSimilarVectors,
  vectorSearchIndexSimilarity,
} from './rxdb/vectorCollection';
import type { Document } from './db';

// RAG operation modes
export type RagMode = 'basic' | 'semantic';

// Result types
export interface BasicRetrievalResult {
  mode: 'basic';
  documents: Document[];
  totalDocs: number;
  latencyMs: number;
}

export interface SemanticRetrievalResult {
  mode: 'semantic';
  chunks: SemanticChunk[];
  totalChunks: number;
  averageScore: number;
  topScore: number;
  latencyMs: number;
}

export interface SemanticChunk {
  docId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  score: number;
}

export type RetrievalResult = BasicRetrievalResult | SemanticRetrievalResult;

// Embedding cache entry
interface EmbeddingCacheEntry {
  docId: string;
  vectors: number[][];
  chunks: string[];
  timestamp: number;
}

/**
 * RagManager - Handles document retrieval for JIVE and JIGGA tiers
 */
export class RagManager {
  private engine: EmbeddingEngine;
  private embeddingsCache: Map<string, EmbeddingCacheEntry> = new Map();
  private documentsBySession: Map<string, Document[]> = new Map();
  private isInitialized = false;
  
  constructor(engine?: EmbeddingEngine) {
    this.engine = engine ?? new EmbeddingEngine();
  }
  
  /**
   * Initialize the embedding engine
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    await this.engine.init();
    this.isInitialized = true;
  }
  
  /**
   * Set documents for a conversation session
   * Session-Scoped RAG: Only sets docs that are ACTIVE in this session
   */
  setDocuments(sessionId: string, docs: Document[]): void {
    // Filter to only docs active in this session (defensive check)
    const activeDocs = docs.filter(doc => 
      doc.activeSessions?.includes(sessionId) ?? doc.sessionId === sessionId
    );
    this.documentsBySession.set(sessionId, activeDocs);
  }
  
  /**
   * Get documents for a session
   * Returns only docs where activeSessions includes this sessionId
   */
  getDocuments(sessionId: string): Document[] {
    const docs = this.documentsBySession.get(sessionId) ?? [];
    // Double-check filtering (invariant enforcement)
    return docs.filter(doc => 
      doc.activeSessions?.includes(sessionId) ?? doc.sessionId === sessionId
    );
  }
  
  /**
   * Add a document to a session (activates it for RAG)
   * Updates the document's activeSessions array
   */
  addDocument(sessionId: string, doc: Document): void {
    const docs = this.documentsBySession.get(sessionId) ?? [];
    // Avoid duplicates
    if (!docs.find(d => d.id === doc.id)) {
      // Ensure activeSessions includes this session
      if (!doc.activeSessions) {
        doc.activeSessions = [];
      }
      if (!doc.activeSessions.includes(sessionId)) {
        doc.activeSessions.push(sessionId);
      }
      docs.push(doc);
      this.documentsBySession.set(sessionId, docs);
    }
  }
  
  /**
   * Add external documents (from user's pool) to the current session's retrieval
   * Session-Scoped RAG: Activates docs from pool for this session
   * Used when user selects documents from "Document Pool" picker
   */
  addExternalDocuments(sessionId: string, docs: Document[]): void {
    for (const doc of docs) {
      // Activate document for this session
      if (!doc.activeSessions) {
        doc.activeSessions = [];
      }
      if (!doc.activeSessions.includes(sessionId)) {
        doc.activeSessions.push(sessionId);
      }
      this.addDocument(sessionId, doc);
    }
  }
  
  /**
   * Deactivate a document from a session (removes from RAG but keeps in pool)
   */
  deactivateDocument(sessionId: string, docId: string): void {
    const docs = this.documentsBySession.get(sessionId) ?? [];
    const doc = docs.find(d => d.id === docId);
    
    if (doc && doc.activeSessions) {
      // Remove session from activeSessions
      doc.activeSessions = doc.activeSessions.filter(id => id !== sessionId);
    }
    
    // Remove from session's document list
    this.documentsBySession.set(
      sessionId,
      docs.filter(d => d.id !== docId)
    );
    
    // Note: Embedding cache is kept (doc may be active in other sessions)
  }
  
  /**
   * Select documents within a single session using Set intersection
   * TypeScript 5.5: Uses Set.intersection() for efficient ID validation
   */
  selectDocumentsForSession(requestedIds: string[], sessionId: string): Document[] {
    const docs = this.getDocuments(sessionId);
    
    // Build sets for efficient intersection
    const requestedSet = new Set(requestedIds);
    const availableSet = new Set(docs.map(d => d.id).filter((id): id is string => id !== undefined));
    
    // TypeScript 5.5: Set.intersection method
    const validIds = requestedSet.intersection(availableSet);
    
    // Filter and return documents
    return docs.filter(doc => doc.id !== undefined && validIds.has(doc.id));
  }
  
  /**
   * Select documents across all sessions (JIGGA tier only)
   * TypeScript 5.5: Uses Set methods for cross-session selection
   */
  selectDocumentsAcrossSessions(requestedIds: string[]): Document[] {
    const requestedSet = new Set(requestedIds);
    const allDocs: Document[] = [];
    const seenIds = new Set<string>();
    
    // Collect all documents from all sessions (deduplicated)
    for (const docs of this.documentsBySession.values()) {
      for (const doc of docs) {
        if (doc.id !== undefined && !seenIds.has(doc.id)) {
          allDocs.push(doc);
          seenIds.add(doc.id);
        }
      }
    }
    
    // TypeScript 5.5: Set.intersection for efficient filtering
    const validIds = requestedSet.intersection(seenIds);
    
    return allDocs.filter(doc => doc.id !== undefined && validIds.has(doc.id));
  }
  
  /**
   * Remove a document from cache and session
   */
  removeDocument(docId: string, sessionId?: string): void {
    // Clear from embedding cache
    this.embeddingsCache.delete(docId);
    
    // Clear from session documents
    if (sessionId) {
      const docs = this.getDocuments(sessionId);
      this.documentsBySession.set(
        sessionId, 
        docs.filter(d => d.id !== docId)
      );
    } else {
      // Remove from all sessions
      for (const [sid, docs] of Array.from(this.documentsBySession.entries() as IterableIterator<[string, Document[]]>)) {
        this.documentsBySession.set(
          sid, 
          docs.filter((d: Document) => d.id !== docId)
        );
      }
    }
  }
  
  /**
   * Ensure embeddings are generated for all documents in a session
   * Called before semantic retrieval
   * 
   * Performance optimizations:
   * - RxDB-first lookup (survives page refresh)
   * - Batch processing with requestIdlePromise to avoid UI blocking
   * - Parallel embedding for uncached documents
   * - In-memory hot cache for fast re-retrieval within session
   */
  async ensureEmbeddings(sessionId: string): Promise<void> {
    console.log(`[RagManager] ensureEmbeddings for session ${sessionId}`);
    await this.init();
    
    const docs = this.getDocuments(sessionId);
    console.log(`[RagManager] ensureEmbeddings: ${docs.length} docs to process`);
    
    // Separate docs by where they have embeddings
    const needsGeneration: Document[] = [];
    const needsRxdbLoad: Document[] = [];
    
    for (const doc of docs) {
      if (!doc.id) continue;
      
      // 1. Check in-memory cache first (hot path)
      if (this.embeddingsCache.has(doc.id)) {
        console.log(`[RagManager] Memory cache HIT for doc ${doc.id} (${doc.filename})`);
        emitMetric({
          type: 'cache_hit',
          sessionId,
          docId: doc.id,
          value: {
            source: 'memory_cache',
            filename: doc.filename,
          },
        });
        continue;
      }
      
      // 2. Check RxDB for persisted embeddings
      const hasPersistedVectors = await hasVectorsForDocument(doc.id);
      
      if (hasPersistedVectors) {
        console.log(`[RagManager] RxDB cache HIT for doc ${doc.id} (${doc.filename})`);
        emitMetric({
          type: 'cache_hit',
          sessionId,
          docId: doc.id,
          value: {
            source: 'rxdb_cache',
            filename: doc.filename,
          },
        });
        needsRxdbLoad.push(doc);
      } else {
        // 3. No embeddings anywhere - needs generation
        needsGeneration.push(doc);
      }
    }
    
    // Load from RxDB into memory cache (fast, no generation needed)
    if (needsRxdbLoad.length > 0) {
      console.log(`[RagManager] Loading ${needsRxdbLoad.length} docs from RxDB cache`);
      
      await Promise.all(needsRxdbLoad.map(async (doc) => {
        if (!doc.id) return;
        
        try {
          const vectors = await getVectorsForDocument(doc.id);
          
          // Reconstruct cache entry from RxDB vectors
          this.embeddingsCache.set(doc.id, {
            docId: doc.id,
            vectors: vectors.map(v => [...v.embedding]),
            chunks: vectors.map(v => v.text),
            timestamp: Date.now(),
          });
          
          console.log(`[RagManager] Loaded ${vectors.length} vectors for doc ${doc.id} from RxDB`);
        } catch (error) {
          console.error(`[RagManager] Failed to load vectors for doc ${doc.id}:`, error);
          // Fall back to regeneration
          needsGeneration.push(doc);
        }
      }));
    }
    
    // Generate embeddings for docs that have none
    if (needsGeneration.length > 0) {
      console.log(`[RagManager] Generating embeddings for ${needsGeneration.length} uncached docs`);
      
      // Batch size: 3 docs at a time to balance parallelism and memory
      const batches = batchArray(needsGeneration, 3);
      
      for (const batch of batches) {
        // Process batch in parallel
        await Promise.all(batch.map(async (doc) => {
          if (!doc.id) return;
          
          console.log(`[RagManager] Generating embeddings for doc ${doc.id} (${doc.filename})...`);
          emitMetric({
            type: 'cache_miss',
            sessionId,
            docId: doc.id,
            value: {
              source: 'embedding_cache',
              filename: doc.filename,
            },
          });
          
          const startTime = performance.now();
          
          try {
            const result = await this.engine.generateDocumentEmbeddings(doc);
            console.log(`[RagManager] Generated ${result.chunks.length} chunks for doc ${doc.id}`);
            
            // Store in memory cache
            this.embeddingsCache.set(doc.id, {
              docId: doc.id,
              vectors: result.vectors,
              chunks: result.chunks,
              timestamp: Date.now(),
            });
            
            // Persist to RxDB for future page loads
            try {
              const embeddingsToStore = result.chunks.map((text, idx) => ({
                documentId: doc.id!,
                chunkIndex: idx,
                sessionId,
                text,
                embedding: result.vectors[idx] ?? [],
              }));
              
              await storeVectorEmbeddingsBulk(embeddingsToStore);
              console.log(`[RagManager] Persisted ${embeddingsToStore.length} vectors to RxDB for doc ${doc.id}`);
            } catch (persistError) {
              console.error(`[RagManager] Failed to persist vectors for doc ${doc.id}:`, persistError);
              // Non-fatal - memory cache still works
            }
            
            const latencyMs = performance.now() - startTime;
            
            // Emit embedding generation metric
            emitMetric({
              type: 'embedding_generated',
              sessionId,
              docId: doc.id,
              value: {
                chunkCount: result.chunks.length,
                dimension: result.metadata.dimension,
                latencyMs,
                persisted: true,
              },
            });
            
          } catch (error) {
            console.error(`[RagManager] Failed to generate embeddings for doc ${doc.id}:`, error);
            // Emit error metric
            emitMetric({
              type: 'error',
              sessionId,
              docId: doc.id,
              value: {
                operation: 'embedding_generation',
                message: error instanceof Error ? error.message : 'Unknown error',
                filename: doc.filename,
              },
            });
          }
        }));
        
        // Yield to browser between batches - 100ms minimum for complex embeddings
        await requestIdlePromise(100);
      }
    }
  }
  
  // ============================================================================
  // BASIC RETRIEVAL (JIVE Tier)
  // ============================================================================
  
  /**
   * Basic retrieval for JIVE tier
   * Uses keyword matching and recency - no embeddings required
   */
  async retrieveBasic(
    sessionId: string, 
    query: string, 
    topK = 3
  ): Promise<BasicRetrievalResult> {
    const startTime = performance.now();
    
    const docs = this.getDocuments(sessionId);
    
    if (docs.length === 0) {
      return {
        mode: 'basic',
        documents: [],
        totalDocs: 0,
        latencyMs: 0,
      };
    }
    
    // Tokenize query for matching
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    // Score each document
    const scored = docs.map(doc => {
      const content = (doc.content || '').toLowerCase();
      
      // Count keyword matches
      let keywordScore = 0;
      for (const token of queryTokens) {
        if (content.includes(token)) {
          keywordScore += 1;
        }
      }
      
      // Recency bonus (newer documents get slight boost)
      const recencyBonus = doc.createdAt 
        ? (new Date(doc.createdAt).getTime() / (1000 * 60 * 60 * 24)) * 0.001
        : 0;
      
      return {
        doc,
        score: keywordScore + recencyBonus,
      };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Take top K
    const topDocs = scored.slice(0, topK).map(s => s.doc);
    
    const latencyMs = performance.now() - startTime;
    
    // Emit retrieval metric
    emitMetric({
      type: 'retrieval',
      sessionId,
      value: {
        mode: 'basic',
        queryLength: query.length,
        docsRetrieved: topDocs.length,
        totalDocs: docs.length,
        latencyMs,
      },
    });
    
    return {
      mode: 'basic',
      documents: topDocs,
      totalDocs: docs.length,
      latencyMs,
    };
  }
  
  // ============================================================================
  // SEMANTIC RETRIEVAL (JIGGA Tier)
  // ============================================================================
  
  /**
   * Semantic retrieval for JIGGA tier
   * Uses E5 embeddings for vector similarity search
   */
  async retrieveSemantic(
    sessionId: string,
    query: string,
    topK = 5,
    scoreThreshold = 0.3
  ): Promise<SemanticRetrievalResult> {
    console.log(`[RagManager] retrieveSemantic called for session ${sessionId}, query length=${query.length}`);
    const startTime = performance.now();
    
    // Ensure embeddings are generated
    console.log('[RagManager] Ensuring embeddings...');
    await this.ensureEmbeddings(sessionId);
    console.log('[RagManager] Embeddings ready');
    
    const docs = this.getDocuments(sessionId);
    console.log(`[RagManager] Got ${docs.length} documents for session`);
    
    if (docs.length === 0) {
      console.log('[RagManager] No documents, returning empty result');
      return {
        mode: 'semantic',
        chunks: [],
        totalChunks: 0,
        averageScore: 0,
        topScore: 0,
        latencyMs: 0,
      };
    }
    
    // Generate query embedding
    console.log('[RagManager] Generating query embedding...');
    const queryEmbedding = await this.engine.embedQuery(query);
    console.log(`[RagManager] Query embedding generated, dimension=${queryEmbedding.length}`);
    
    // Collect all chunk embeddings with metadata
    const allChunks: Array<{
      docId: string;
      documentName: string;
      chunkIndex: number;
      text: string;
      vector: number[];
    }> = [];
    
    for (const doc of docs) {
      if (!doc.id) continue;
      
      const cached = this.embeddingsCache.get(doc.id);
      if (!cached) continue;
      
      for (let i = 0; i < cached.vectors.length; i++) {
        const chunkText = cached.chunks[i];
        const chunkVector = cached.vectors[i];
        if (!chunkText || !chunkVector) continue;
        
        allChunks.push({
          docId: doc.id,
          documentName: doc.filename,
          chunkIndex: i,
          text: chunkText,
          vector: chunkVector,
        });
      }
    }
    
    if (allChunks.length === 0) {
      return {
        mode: 'semantic',
        chunks: [],
        totalChunks: 0,
        averageScore: 0,
        topScore: 0,
        latencyMs: performance.now() - startTime,
      };
    }
    
    // Score all chunks against query
    const scored = allChunks.map(chunk => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.vector),
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Filter by threshold and take top K
    const filtered = scored
      .filter(c => c.score >= scoreThreshold)
      .slice(0, topK);
    
    // Calculate statistics
    const topScore = filtered.length > 0 ? (filtered[0]?.score ?? 0) : 0;
    const averageScore = filtered.length > 0
      ? filtered.reduce((sum, c) => sum + c.score, 0) / filtered.length
      : 0;
    
    const latencyMs = performance.now() - startTime;
    
    // Emit retrieval metric
    emitMetric({
      type: 'retrieval',
      sessionId,
      value: {
        mode: 'semantic',
        queryLength: query.length,
        chunksRetrieved: filtered.length,
        totalChunks: allChunks.length,
        topScore,
        averageScore,
        latencyMs,
      },
    });
    
    // Map to result format (without vector data)
    const resultChunks: SemanticChunk[] = filtered.map(c => ({
      docId: c.docId,
      documentName: c.documentName,
      chunkIndex: c.chunkIndex,
      text: c.text,
      score: c.score,
    }));
    
    return {
      mode: 'semantic',
      chunks: resultChunks,
      totalChunks: allChunks.length,
      averageScore,
      topScore,
      latencyMs,
    };
  }
  
  // ============================================================================
  // UNIFIED RETRIEVAL API
  // ============================================================================
  
  /**
   * Unified retrieval method - selects strategy based on mode
   */
  async retrieve(
    sessionId: string,
    query: string,
    mode: RagMode,
    options?: { topK?: number; scoreThreshold?: number }
  ): Promise<RetrievalResult> {
    if (mode === 'basic') {
      return this.retrieveBasic(sessionId, query, options?.topK ?? 3);
    } else {
      return this.retrieveSemantic(
        sessionId, 
        query, 
        options?.topK ?? 5,
        options?.scoreThreshold ?? 0.3
      );
    }
  }
  
  /**
   * Generate context string for LLM injection
   * Different formats for basic vs semantic mode
   * 
   * Format follows Session-Scoped RAG Design:
   * - Clear [DOCUMENT CONTEXT] delimiters
   * - Source attribution with filename
   * - Token budget aware
   */
  async getContextForLLM(
    sessionId: string,
    query: string,
    mode: RagMode,
    options?: { 
      topK?: number; 
      maxTokens?: number;
      authoritative?: boolean; // JIGGA only: strict document quoting
    }
  ): Promise<string | null> {
    const result = await this.retrieve(sessionId, query, mode, options);
    
    if (result.mode === 'basic') {
      // Basic mode (JIVE): concatenate document content with keyword matching
      const docs = result.documents;
      if (docs.length === 0) return null;
      
      const maxChars = (options?.maxTokens ?? 2000) * 4;
      let excerpts = '';
      let currentChars = 0;
      
      for (const doc of docs) {
        const snippet = doc.content?.slice(0, Math.floor(maxChars / docs.length)) ?? '';
        if (snippet.length > 0) {
          const entry = `\n---\nSource: ${doc.filename}\n"${snippet.trim()}"\n---`;
          if (currentChars + entry.length > maxChars) break;
          excerpts += entry;
          currentChars += entry.length;
        }
      }
      
      if (excerpts.trim().length === 0) return null;
      
      return `[DOCUMENT CONTEXT]\nThe following excerpts are from documents the user has uploaded. Use them to inform your response.\n${excerpts}\n[END DOCUMENT CONTEXT]`;
      
    } else {
      // Semantic mode (JIGGA): ranked chunks with relevance scores
      const chunks = result.chunks;
      if (chunks.length === 0) return null;
      
      const maxChars = (options?.maxTokens ?? 2500) * 4;
      let excerpts = '';
      let currentChars = 0;
      
      for (const chunk of chunks) {
        // Include relevance score for transparency
        const relevance = (chunk.score * 100).toFixed(0);
        const entry = `\n---\nSource: ${chunk.documentName} (relevance: ${relevance}%)\n"${chunk.text.trim()}"\n---`;
        
        if (currentChars + entry.length > maxChars) break;
        excerpts += entry;
        currentChars += entry.length;
      }
      
      if (excerpts.trim().length === 0) return null;
      
      // Different preamble for authoritative mode
      if (options?.authoritative) {
        return `[DOCUMENT CONTEXT - AUTHORITATIVE]\nAnswer ONLY using the following document excerpts. Quote directly when possible. If the answer is not in these excerpts, say "I don't have that information in your documents."\n${excerpts}\n[END DOCUMENT CONTEXT]`;
      }
      
      return `[DOCUMENT CONTEXT]\nThe following excerpts are from documents the user has uploaded. Use them to inform your response, but do not fabricate information beyond what is provided.\n${excerpts}\n[END DOCUMENT CONTEXT]`;
    }
  }
  
  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================
  
  /**
   * Clear embedding cache for a session
   */
  clearSessionCache(sessionId: string): void {
    const docs = this.getDocuments(sessionId);
    for (const doc of docs) {
      if (doc.id) {
        this.embeddingsCache.delete(doc.id);
      }
    }
    this.documentsBySession.delete(sessionId);
  }
  
  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.embeddingsCache.clear();
    this.documentsBySession.clear();
  }

  /**
   * Initialize semantic engine (E5 embedding engine)
   */
  async initializeSemanticEngine(): Promise<void> {
    const startTime = performance.now();
    await this.init();
    const loadTimeMs = performance.now() - startTime;
    
    // Emit model loaded metric
    emitMetric({
      type: 'embedding_generated',
      value: {
        event: 'model_loaded',
        loadTimeMs,
        backend: this.engine.getBackend?.() || 'wasm',
        dimension: 384,
      },
    });
  }

  /**
   * Get semantic engine status and cache stats
   */
  getStatus(): {
    initialized: boolean;
    backend: string;
    cachedSessions: number;
    totalCachedDocs: number;
  } {
    return {
      initialized: this.isInitialized,
      backend: this.engine.getBackend?.() || 'unknown',
      cachedSessions: this.documentsBySession.size,
      totalCachedDocs: this.embeddingsCache.size,
    };
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedDocuments: number;
    totalVectors: number;
    sessions: number;
    estimatedMemoryMB: number;
  } {
    let totalVectors = 0;
    let totalDimensions = 0;
    
    for (const entry of Array.from(this.embeddingsCache.values())) {
      totalVectors += entry.vectors.length;
      if (entry.vectors.length > 0 && entry.vectors[0]) {
        totalDimensions = entry.vectors[0].length;
      }
    }
    
    // Estimate memory: each float32 is 4 bytes
    const estimatedBytes = totalVectors * totalDimensions * 4;
    
    return {
      cachedDocuments: this.embeddingsCache.size,
      totalVectors,
      sessions: this.documentsBySession.size,
      estimatedMemoryMB: estimatedBytes / (1024 * 1024),
    };
  }
  
  /**
   * Get cached vectors for dashboard visualization
   * Returns up to maxVectors vectors from cached documents
   */
  getCachedVectors(maxVectors = 5): { 
    vectors: number[][]; 
    labels: string[];
    docIds: string[];
    isReal: boolean;
  } {
    const vectors: number[][] = [];
    const labels: string[] = [];
    const docIds: string[] = [];
    
    for (const [docId, entry] of Array.from(this.embeddingsCache.entries())) {
      if (vectors.length >= maxVectors) break;
      
      // Get first vector from each document
      const firstVector = entry.vectors[0];
      if (entry.vectors.length > 0 && firstVector) {
        vectors.push(firstVector);
        // Try to get document name
        for (const docs of Array.from(this.documentsBySession.values())) {
          const doc = docs.find(d => d.id === docId);
          if (doc) {
            labels.push(doc.filename || `Doc ${docId}`);
            break;
          }
        }
        if (labels.length < vectors.length) {
          labels.push(`Doc ${docId}`);
        }
        docIds.push(docId);
      }
    }
    
    return {
      vectors,
      labels,
      docIds,
      isReal: vectors.length > 0,
    };
  }
  
  /**
   * Reload embeddings for documents that need visualization in dashboard.
   * This regenerates embeddings for docs that have `hasEmbeddings=true` but
   * aren't in the in-memory cache (e.g., after page refresh).
   * 
   * @param docs - Documents to reload embeddings for (should have hasEmbeddings=true)
   * @param maxDocs - Maximum number of docs to reload (default 5 for performance)
   * @returns Promise with count of successfully loaded documents
   */
  async reloadEmbeddingsForDashboard(
    docs: Document[],
    maxDocs = 5
  ): Promise<{ loaded: number; failed: number }> {
    let loaded = 0;
    let failed = 0;
    
    // Filter to docs not already in cache, limit to maxDocs
    const docsToLoad = docs
      .filter(doc => doc.id && !this.embeddingsCache.has(doc.id))
      .slice(0, maxDocs);
    
    if (docsToLoad.length === 0) {
      console.log('[RagManager] reloadEmbeddingsForDashboard: All docs already cached');
      return { loaded: 0, failed: 0 };
    }
    
    console.log('[RagManager] Reloading embeddings for dashboard:', docsToLoad.length, 'docs');
    
    // Process in parallel for speed
    const results = await Promise.allSettled(
      docsToLoad.map(doc => this.preloadDocument(doc))
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        loaded++;
      } else {
        failed++;
      }
    }
    
    console.log('[RagManager] Dashboard embeddings reload complete:', { loaded, failed });
    return { loaded, failed };
  }

  /**
   * Check if the manager has any cached embeddings
   */
  hasEmbeddings(): boolean {
    return this.embeddingsCache.size > 0;
  }
  
  /**
   * Check if the manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Preload embeddings for a document (useful for background processing)
   * This is the preferred method for generating embeddings on document upload.
   * 
   * @param doc - The document to generate embeddings for
   * @returns Promise with embedding result info
   */
  async preloadDocument(doc: Document): Promise<{
    success: boolean;
    chunkCount: number;
    dimension: number;
    latencyMs: number;
    error?: string;
  }> {
    if (!doc.id) {
      console.warn('[RagManager] preloadDocument: Document has no ID');
      return { success: false, chunkCount: 0, dimension: 0, latencyMs: 0, error: 'Document has no ID' };
    }
    
    // Initialize engine if needed
    try {
      await this.init();
    } catch (initError) {
      const errorMsg = initError instanceof Error ? initError.message : 'Engine init failed';
      console.error('[RagManager] Failed to initialize engine:', errorMsg);
      emitMetric({
        type: 'error',
        sessionId: doc.sessionId,
        docId: doc.id,
        value: {
          operation: 'engine_init',
          message: errorMsg,
          filename: doc.filename,
        },
      });
      return { success: false, chunkCount: 0, dimension: 0, latencyMs: 0, error: errorMsg };
    }
    
    // Check if already cached
    if (this.embeddingsCache.has(doc.id)) {
      const cached = this.embeddingsCache.get(doc.id)!;
      console.log('[RagManager] preloadDocument: Using cached embeddings for', doc.filename);
      emitMetric({
        type: 'cache_hit',
        sessionId: doc.sessionId,
        docId: doc.id,
        value: {
          source: 'preload_cache',
          filename: doc.filename,
          chunkCount: cached.chunks.length,
        },
      });
      return { success: true, chunkCount: cached.chunks.length, dimension: 384, latencyMs: 0 };
    }
    
    // Add document to session if not already there
    if (doc.sessionId) {
      this.addDocument(doc.sessionId, doc);
    }
    
    const startTime = performance.now();
    
    try {
      console.log('[RagManager] Generating embeddings for:', doc.filename, '| chunks:', doc.chunks?.length || 'unknown');
      
      const result = await this.engine.generateDocumentEmbeddings(doc);
      const latencyMs = performance.now() - startTime;
      
      if (result.vectors.length === 0) {
        console.warn('[RagManager] No vectors generated for:', doc.filename);
        emitMetric({
          type: 'error',
          sessionId: doc.sessionId,
          docId: doc.id,
          value: {
            operation: 'embedding_generation',
            message: 'No vectors generated - document may be empty',
            filename: doc.filename,
          },
        });
        return { success: false, chunkCount: 0, dimension: 0, latencyMs, error: 'No vectors generated' };
      }
      
      // Store in cache
      this.embeddingsCache.set(doc.id, {
        docId: doc.id,
        vectors: result.vectors,
        chunks: result.chunks,
        timestamp: Date.now(),
      });
      
      console.log('[RagManager] Embeddings generated:', {
        filename: doc.filename,
        chunkCount: result.chunks.length,
        dimension: result.metadata.dimension,
        latencyMs: Math.round(latencyMs),
      });
      
      // Emit success metric for dashboard
      emitMetric({
        type: 'embedding_generated',
        sessionId: doc.sessionId,
        docId: doc.id,
        value: {
          chunkCount: result.chunks.length,
          dimension: result.metadata.dimension,
          latencyMs,
          filename: doc.filename,
          vectorCount: result.vectors.length,
        },
      });
      
      return { 
        success: true, 
        chunkCount: result.chunks.length, 
        dimension: result.metadata.dimension, 
        latencyMs 
      };
      
    } catch (error) {
      const latencyMs = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown embedding error';
      console.error('[RagManager] Embedding generation failed:', errorMsg);
      
      emitMetric({
        type: 'error',
        sessionId: doc.sessionId,
        docId: doc.id,
        value: {
          operation: 'embedding_generation',
          message: errorMsg,
          filename: doc.filename,
          latencyMs,
        },
      });
      
      return { success: false, chunkCount: 0, dimension: 0, latencyMs, error: errorMsg };
    }
  }
}

// Export singleton instance
export const ragManager = new RagManager();

export default RagManager;
