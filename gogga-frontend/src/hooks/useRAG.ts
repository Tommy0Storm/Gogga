/**
 * useRAG Hook
 * React hook for per-session local RAG functionality
 * Active in JIVE (upload only) and JIGGA (upload + cross-session selection)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

export type Tier = 'free' | 'jive' | 'jigga';

interface RAGState {
  sessionId: string;
  documents: Document[];
  selectedDocIds: number[];  // For JIGGA: IDs of documents selected from all sessions
  allDocuments: Document[]; // All documents across sessions (for JIGGA selection)
  isLoading: boolean;
  error: string | null;
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
  getContext: (query: string) => Promise<string | null>;
  clearAllDocuments: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  newSession: () => void;
  isRAGEnabled: boolean;
  canUpload: boolean;  // JIVE and JIGGA can upload
  canSelectFromAllSessions: boolean;  // Only JIGGA
  selectDocuments: (docIds: number[]) => Promise<void>;  // JIGGA: select docs from all sessions
  loadAllDocuments: () => Promise<void>;  // Load all docs for selection UI
  getMaxDocsPerSession: () => number;
  getRemainingDocsSlots: () => number;
}

export function useRAG(tier: Tier): UseRAGReturn {
  // Generate session ID on mount
  const sessionIdRef = useRef<string>(generateSessionId());
  
  const [state, setState] = useState<RAGState>({
    sessionId: sessionIdRef.current,
    documents: [],
    selectedDocIds: [],
    allDocuments: [],
    isLoading: false,
    error: null,
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
  const canSelectFromAllSessions = tier === 'jigga';

  const getMaxDocsPerSession = useCallback(() => {
    return tier === 'jive' 
      ? RAG_LIMITS.JIVE_MAX_DOCS_PER_SESSION 
      : RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION;
  }, [tier]);

  const getRemainingDocsSlots = useCallback(() => {
    const max = getMaxDocsPerSession();
    const used = state.documents.length + state.selectedDocIds.length;
    return Math.max(0, max - used);
  }, [getMaxDocsPerSession, state.documents.length, state.selectedDocIds.length]);

  const updateStorageUsage = useCallback(async () => {
    try {
      const usage = await getStorageUsageBreakdown();
      setState(prev => ({
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
  }, []);

  // Load documents on mount or when session changes
  useEffect(() => {
    if (isRAGEnabled) {
      refreshDocuments();
      updateStorageUsage();
    }
    
    // Cleanup: unload session index when unmounting
    return () => {
      rag.unloadSession(sessionIdRef.current);
    };
  }, [isRAGEnabled]);

  const refreshDocuments = useCallback(async () => {
    if (!isRAGEnabled) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await rag.ensureIndexLoaded(sessionIdRef.current);
      const docs = await rag.getAllDocuments(sessionIdRef.current);
      const stats = await getStorageStats(sessionIdRef.current);

      setState(prev => ({
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
      
      await updateStorageUsage();
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load documents',
      }));
    }
  }, [isRAGEnabled, updateStorageUsage]);

  const loadAllDocuments = useCallback(async () => {
    if (!canSelectFromAllSessions) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const allDocs = await getAllDocuments();
      setState(prev => ({
        ...prev,
        allDocuments: allDocs,
        isLoading: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load all documents',
      }));
    }
  }, [canSelectFromAllSessions]);

  const selectDocuments = useCallback(async (docIds: number[]) => {
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

    // Load the selected documents and index them for search
    if (docIds.length > 0) {
      const selectedDocs = await getDocumentsByIds(docIds);
      
      // Index each selected document's chunks into the current session's FlexSearch index
      for (const doc of selectedDocs) {
        if (doc.id && doc.chunks) {
          await rag.indexExternalDocument(sessionIdRef.current, doc);
        }
      }
    }

    setState(prev => ({
      ...prev,
      selectedDocIds: docIds,
    }));
  }, [canSelectFromAllSessions, state.documents.length]);

  const uploadDocument = useCallback(async (file: File) => {
    if (!canUpload) {
      throw new Error('RAG upload is only available in JIVE and JIGGA tiers');
    }

    // Check storage limits
    const tierType = tier === 'jive' ? 'jive' : 'jigga';
    const limitCheck = await checkStorageLimits(file.size, tierType, sessionIdRef.current);
    
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || 'Storage limit exceeded');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await rag.addDocument(sessionIdRef.current, file);
      await refreshDocuments();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload document';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  }, [canUpload, tier, refreshDocuments]);

  const removeDocument = useCallback(async (docId: number) => {
    if (!isRAGEnabled) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await rag.removeDocument(sessionIdRef.current, docId);
      
      // Also remove from selected if present
      setState(prev => ({
        ...prev,
        selectedDocIds: prev.selectedDocIds.filter(id => id !== docId),
      }));
      
      await refreshDocuments();
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to remove document',
      }));
      throw err;
    }
  }, [isRAGEnabled, refreshDocuments]);

  const getContext = useCallback(async (query: string): Promise<string | null> => {
    if (!isRAGEnabled) return null;
    
    const hasSessionDocs = state.documents.length > 0;
    const hasSelectedDocs = state.selectedDocIds.length > 0;
    
    if (!hasSessionDocs && !hasSelectedDocs) {
      return null;
    }

    try {
      // Get context using FlexSearch - this searches both session docs AND indexed selected docs
      // Selected docs are indexed when selectDocuments() is called via indexExternalDocument()
      const context = await rag.getRAGContext(sessionIdRef.current, query, 5, 2500);
      
      return context || null;
    } catch (err) {
      console.error('RAG context error:', err);
      return null;
    }
  }, [isRAGEnabled, state.documents.length, state.selectedDocIds]);

  const clearAllDocuments = useCallback(async () => {
    if (!isRAGEnabled) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await rag.clearRAGData(sessionIdRef.current);
      setState(prev => ({
        ...prev,
        selectedDocIds: [],
      }));
      await refreshDocuments();
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to clear documents',
      }));
      throw err;
    }
  }, [isRAGEnabled, refreshDocuments]);

  const newSession = useCallback(() => {
    // Unload current session
    rag.unloadSession(sessionIdRef.current);
    
    // Create new session ID
    const newId = generateSessionId();
    sessionIdRef.current = newId;
    
    setState(prev => ({
      ...prev,
      sessionId: newId,
      documents: [],
      selectedDocIds: [],
      stats: { documents: 0, chunks: 0, estimatedSizeMB: 0 },
      error: null,
    }));
  }, []);

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
  };
}

export default useRAG;
