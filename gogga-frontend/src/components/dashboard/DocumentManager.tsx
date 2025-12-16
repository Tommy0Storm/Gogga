/**
 * GOGGA RAG Dashboard - Context Memory Manager
 * Manages documents for LLM context with add/remove functionality
 * Monochrome design with grey gradients, black Material Icons
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Trash2, FileText, File, FileCode, FileImage, Upload, X, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { ContextDocument } from './types';
import { TierBadge } from './StatCard';
import { db, SUPPORTED_RAG_FORMATS, isSupportedFormat, RAG_LIMITS, checkStorageLimits } from '@/lib/db';
import { removeDocument as ragRemoveDocument } from '@/lib/rag';

// ============================================================================
// Document Manager Props
// ============================================================================

interface DocumentManagerProps {
  documents: ContextDocument[];
  tier: 'free' | 'jive' | 'jigga';
  sessionId: string;
  onDocumentAdd?: (doc: ContextDocument) => void;
  onDocumentRemove?: (docId: number) => void;
  onRefresh?: () => void;
  maxDocs?: number;
  compact?: boolean;
}

// ============================================================================
// File Icon Helper
// ============================================================================

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return <FileText className="w-4 h-4" />;
  if (mimeType.includes('word') || mimeType.includes('document'))
    return <File className="w-4 h-4" />;
  if (
    mimeType.includes('code') ||
    mimeType.includes('javascript') ||
    mimeType.includes('json')
  )
    return <FileCode className="w-4 h-4" />;
  if (mimeType.includes('image')) return <FileImage className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================================================
// Document Manager Component
// ============================================================================

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  tier,
  sessionId,
  onDocumentAdd,
  onDocumentRemove,
  onRefresh,
  maxDocs,
  compact = false,
}) => {
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showConfirm, setShowConfirm] = useState<number | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const effectiveMaxDocs =
    maxDocs ??
    (tier === 'jive'
      ? RAG_LIMITS.JIVE_MAX_DOCS_PER_SESSION
      : RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION);
  const canUpload = tier !== 'free' && documents.length < effectiveMaxDocs;

  const handleDelete = useCallback(
    async (docId: number) => {
      try {
        setIsDeleting(docId);
        // Get the document's sessionId for proper removal
        const doc = documents.find((d) => d.id === docId);
        const docSessionId = doc?.sessionId || sessionId;

        // Use the proper rag removal which handles:
        // - FlexSearch index removal
        // - Dexie deletion
        // - Metric emission
        await ragRemoveDocument(docSessionId, docId);

        onDocumentRemove?.(docId);
        onRefresh?.();
      } catch (error) {
        console.error('Failed to delete document:', error);
      } finally {
        setIsDeleting(null);
        setShowConfirm(null);
      }
    },
    [documents, sessionId, onDocumentRemove, onRefresh]
  );

  const handleDeleteAll = useCallback(async () => {
    if (documents.length === 0) return;

    try {
      setIsDeletingAll(true);

      // Delete all documents one by one using proper rag removal
      for (const doc of documents) {
        if (doc.id) {
          const docSessionId = doc.sessionId || sessionId;
          await ragRemoveDocument(docSessionId, doc.id);
          onDocumentRemove?.(doc.id);
        }
      }

      onRefresh?.();
    } catch (error) {
      console.error('Failed to delete all documents:', error);
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  }, [documents, sessionId, onDocumentRemove, onRefresh]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadError(null);
      setIsUploading(true);

      try {
        // Validate file type
        if (!isSupportedFormat(file.type)) {
          throw new Error(`Unsupported file type: ${file.type}`);
        }

        // Check storage limits
        const limitCheck = await checkStorageLimits(
          file.size,
          tier as 'jive' | 'jigga',
          sessionId
        );
        if (!limitCheck.allowed) {
          throw new Error(limitCheck.reason);
        }

        // Read file content
        const content = await file.text();

        // Simple chunking for now
        const chunkSize = 1000;
        const chunks: string[] = [];
        for (let i = 0; i < content.length; i += chunkSize) {
          chunks.push(content.slice(i, i + chunkSize));
        }

        // Save to database with session-scoped fields (v8)
        const now = new Date();
        const docId = await db.documents.add({
          // Session-Scoped RAG fields
          userId: 'current_user', // TODO: Get from auth context
          originSessionId: sessionId,
          activeSessions: [sessionId], // Initially active only in upload session
          accessCount: 0,
          lastAccessedAt: now,
          // Legacy field (frozen at upload time)
          sessionId,
          // Document content
          filename: file.name,
          content,
          chunks,
          chunkCount: chunks.length,
          size: file.size,
          mimeType: file.type,
          createdAt: now,
          updatedAt: now,
        });

        // Save chunks
        await db.chunks.bulkAdd(
          chunks.map((text, index) => ({
            documentId: docId,
            sessionId,
            chunkIndex: index,
            text,
            tokenCount: Math.ceil(text.length / 4), // Rough estimate
          }))
        );

        onRefresh?.();
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : 'Failed to upload file'
        );
      } finally {
        setIsUploading(false);
        event.target.value = ''; // Reset input
      }
    },
    [tier, sessionId, onRefresh]
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="bg-white rounded-xl border border-primary-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-primary-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-primary-800">
            Context Memory
          </h3>
          <TierBadge tier={tier} size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-primary-500">
            {documents.length} / {effectiveMaxDocs} docs
          </span>
          {documents.length > 0 && !showDeleteAllConfirm && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={isDeletingAll}
              className="px-2 py-1 text-xs font-medium text-sa-red hover:bg-sa-red/10 rounded transition-colors"
            >
              Delete All
            </button>
          )}
          {showDeleteAllConfirm && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="px-2 py-1 text-xs font-medium text-white bg-sa-red rounded hover:bg-sa-red/80 disabled:opacity-50"
              >
                {isDeletingAll ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={isDeletingAll}
                className="px-2 py-1 text-xs font-medium text-primary-600 bg-primary-100 rounded hover:bg-primary-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="px-4 py-2 bg-sa-red/10 border-b border-sa-red/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-sa-red" />
          <span className="text-xs text-sa-red">{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="ml-auto p-1 hover:bg-sa-red/20 rounded"
          >
            <X className="w-3 h-3 text-sa-red" />
          </button>
        </div>
      )}

      {/* Upload Area */}
      {tier !== 'free' && (
        <div className="px-4 py-3 border-b border-primary-100 bg-primary-50">
          <label
            className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer
              ${
                canUpload
                  ? 'border-primary-300 hover:border-primary-400 hover:bg-primary-100'
                  : 'border-primary-200 bg-primary-100 cursor-not-allowed opacity-50'
              }
              ${isUploading ? 'animate-pulse' : ''}
            `}
          >
            {isUploading ? (
              <>
                <Clock className="w-5 h-5 text-primary-500 animate-spin" />
                <span className="text-sm text-primary-600">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-primary-600">
                  {canUpload ? 'Upload document' : 'Max documents reached'}
                </span>
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.doc,.docx,.odt,.rtf"
              onChange={handleFileUpload}
              disabled={!canUpload || isUploading}
            />
          </label>
          <p className="text-xs text-primary-400 text-center mt-2">
            Supports: TXT, MD, PDF, DOC, DOCX, ODT, RTF (max{' '}
            {RAG_LIMITS.MAX_DOCUMENT_SIZE_MB}MB)
          </p>
        </div>
      )}

      {/* FREE tier message */}
      {tier === 'free' && (
        <div className="px-4 py-8 text-center">
          <FileText className="w-8 h-8 text-primary-300 mx-auto mb-2" />
          <p className="text-sm text-primary-500">
            RAG not available on FREE tier
          </p>
          <p className="text-xs text-primary-400 mt-1">
            Upgrade to JIVE or JIGGA for document context
          </p>
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div
          className={`divide-y divide-primary-100 ${
            compact ? 'max-h-60' : 'max-h-96'
          } overflow-y-auto`}
        >
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`px-4 py-3 flex items-center gap-3 hover:bg-primary-50 transition-colors
                ${isDeleting === doc.id ? 'opacity-50' : ''}
              `}
            >
              {/* Icon */}
              <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                {getFileIcon(doc.mimeType)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-800 truncate">
                  {doc.filename}
                </p>
                <div className="flex items-center gap-2 text-xs text-primary-400">
                  <span>{formatFileSize(doc.size)}</span>
                  <span>•</span>
                  <span>{doc.chunkCount} chunks</span>
                  {!compact && (
                    <>
                      <span>•</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Embedding status */}
              {doc.embeddingStatus === 'complete' && (
                <div title="Embeddings ready">
                  <CheckCircle className="w-4 h-4 text-sa-green" />
                </div>
              )}
              {doc.embeddingStatus === 'pending' && (
                <div title="Generating embeddings">
                  <Clock className="w-4 h-4 text-sa-gold animate-spin" />
                </div>
              )}

              {/* Delete button */}
              {showConfirm === doc.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(doc.id!)}
                    disabled={isDeleting !== null}
                    className="px-2 py-1 text-xs font-medium text-white bg-sa-red rounded hover:bg-sa-red/80"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowConfirm(null)}
                    className="px-2 py-1 text-xs font-medium text-primary-600 bg-primary-100 rounded hover:bg-primary-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(doc.id!)}
                  className="p-2 text-primary-400 hover:text-sa-red hover:bg-sa-red/10 rounded-lg transition-colors"
                  title="Remove document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {documents.length === 0 && tier !== 'free' && (
        <div className="px-4 py-8 text-center">
          <FileText className="w-8 h-8 text-primary-300 mx-auto mb-2" />
          <p className="text-sm text-primary-500">No documents uploaded</p>
          <p className="text-xs text-primary-400 mt-1">
            Upload documents to provide context to the AI
          </p>
        </div>
      )}

      {/* Footer stats */}
      <div className="px-4 py-2 bg-primary-50 border-t border-primary-100 flex items-center justify-between text-xs text-primary-500">
        <span>
          Total chunks: {documents.reduce((sum, d) => sum + d.chunkCount, 0)}
        </span>
        <span>
          Storage:{' '}
          {formatFileSize(documents.reduce((sum, d) => sum + d.size, 0))}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// Document Preview Card
// ============================================================================

interface DocumentPreviewProps {
  document: ContextDocument;
  onClose?: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  onClose,
}) => {
  return (
    <div className="bg-white rounded-xl border border-primary-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-primary-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getFileIcon(document.mimeType)}
          <h4 className="text-sm font-semibold text-primary-800 truncate max-w-xs">
            {document.filename}
          </h4>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-primary-100 rounded">
            <X className="w-4 h-4 text-primary-500" />
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 p-4 bg-primary-50 border-b border-primary-100 text-center">
        <div>
          <p className="text-lg font-bold text-primary-800">{document.chunkCount}</p>
          <p className="text-xs text-primary-500">Chunks</p>
        </div>
        <div>
          <p className="text-lg font-bold text-primary-800">{formatFileSize(document.size)}</p>
          <p className="text-xs text-primary-500">Size</p>
        </div>
        <div>
          <p className="text-lg font-bold text-primary-800">{document.content.length}</p>
          <p className="text-xs text-primary-500">Chars</p>
        </div>
        <div>
          <p className="text-lg font-bold text-primary-800">{Math.ceil(document.content.length / 4)}</p>
          <p className="text-xs text-primary-500">~Tokens</p>
        </div>
      </div>

      {/* Content preview */}
      <div className="p-4 max-h-64 overflow-y-auto">
        <pre className="text-xs text-primary-600 whitespace-pre-wrap font-mono">
          {document.content.slice(0, 2000)}
          {document.content.length > 2000 && (
            <span className="text-primary-400">... ({document.content.length - 2000} more characters)</span>
          )}
        </pre>
      </div>
    </div>
  );
};

// ============================================================================
// Quick Document List (Compact)
// ============================================================================

interface QuickDocListProps {
  documents: ContextDocument[];
  onSelect?: (doc: ContextDocument) => void;
  selectedIds?: number[];
}

export const QuickDocList: React.FC<QuickDocListProps> = ({
  documents,
  onSelect,
  selectedIds = [],
}) => {
  return (
    <div className="space-y-1">
      {documents.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onSelect?.(doc)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors
            ${selectedIds.includes(doc.id!) 
              ? 'bg-primary-200 text-primary-900' 
              : 'hover:bg-primary-100 text-primary-700'
            }
          `}
        >
          <div className="text-primary-500">
            {getFileIcon(doc.mimeType)}
          </div>
          <span className="text-sm truncate flex-1">{doc.filename}</span>
          <span className="text-xs text-primary-400">{doc.chunkCount}c</span>
        </button>
      ))}
    </div>
  );
};

export default DocumentManager;
