/**
 * useRAG Hook
 * React hook for per-session local RAG functionality
 * Active in JIVE (upload only) and JIGGA (upload + cross-session selection)
 * 
 * RAG Modes:
 * - JIVE: Basic retrieval (keyword-based, no embeddings)
 * - JIGGA: Semantic retrieval (E5 embeddings, vector similarity)
 */

'use client';

import { useState, useEffect, useCallback, useRef, useEffectEvent } from 'react';
import type { Document, ChatSession } from '@/lib/db';
import {
  getStorageStats,
  generateSessionId,
  checkStorageLimits,
  getAllDocuments,
  getDocumentsByIds,
  getStorageUsageBreakdown,
  RAG_LIMITS,
} from '@/lib/db';
import rag from '@/lib/rag';
import { RagManager, type RagMode, type SemanticChunk } from '@/lib/ragManager';
import { isValidDocument, isValidRAGDocument } from '@/lib/utils/typeGuards';
import { getTierConfig, getMaxDocsPerSession, canSelectAcrossSessions } from '@/lib/config/tierConfig';

export type Tier = 'free' | 'jive' | 'jigga';

// Singleton RagManager instance for semantic search
const ragManagerInstance = new RagManager();

interface RAGState {
  sessionId: string;
  documents: Document[];
  selectedDocIds: number[]; // For JIGGA: IDs of documents selected from all sessions
  allDocuments: Document[]; // All documents across sessions (for JIGGA selection)
  isLoading: boolean;
  isEmbedding: boolean; // True when generating embeddings (JIGGA)
  isInitializingSemantic: boolean; // True while loading semantic engine
  semanticReady: boolean; // True when semantic engine is ready
  semanticStats?: {
    engineReady: boolean;
    cachedSessions: number;
    totalCachedDocs: number;
  };
  error: string | null;
  ragMode: RagMode; // Current retrieval mode
  lastRetrievalStats: {
    mode: RagMode;
    latencyMs: number;
    topScore?: number; // Only for semantic mode
    chunksRetrieved: number;
  } | null;
  stats: {
    documents: number;
    chunks: number;
    estimatedSizeMB: number;
  };
  storageUsage: {
    totalMB: number;
    maxMB: number;
    usedPercent: number;
    remainingMB: number;
  };
}

interface UseRAGReturn extends RAGState {
  uploadDocument: (file: File) => Promise<void>;
  removeDocument: (docId: number) => Promise<void>;
  getContext: (
    query: string,
    options?: { authoritative?: boolean }
  ) => Promise<string | null>;
  getSemanticChunks: (query: string, topK?: number) => Promise<SemanticChunk[]>; // JIGGA only
  clearAllDocuments: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  newSession: () => void;
  isRAGEnabled: boolean;
  canUpload: boolean; // JIVE and JIGGA can upload
  canSelectFromAllSessions: boolean; // Only JIGGA
  canUseSemanticRAG: boolean; // Only JIGGA
  selectDocuments: (docIds: number[]) => Promise<void>; // JIGGA: select docs from all sessions
  loadAllDocuments: () => Promise<void>; // Load all docs for selection UI
  getMaxDocsPerSession: () => number;
  getRemainingDocsSlots: () => number;
  preloadEmbeddings: () => Promise<void>; // JIGGA: preload embeddings for faster queries
  // Semantic RAG methods (JIGGA only)
  initSemanticSearch: () => Promise<boolean>; // Initialize the embedding engine
  getSemanticContext: (
    query: string,
    options?: {
      topK?: number;
      maxTokens?: number;
      authoritative?: boolean;
    }
  ) => Promise<{ context: string | null; chunks: SemanticChunk[] }>;
  getSemanticStatus: () => {
    initialized: boolean;
    backend: string;
    cachedSessions: number;
    totalCachedDocs: number;
  } | null;
}

// Helper to get or create session ID with localStorage persistence
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return generateSessionId();
  }
  const stored = localStorage.getItem('gogga_current_session');
  if (stored) return stored;
  const newId = generateSessionId();
  localStorage.setItem('gogga_current_session', newId);
  return newId;
}

