'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  Search,
  Plus,
  Minus,
  CheckCircle,
  Clock,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentPoolManager, type PoolDocument, type PoolStats } from '@/lib/rag/documentPool';

interface DocumentPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  sessionId: string;
  onDocumentActivated?: (docId: string) => void;
  onDocumentDeactivated?: (docId: string) => void;
}

/**
 * DocumentPoolModal - JIGGA feature for cross-session document access
 * 
 * Allows users to:
 * - View all documents in their pool
 * - Activate documents for the current session
 * - Deactivate documents from the current session
 * - See orphaned documents (not active anywhere)
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */
export function DocumentPoolModal({
  isOpen,
  onClose,
  userId,
  sessionId,
  onDocumentActivated,
  onDocumentDeactivated,
}: DocumentPoolModalProps) {
  const [documents, setDocuments] = useState<PoolDocument[]>([]);
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'orphaned'>('all');
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load on open with proper cleanup
  useEffect(() => {
    if (!isOpen) return;
    
    let mounted = true;
    
    const loadPool = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const poolManager = DocumentPoolManager.getInstance();
        await poolManager.init(userId);

        const [poolDocs, poolStats] = await Promise.all([
          poolManager.getPool(),
          poolManager.getStats(),
        ]);

        if (mounted) {
          setDocuments(poolDocs);
          setStats(poolStats);
        }
      } catch (err) {
        console.error('[DocumentPoolModal] Error loading pool:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load document pool');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadPool();
    
    return () => {
      mounted = false;
    };
  }, [isOpen, userId]);

  // Refresh pool helper for operations
  const refreshPool = useCallback(async () => {
    try {
      const poolManager = DocumentPoolManager.getInstance();
      const [poolDocs, poolStats] = await Promise.all([
        poolManager.getPool(),
        poolManager.getStats(),
      ]);
      setDocuments(poolDocs);
      setStats(poolStats);
    } catch (err) {
      console.error('[DocumentPoolModal] Error refreshing pool:', err);
    }
  }, []);

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = doc.filename?.toLowerCase().includes(query);
      const matchesType = doc.mimeType?.toLowerCase().includes(query);
      if (!matchesName && !matchesType) return false;
    }

    // Mode filter
    switch (filterMode) {
      case 'active':
        return doc.activeSessions?.includes(sessionId);
      case 'orphaned':
        return doc.isOrphaned;
      default:
        return true;
    }
  });

  // Activate document for current session
  const handleActivate = async (docId: string) => {
    setOperationInProgress(docId);
    setError(null);

    try {
      const poolManager = DocumentPoolManager.getInstance();
      const result = await poolManager.activateDocForSession(docId, sessionId);

      if (result.success) {
        await refreshPool(); // Refresh
        onDocumentActivated?.(docId);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate document');
    } finally {
      setOperationInProgress(null);
    }
  };

  // Deactivate document from current session
  const handleDeactivate = async (docId: string) => {
    setOperationInProgress(docId);
    setError(null);

    try {
      const poolManager = DocumentPoolManager.getInstance();
      const result = await poolManager.deactivateDocFromSession(docId, sessionId);

      if (result.success) {
        await refreshPool(); // Refresh
        onDocumentDeactivated?.(docId);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate document');
    } finally {
      setOperationInProgress(null);
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FolderOpen size={20} className="text-primary-600" />
              Document Pool
            </h2>
            {stats && (
              <p className="text-sm text-gray-500 mt-0.5">
                {stats.totalDocs} documents • {formatSize(stats.totalSize)} used •{' '}
                {stats.availableSlots} slots available
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-3 border-b space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              id="document-pool-search"
              name="document-pool-search"
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'active', 'orphaned'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  filterMode === mode
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {mode === 'all' && 'All'}
                {mode === 'active' && `Active (${documents.filter((d) => d.activeSessions?.includes(sessionId)).length})`}
                {mode === 'orphaned' && `Orphaned (${stats?.orphanedDocsCount ?? 0})`}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p>
                {searchQuery
                  ? 'No documents match your search'
                  : filterMode === 'orphaned'
                  ? 'No orphaned documents'
                  : filterMode === 'active'
                  ? 'No documents active in this session'
                  : 'Your document pool is empty'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocuments.map((doc) => {
                const isActiveInSession = doc.activeSessions?.includes(sessionId);
                const isOperating = operationInProgress === doc.id;

                return (
                  <div
                    key={doc.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      isActiveInSession
                        ? 'border-primary-200 bg-primary-50'
                        : doc.isOrphaned
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        isActiveInSession
                          ? 'bg-primary-100'
                          : doc.isOrphaned
                          ? 'bg-amber-100'
                          : 'bg-gray-100'
                      )}
                    >
                      <FileText
                        size={20}
                        className={cn(
                          isActiveInSession
                            ? 'text-primary-600'
                            : doc.isOrphaned
                            ? 'text-amber-600'
                            : 'text-gray-500'
                        )}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.filename || 'Unnamed document'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>{formatSize(doc.size || 0)}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {doc.lastAccessedAt
                            ? formatRelativeTime(doc.lastAccessedAt as unknown as string)
                            : 'Never'}
                        </span>
                        <span>
                          {doc.sessionCount} session{doc.sessionCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-2">
                      {isActiveInSession && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                          <CheckCircle size={12} />
                          Active
                        </span>
                      )}
                      {doc.isOrphaned && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                          <AlertCircle size={12} />
                          Orphaned
                        </span>
                      )}
                    </div>

                    {/* Action button */}
                    <button
                      onClick={() =>
                        isActiveInSession
                          ? handleDeactivate(doc.id!)
                          : handleActivate(doc.id!)
                      }
                      disabled={isOperating}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        isOperating && 'opacity-50 cursor-not-allowed',
                        isActiveInSession
                          ? 'hover:bg-red-100 text-red-600'
                          : 'hover:bg-primary-100 text-primary-600'
                      )}
                      title={isActiveInSession ? 'Remove from session' : 'Add to session'}
                    >
                      {isOperating ? (
                        <div className="w-5 h-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : isActiveInSession ? (
                        <Minus size={20} />
                      ) : (
                        <Plus size={20} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Tip: Documents active in this session will be included in RAG searches
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
