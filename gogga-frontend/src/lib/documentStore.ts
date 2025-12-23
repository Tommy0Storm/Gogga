/**
 * Document Store
 * 
 * Zustand store for sharing RAG document state between ChatClient and RightSidePanel.
 * This store syncs with the useRAG hook's state to provide document visibility in the panel.
 * 
 * Document Types:
 * - Session Documents: originSessionId is set, scoped to current session (📎 Paperclip)
 * - RAG Store Documents: originSessionId is null, persistent across sessions (📚 RAG Store)
 * 
 * Performance:
 * - Debounced sync to prevent excessive renders during rapid updates
 * - Uses shallow comparison to skip no-op updates
 */

import { create } from 'zustand';
import type { Document } from '@/lib/db';

// Debounce helper for store updates
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 50;

// Shallow compare for document arrays
function documentsEqual(a: Document[], b: Document[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id) return false;
  }
  return true;
}

export interface DocumentStore {
  // Document state
  documents: Document[];           // Legacy: all active documents (session + rag combined)
  selectedDocIds: string[];
  allDocuments: Document[];        // All documents for browsing
  
  // Session vs RAG separation
  sessionDocuments: Document[];    // Documents with originSessionId set (session-scoped)
  ragDocuments: Document[];        // Documents with originSessionId null (persistent)
  
  // RAG state
  isLoading: boolean;
  isEmbedding: boolean;
  storageUsage: {
    totalMB: number;
    maxMB: number;
    usedPercent: number;
    remainingMB: number;
  };
  
  // Tier info
  tier: 'free' | 'jive' | 'jigga';
  isRAGEnabled: boolean;
  canUpload: boolean;
  maxDocsPerSession: number;
  
  // RAG Controls (for RightSidePanel)
  ragMode: 'analysis' | 'authoritative';
  useRAGForChat: boolean;  // Whether to use RAG context in chat
  setRagMode: (mode: 'analysis' | 'authoritative') => void;
  setUseRAGForChat: (enabled: boolean) => void;
  
  // Session document actions (📎 Paperclip)
  onUploadDocument: ((file: File) => Promise<void>) | null;
  onRemoveDocument: ((docId: string) => Promise<void>) | null;
  onSelectDocuments: ((docIds: string[]) => Promise<void>) | null;
  onLoadAllDocuments: (() => Promise<void>) | null;
  
  // RAG Store actions (📚 RAG Store)
  onRAGUpload: ((file: File) => Promise<void>) | null;
  onRAGRemove: ((docId: string) => Promise<void>) | null;
  onClearAllRAG: (() => Promise<void>) | null;
  
  // Setters
  setDocuments: (documents: Document[]) => void;
  setSelectedDocIds: (ids: string[]) => void;
  setAllDocuments: (documents: Document[]) => void;
  setSessionDocuments: (documents: Document[]) => void;
  setRAGDocuments: (documents: Document[]) => void;
  setIsLoading: (loading: boolean) => void;
  setIsEmbedding: (embedding: boolean) => void;
  setStorageUsage: (usage: DocumentStore['storageUsage']) => void;
  setTier: (tier: 'free' | 'jive' | 'jigga') => void;
  setRAGEnabled: (enabled: boolean) => void;
  setCanUpload: (canUpload: boolean) => void;
  setMaxDocsPerSession: (max: number) => void;
  
  // Action setters (Session)
  setUploadHandler: (handler: ((file: File) => Promise<void>) | null) => void;
  setRemoveHandler: (handler: ((docId: string) => Promise<void>) | null) => void;
  setSelectHandler: (handler: ((docIds: string[]) => Promise<void>) | null) => void;
  setLoadAllHandler: (handler: (() => Promise<void>) | null) => void;
  
  // Action setters (RAG Store)
  setRAGUploadHandler: (handler: ((file: File) => Promise<void>) | null) => void;
  setRAGRemoveHandler: (handler: ((docId: string) => Promise<void>) | null) => void;
  setClearAllRAGHandler: (handler: (() => Promise<void>) | null) => void;
  