export function useRAG(tier: Tier): UseRAGReturn {
  // Get or generate session ID - persist to localStorage to survive remounts
  const sessionIdRef = useRef<string>(getOrCreateSessionId());

  // Determine RAG mode based on tier
  const ragMode: RagMode = tier === 'jigga' ? 'semantic' : 'basic';
  const ragConfig = getTierConfig(tier, ragMode);

  const [state, setState] = useState<RAGState>({
    sessionId: sessionIdRef.current,
    documents: [],
    selectedDocIds: [],
    allDocuments: [],
    isLoading: false,
    isEmbedding: false,
    isInitializingSemantic: false,
    semanticReady: false,
    semanticStats: undefined,
    error: null,
    ragMode,
    lastRetrievalStats: null,
    stats: { documents: 0, chunks: 0, estimatedSizeMB: 0 },
    storageUsage: {
      totalMB: 0,
      maxMB: RAG_LIMITS.MAX_TOTAL_STORAGE_MB,
      usedPercent: 0,
      remainingMB: RAG_LIMITS.MAX_TOTAL_STORAGE_MB,
    },
  });

  // JIVE and JIGGA can use RAG
  const isRAGEnabled = tier === 'jive' || tier === 'jigga';
  const canUpload = tier === 'jive' || tier === 'jigga';
  const canSelectFromAllSessions = canSelectAcrossSessions(tier);
  const canUseSemanticRAG = tier === 'jigga';

  const getRemainingDocsSlots = useCallback(() => {
    const max = getMaxDocsPerSession(tier);
    const used = state.documents.length + state.selectedDocIds.length;
    return Math.max(0, max - used);
  }, [
    tier,
    state.documents.length,
    state.selectedDocIds.length,
  ]);

  // React 19.2: Stable effect handler for storage updates
  // Always accesses latest state without being in dependency arrays
  const onUpdateStorageUsage = useEffectEvent(async () => {
    try {
      const usage = await getStorageUsageBreakdown();
      setState((prev) => ({
        ...prev,
        storageUsage: {
          totalMB: usage.totalMB,
          maxMB: RAG_LIMITS.MAX_TOTAL_STORAGE_MB,
          usedPercent: usage.usedPercent,
          remainingMB: usage.remainingMB,
        },
      }));
    } catch (err) {
      console.error('Failed to get storage usage:', err);
    }
  });

  const refreshDocuments = useCallback(async () => {
    if (!isRAGEnabled) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await rag.ensureIndexLoaded(sessionIdRef.current);
      const docs = await rag.getAllDocuments(sessionIdRef.current);
      const stats = await getStorageStats(sessionIdRef.current);

      // Sync documents with RagManager for semantic search
      ragManagerInstance.setDocuments(sessionIdRef.current, docs);

      setState((prev) => ({
        ...prev,
        documents: docs,
        isLoading: false,
        error: null,
        stats: {
          documents: stats.documents,
          chunks: stats.chunks,
          estimatedSizeMB: stats.estimatedSizeMB,
        },
      }));

      await onUpdateStorageUsage();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load documents',
      }));
    }
  }, [isRAGEnabled]); // onUpdateStorageUsage is stable via useEffectEvent

  // React 19.2: Stable effect handlers for document loading
  // Always use latest functions without restarting effect
  const onLoadDocuments = useEffectEvent(() => {
    refreshDocuments();
    onUpdateStorageUsage();
  });

  // Load documents on mount or when session changes
  useEffect(() => {
    if (isRAGEnabled) {
      onLoadDocuments();
    }

    // Cleanup: unload session index when unmounting
    return () => {
      rag.unloadSession(sessionIdRef.current);
    };
  }, [isRAGEnabled]); // Stable handlers, only re-run when RAG enabled/disabled

  const loadAllDocuments = useCallback(async () => {
    if (!canSelectFromAllSessions) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const allDocs = (await getAllDocuments()).filter(isValidDocument);
      setState((prev) => ({
        ...prev,
        allDocuments: allDocs,
        isLoading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          err instanceof Error ? err.message : 'Failed to load all documents',
      }));
    }
  }, [canSelectFromAllSessions]);

  const selectDocuments = useCallback(
    async (docIds: number[]) => {
      if (!canSelectFromAllSessions) {
        throw new Error('Document selection is only available in JIGGA tier');
      }

      // Check limit (selected + session docs)
      const totalDocs = state.documents.length + docIds.length;
      if (totalDocs > RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION) {
        throw new Error(
          `Cannot select more than ${RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION} documents total. ` +
            `Currently have ${state.documents.length} in session, trying to select ${docIds.length}.`
        );
      }

      // Load the selected documents using RagManager (TypeScript 5.5 Set intersection)
      if (docIds.length > 0) {
        const selectedDocs = ragManagerInstance.selectDocumentsAcrossSessions(docIds);

        // Index each selected document's chunks into the current session's FlexSearch index
        for (const doc of selectedDocs) {
          if (doc.id && doc.chunks) {
            await rag.indexExternalDocument(sessionIdRef.current, doc);
          }
        }

        // Also add to RagManager for semantic/basic retrieval
        ragManagerInstance.addExternalDocuments(
          sessionIdRef.current,
          selectedDocs
        );
      }

      setState((prev) => ({
        ...prev,
        selectedDocIds: docIds,
      }));
    },
    [canSelectFromAllSessions, state.documents.length]
  );

  const uploadDocument = useCallback(
    async (file: File) => {
      if (!canUpload) {
        throw new Error('RAG upload is only available in JIVE and JIGGA tiers');
      }

      // Check storage limits
      const tierType = tier === 'jive' ? 'jive' : 'jigga';
      const limitCheck = await checkStorageLimits(
        file.size,
        tierType,
        sessionIdRef.current
      );

      if (!limitCheck.allowed) {
        throw new Error(limitCheck.reason || 'Storage limit exceeded');
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        isEmbedding: tier === 'jigga',
        error: null,
      }));

      try {
        const doc = await rag.addDocument(sessionIdRef.current, file);

        // For JIGGA tier, pre-generate embeddings immediately
        // This ensures semantic search works and dashboard stats update
        if (tier === 'jigga' && doc) {
          console.log(
            '[RAG] JIGGA tier - generating embeddings for:',
            doc.filename
          );

          // Initialize the engine if needed (first upload scenario)
          if (!ragManagerInstance.isReady()) {
            console.log(
              '[RAG] Initializing semantic engine for first upload...'
            );
            await ragManagerInstance.initializeSemanticEngine();
          }

          // Generate embeddings - this now returns detailed result
          const embeddingResult = await ragManagerInstance.preloadDocument(doc);

          if (embeddingResult.success) {
            console.log('[RAG] Embeddings generated successfully:', {
              filename: doc.filename,
              chunkCount: embeddingResult.chunkCount,
              latencyMs: Math.round(embeddingResult.latencyMs),
            });
          } else {
            console.warn(
              '[RAG] Embedding generation failed:',
              embeddingResult.error
            );
            // Continue anyway - document is saved, embeddings can be generated on query
          }

          // Update semantic state
          const status = ragManagerInstance.getStatus();
          setState((prev) => ({
            ...prev,
            isEmbedding: false,
            semanticReady: status.initialized,
            semanticStats: {
              engineReady: status.initialized,
              cachedSessions: status.cachedSessions,
              totalCachedDocs: status.totalCachedDocs,
            },
          }));
        }

        await refreshDocuments();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to upload document';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isEmbedding: false,
          error: errorMessage,
        }));
        throw new Error(errorMessage);
      }
    },
    [canUpload, tier, refreshDocuments]
  );

  const removeDocument = useCallback(
    async (docId: number) => {
      if (!isRAGEnabled) return;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await rag.removeDocument(sessionIdRef.current, docId);

        // Also remove from selected if present
        setState((prev) => ({
          ...prev,
          selectedDocIds: prev.selectedDocIds.filter((id) => id !== docId),
        }));

        await refreshDocuments();
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            err instanceof Error ? err.message : 'Failed to remove document',
        }));
        throw err;
      }
    },
    [isRAGEnabled, refreshDocuments]
  );

  const getContext = useCallback(
    async (
      query: string,
      options?: { authoritative?: boolean }
    ): Promise<string | null> => {
      if (!isRAGEnabled) {
        console.log('[RAG] getContext: RAG not enabled');
        return null;
      }

      const hasSessionDocs = state.documents.length > 0;
      const hasSelectedDocs = state.selectedDocIds.length > 0;

      console.log(
        '[RAG] getContext: sessionDocs=',
        hasSessionDocs,
        'selectedDocs=',
        hasSelectedDocs,
        'mode=',
        ragMode
      );

      if (!hasSessionDocs && !hasSelectedDocs) {
        console.log('[RAG] getContext: No documents available');
        return null;
      }

      try {
        // Check what docs RagManager has
        const ragDocs = ragManagerInstance.getDocuments(sessionIdRef.current);
        console.log(
          '[RAG] RagManager has',
          ragDocs.length,
          'docs for session',
          sessionIdRef.current
        );

        // Use RagManager for tier-appropriate retrieval
        const context = await ragManagerInstance.getContextForLLM(
          sessionIdRef.current,
          query,
          ragMode,
          {
            topK: ragMode === 'semantic' ? 5 : 3,
            maxTokens: 2500,
            authoritative: options?.authoritative && canUseSemanticRAG,
          }
        );

        console.log(
          '[RAG] getContextForLLM returned:',
          context ? `${context.length} chars` : 'null'
        );

        // Update stats from last retrieval
        const result = await ragManagerInstance.retrieve(
          sessionIdRef.current,
          query,
          ragMode
        );

        setState((prev) => ({
          ...prev,
          lastRetrievalStats: {
            mode: ragMode,
            latencyMs: result.latencyMs,
            topScore: result.mode === 'semantic' ? result.topScore : undefined,
            chunksRetrieved:
              result.mode === 'semantic'
                ? result.chunks.length
                : result.documents.length,
          },
        }));

        return context || null;
      } catch (err) {
        console.error('RAG context error:', err);

        // Fallback to basic FlexSearch for JIVE
        if (ragMode === 'basic') {
          try {
            return await rag.getRAGContext(
              sessionIdRef.current,
              query,
              5,
              2500
            );
          } catch {
            return null;
          }
        }

        return null;
      }
    },
    [
      isRAGEnabled,
      state.documents.length,
      state.selectedDocIds,
      ragMode,
      canUseSemanticRAG,
    ]
  );

  /**
   * Get semantic chunks with scores (JIGGA only)
   */
  const getSemanticChunks = useCallback(
    async (query: string, topK = 5): Promise<SemanticChunk[]> => {
      if (!canUseSemanticRAG) {
        console.warn('Semantic RAG is only available in JIGGA tier');
        return [];
      }

      const hasSessionDocs = state.documents.length > 0;
      const hasSelectedDocs = state.selectedDocIds.length > 0;

      if (!hasSessionDocs && !hasSelectedDocs) {
        return [];
      }

      try {
        setState((prev) => ({ ...prev, isEmbedding: true }));

        const result = await ragManagerInstance.retrieveSemantic(
          sessionIdRef.current,
          query,
          topK
        );

        setState((prev) => ({
          ...prev,
          isEmbedding: false,
          lastRetrievalStats: {
            mode: 'semantic',
            latencyMs: result.latencyMs,
            topScore: result.topScore,
            chunksRetrieved: result.chunks.length,
          },
        }));

        return result.chunks;
      } catch (err) {
        console.error('Semantic retrieval error:', err);
        setState((prev) => ({ ...prev, isEmbedding: false }));
        return [];
      }
    },
    [canUseSemanticRAG, state.documents.length, state.selectedDocIds]
  );

  /**
   * Preload embeddings for all documents (JIGGA only)
   */
  const preloadEmbeddings = useCallback(async (): Promise<void> => {
    if (!canUseSemanticRAG) return;

    setState((prev) => ({ ...prev, isEmbedding: true }));

    try {
      await ragManagerInstance.ensureEmbeddings(sessionIdRef.current);
    } catch (err) {
      console.error('Embedding preload error:', err);
    } finally {
      setState((prev) => ({ ...prev, isEmbedding: false }));
    }
  }, [canUseSemanticRAG]);

  const clearAllDocuments = useCallback(async () => {
    if (!isRAGEnabled) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await rag.clearRAGData(sessionIdRef.current);

      // Clear RagManager cache for this session
      ragManagerInstance.clearSessionCache(sessionIdRef.current);

      setState((prev) => ({
        ...prev,
        selectedDocIds: [],
        lastRetrievalStats: null,
      }));
      await refreshDocuments();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to clear documents',
      }));
      throw err;
    }
  }, [isRAGEnabled, refreshDocuments]);

  const newSession = useCallback(() => {
    // Unload current session from FlexSearch
    rag.unloadSession(sessionIdRef.current);

    // Clear RagManager cache for this session
    ragManagerInstance.clearSessionCache(sessionIdRef.current);

    // Create new session ID and persist to localStorage
    const newId = generateSessionId();
    sessionIdRef.current = newId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gogga_current_session', newId);
    }

    setState((prev) => ({
      ...prev,
      sessionId: newId,
      documents: [],
      selectedDocIds: [],
      stats: { documents: 0, chunks: 0, estimatedSizeMB: 0 },
      lastRetrievalStats: null,
      error: null,
      semanticReady: false,
      semanticStats: undefined,
    }));
  }, []);

  /**
   * Initialize semantic search engine (JIGGA only)
   * Call this early to preload the model
   */
  const initSemanticSearch = useCallback(async (): Promise<boolean> => {
    if (!canUseSemanticRAG) {
      console.warn('Semantic search only available for JIGGA tier');
      return false;
    }

    if (state.semanticReady) {
      return true;
    }

    setState((prev) => ({ ...prev, isInitializingSemantic: true }));

    try {
      await ragManagerInstance.initializeSemanticEngine();

      const status = ragManagerInstance.getStatus();

      setState((prev) => ({
        ...prev,
        isInitializingSemantic: false,
        semanticReady: status.initialized,
        semanticStats: {
          engineReady: status.initialized,
          cachedSessions: status.cachedSessions,
          totalCachedDocs: status.totalCachedDocs,
        },
      }));

      return status.initialized;
    } catch (err) {
      console.error('Failed to initialize semantic search:', err);
      setState((prev) => ({
        ...prev,
        isInitializingSemantic: false,
        error: err instanceof Error ? err.message : 'Semantic init failed',
      }));
      return false;
    }
  }, [canUseSemanticRAG, state.semanticReady]);

  /**
   * Get semantic engine status (JIGGA only)
   */
  const getSemanticStatus = useCallback(() => {
    if (!canUseSemanticRAG) {
      return null;
    }

    return ragManagerInstance.getStatus();
  }, [canUseSemanticRAG]);

  /**
   * Get semantic context with detailed chunk info (JIGGA only)
   * Returns both context string and scored chunks
   */
  const getSemanticContext = useCallback(
    async (
      query: string,
      options?: { topK?: number; maxTokens?: number; authoritative?: boolean }
    ): Promise<{ context: string | null; chunks: SemanticChunk[] }> => {
      if (!canUseSemanticRAG) {
        return { context: null, chunks: [] };
      }

      const hasSessionDocs = state.documents.length > 0;
      const hasSelectedDocs = state.selectedDocIds.length > 0;

      if (!hasSessionDocs && !hasSelectedDocs) {
        return { context: null, chunks: [] };
      }

      try {
        setState((prev) => ({ ...prev, isEmbedding: true }));

        const topK = options?.topK ?? 5;
        const maxTokens = options?.maxTokens ?? 2500;

        // Get chunks with scores
        const result = await ragManagerInstance.retrieveSemantic(
          sessionIdRef.current,
          query,
          topK
        );

        // Build context string
        const context = await ragManagerInstance.getContextForLLM(
          sessionIdRef.current,
          query,
          'semantic',
          { topK, maxTokens, authoritative: options?.authoritative }
        );

        setState((prev) => ({
          ...prev,
          isEmbedding: false,
          lastRetrievalStats: {
            mode: 'semantic',
            latencyMs: result.latencyMs,
            topScore: result.topScore,
            chunksRetrieved: result.chunks.length,
          },
        }));

        return { context, chunks: result.chunks };
      } catch (err) {
        console.error('Semantic context error:', err);
        setState((prev) => ({ ...prev, isEmbedding: false }));
        return { context: null, chunks: [] };
      }
    },
    [canUseSemanticRAG, state.documents.length, state.selectedDocIds]
  );

  return {
    ...state,
    uploadDocument,
    removeDocument,
    getContext,
    clearAllDocuments,
    refreshDocuments,
    newSession,
    isRAGEnabled,
    canUpload,
    canSelectFromAllSessions,
    selectDocuments,
    loadAllDocuments,
    getMaxDocsPerSession,
    getRemainingDocsSlots,
    // Semantic RAG (JIGGA only)
    canUseSemanticRAG,
    initSemanticSearch,
    getSemanticContext,
    getSemanticStatus,
    getSemanticChunks,
    preloadEmbeddings,
  };
}

export default useRAG;
