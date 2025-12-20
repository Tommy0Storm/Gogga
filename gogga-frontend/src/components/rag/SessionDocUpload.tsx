/**
 * GOGGA Session Document Upload (Paperclip)
 * 
 * Handles temporary session-scoped document uploads.
 * Documents are tied to the current chat session only.
 * 
 * - FREE: 1 doc, 2MB (enticement)
 * - JIVE: 10 docs, 50MB
 * - JIGGA: 10 docs, 50MB
 * 
 * Key difference from RAGUploadButton:
 * - Session docs are ephemeral (belong to one chat session)
 * - RAG store docs are persistent (belong to user, activated per session)
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, Upload, X, FileText, AlertCircle, Loader2 } from 'lucide-react';
import type { Tier } from '@/lib/config/tierConfig';
import { getTierConfig, canUploadSessionDocuments } from '@/lib/config/tierConfig';

// Accepted file types (same as RAG for consistency)
const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.doc', '.docx', '.odt', '.rtf'];

interface SessionDocUploadProps {
  tier: Tier;
  sessionId: string;
  currentDocCount: number;
  currentStorageMB: number;
  onUpload: (file: File) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
  compact?: boolean;  // Smaller button for inline use
}

export function SessionDocUpload({
  tier,
  sessionId,
  currentDocCount,
  currentStorageMB,
  onUpload,
  disabled = false,
  compact = false,
}: SessionDocUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  
  const tierConfig = getTierConfig(tier);
  const canUpload = canUploadSessionDocuments(tier);
  const maxDocs = tierConfig.sessionMaxDocs;
  const maxStorageMB = tierConfig.sessionMaxStorageMB;
  const maxFileSizeMB = tierConfig.sessionMaxFileSizeMB;
  const remainingSlots = maxDocs - currentDocCount;
  const remainingStorageMB = maxStorageMB - currentStorageMB;
  
  // Validate file
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      return { 
        valid: false, 
        error: `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}` 
      };
    }
    
    // Check file size
    const maxSizeBytes = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { 
        valid: false, 
        error: `File too large. Max size: ${maxFileSizeMB}MB` 
      };
    }
    
    // Check remaining slots
    if (remainingSlots <= 0) {
      return { 
        valid: false, 
        error: `Document limit reached (${maxDocs} for this session)` 
      };
    }
    
    // Check storage
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > remainingStorageMB) {
      return { 
        valid: false, 
        error: `Not enough storage for this session` 
      };
    }
    
    return { valid: true };
  }, [maxFileSizeMB, remainingSlots, maxDocs, remainingStorageMB]);
  
  // Handle file upload
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const result = await onUpload(file);
      if (!result.success) {
        setError(result.error || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [validateFile, onUpload]);
  
  // Handle file input change
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);
  
  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);
  
  // Compact version for chat input
  if (compact) {
    return (
      <div className="relative">
        <input
          id="session-doc-upload-compact"
          name="session-doc-upload-compact"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading || remainingSlots <= 0 || !canUpload}
          title={
            !canUpload 
              ? 'Document uploads available with subscription'
              : remainingSlots <= 0
                ? `Document limit reached (${maxDocs})`
                : `Attach document (${remainingSlots} slots remaining)`
          }
          className={`
            p-2 rounded-lg transition-colors
            ${isUploading
              ? 'bg-gray-100 cursor-wait'
              : !canUpload || remainingSlots <= 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }
          `}
        >
          {isUploading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Paperclip size={20} />
          )}
        </button>
        
        {/* Error tooltip */}
        {error && (
          <div className="absolute bottom-full mb-2 left-0 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 whitespace-nowrap shadow-lg">
            <div className="flex items-center gap-1">
              <AlertCircle size={12} />
              {error}
            </div>
            <button 
              onClick={() => setError(null)} 
              className="absolute top-1 right-1 text-red-400 hover:text-red-600"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Full version with drop zone
  return (
    <div className="space-y-3">
      <input
        id="session-doc-upload-full"
        name="session-doc-upload-full"
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && canUpload && remainingSlots > 0 && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-6
          flex flex-col items-center justify-center gap-2
          transition-all cursor-pointer
          ${dragOver
            ? 'border-gray-400 bg-gray-100'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }
          ${!canUpload || remainingSlots <= 0 || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 size={24} className="animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Uploading...</span>
          </>
        ) : (
          <>
            <Paperclip size={24} className="text-gray-400" />
            <span className="text-sm text-gray-600 font-medium">
              Drop file or click to upload
            </span>
            <span className="text-xs text-gray-400">
              For this chat session only • {remainingSlots} slots remaining
            </span>
          </>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}
      
      {/* Usage info */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{currentDocCount}/{maxDocs} docs in session</span>
        <span>{currentStorageMB.toFixed(1)}/{maxStorageMB}MB used</span>
      </div>
    </div>
  );
}

export default SessionDocUpload;