  // Sync all state at once (for efficiency)
  syncState: (state: Partial<Omit<DocumentStore, 
    'syncState' | 'setDocuments' | 'setSelectedDocIds' | 'setAllDocuments' | 
    'setSessionDocuments' | 'setRAGDocuments' |
    'setIsLoading' | 'setIsEmbedding' | 'setStorageUsage' | 'setTier' | 
    'setRAGEnabled' | 'setCanUpload' | 'setMaxDocsPerSession' | 
    'setUploadHandler' | 'setRemoveHandler' | 'setSelectHandler' | 'setLoadAllHandler' |
    'setRAGUploadHandler' | 'setRAGRemoveHandler' | 'setClearAllRAGHandler'
  >>) => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  // Initial state
  documents: [],
  selectedDocIds: [],
  allDocuments: [],
  sessionDocuments: [],
  ragDocuments: [],
  isLoading: false,
  isEmbedding: false,
  storageUsage: {
    totalMB: 0,
    maxMB: 100,
    usedPercent: 0,
    remainingMB: 100,
  },
  tier: 'free',
  isRAGEnabled: false,
  canUpload: false,
  maxDocsPerSession: 0,
  ragMode: 'analysis',
  useRAGForChat: true,
  
  // Session action callbacks
  onUploadDocument: null,
  onRemoveDocument: null,
  onSelectDocuments: null,
  onLoadAllDocuments: null,
  
  // RAG Store action callbacks
  onRAGUpload: null,
  onRAGRemove: null,
  onClearAllRAG: null,
  
  // Setters
  setDocuments: (documents) => set({ documents }),
  setSelectedDocIds: (selectedDocIds) => set({ selectedDocIds }),
  setAllDocuments: (allDocuments) => set({ allDocuments }),
  setSessionDocuments: (sessionDocuments) => set({ sessionDocuments }),
  setRAGDocuments: (ragDocuments) => set({ ragDocuments }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsEmbedding: (isEmbedding) => set({ isEmbedding }),
  setStorageUsage: (storageUsage) => set({ storageUsage }),
  setTier: (tier) => set({ tier }),
  setRAGEnabled: (isRAGEnabled) => set({ isRAGEnabled }),
  setCanUpload: (canUpload) => set({ canUpload }),
  setMaxDocsPerSession: (maxDocsPerSession) => set({ maxDocsPerSession }),
  setRagMode: (ragMode) => set({ ragMode }),
  setUseRAGForChat: (useRAGForChat) => set({ useRAGForChat }),
  
  // Action setters (Session)
  setUploadHandler: (onUploadDocument) => set({ onUploadDocument }),
  setRemoveHandler: (onRemoveDocument) => set({ onRemoveDocument }),
  setSelectHandler: (onSelectDocuments) => set({ onSelectDocuments }),
  setLoadAllHandler: (onLoadAllDocuments) => set({ onLoadAllDocuments }),
  
  // Action setters (RAG Store)
  setRAGUploadHandler: (onRAGUpload) => set({ onRAGUpload }),
  setRAGRemoveHandler: (onRAGRemove) => set({ onRAGRemove }),
  setClearAllRAGHandler: (onClearAllRAG) => set({ onClearAllRAG }),
  
  // Sync all state at once with debouncing to prevent rapid re-renders
  syncState: (state) => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }
    
    syncDebounceTimer = setTimeout(() => {
      set((prev) => {
        // Skip update if documents haven't actually changed
        const docsSame = state.documents ? documentsEqual(prev.documents, state.documents) : true;
        const allDocsSame = state.allDocuments ? documentsEqual(prev.allDocuments, state.allDocuments) : true;
        const sessionDocsSame = state.sessionDocuments ? documentsEqual(prev.sessionDocuments, state.sessionDocuments) : true;
        const ragDocsSame = state.ragDocuments ? documentsEqual(prev.ragDocuments, state.ragDocuments) : true;
        
        // If all document arrays are the same, check if any other values changed
        if (docsSame && allDocsSame && sessionDocsSame && ragDocsSame) {
          const hasOtherChanges = 
            (state.isLoading !== undefined && state.isLoading !== prev.isLoading) ||
            (state.isEmbedding !== undefined && state.isEmbedding !== prev.isEmbedding) ||
            (state.tier !== undefined && state.tier !== prev.tier) ||
            (state.isRAGEnabled !== undefined && state.isRAGEnabled !== prev.isRAGEnabled) ||
            (state.canUpload !== undefined && state.canUpload !== prev.canUpload) ||
            (state.maxDocsPerSession !== undefined && state.maxDocsPerSession !== prev.maxDocsPerSession);
          
          if (!hasOtherChanges) {
            return prev; // No changes, skip update
          }
        }
        
        return { ...prev, ...state };
      });
      syncDebounceTimer = null;
    }, SYNC_DEBOUNCE_MS);
  },
}));
