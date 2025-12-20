/**
 * Document List Component
 * Shows uploaded documents with delete option
 * Only visible in JIGGA tier
 */

'use client';

import { useState } from 'react';
import { File, Trash2, ChevronDown, ChevronUp, Database, HardDrive } from 'lucide-react';
import type { Document } from '@/lib/db';

interface DocumentListProps {
  documents: Document[];
  onRemove: (docId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  stats: {
    documents: number;
    chunks: number;
    estimatedSizeMB: number;
  };
  isLoading?: boolean;
}

export function DocumentList({ 
  documents, 
  onRemove, 
  onClearAll, 
  stats,
  isLoading = false 
}: DocumentListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const handleRemove = async (docId: string) => {
    setRemovingId(docId);
    try {
      await onRemove(docId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all documents? This cannot be undone.')) return;
    
    setIsClearing(true);
    try {
      await onClearAll();
    } finally {
      setIsClearing(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400 text-xs">
        <Database size={24} className="mx-auto mb-2 opacity-50" />
        <p>No documents indexed</p>
        <p className="mt-1 text-[10px]">Upload files to enable local RAG</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Database size={14} className="text-gray-500" />
          <span className="text-xs font-bold text-gray-700">
            Local RAG ({stats.documents} docs)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {stats.chunks} chunks • {stats.estimatedSizeMB.toFixed(2)} MB
          </span>
          {isExpanded ? (
            <ChevronUp size={14} className="text-gray-400" />
          ) : (
            <ChevronDown size={14} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Document List */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          <div className="max-h-48 overflow-y-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-white border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File size={12} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 truncate" title={doc.filename}>
                      {doc.filename}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {doc.chunkCount} chunks • {formatSize(doc.size)} • {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => doc.id && handleRemove(doc.id)}
                  disabled={removingId === doc.id || isLoading}
                  className="p-1 hover:bg-red-100 rounded transition-colors text-gray-400 hover:text-red-500 disabled:opacity-50"
                  title="Remove document"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <HardDrive size={10} />
              <span>Stored in browser</span>
            </div>
            <button
              onClick={handleClearAll}
              disabled={isClearing || isLoading}
              className="text-[10px] text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : 'Clear All'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentList;
