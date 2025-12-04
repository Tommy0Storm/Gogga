/**
 * File Upload Component
 * Handles document uploads for JIVE/JIGGA tiers
 * JIGGA: Local RAG processing
 * JIVE: Server-side processing (placeholder)
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, File, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { Tier } from '@/hooks/useRAG';

interface FileUploadProps {
  tier: Tier;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

// Supported RAG document types (no Excel - use PDF/Word for data)
const ACCEPTED_TYPES = [
  // Text formats
  'text/plain',
  'text/markdown',
  'application/x-markdown',
  
  // PDF
  'application/pdf',
  
  // Microsoft Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  
  // OpenDocument formats
  'application/vnd.oasis.opendocument.text',
  
  // Rich Text
  'application/rtf',
  'text/rtf',
];

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.doc', '.docx', '.odt', '.rtf'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUpload({ tier, onUpload, disabled = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploadEnabled = tier === 'jive' || tier === 'jigga';

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ACCEPTED_EXTENSIONS.includes(`.${ext}`)) {
        return `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`;
      }
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  };

  const handleUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    setError(null);

    try {
      await onUpload(file);
      setUploadStatus('success');
      setTimeout(() => setUploadStatus('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadStatus('error');
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (!isUploadEnabled || disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  }, [isUploadEnabled, disabled, handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isUploadEnabled && !disabled) {
      setIsDragging(true);
    }
  }, [isUploadEnabled, disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleUpload]);

  const handleClick = () => {
    if (isUploadEnabled && !disabled && uploadStatus !== 'uploading') {
      fileInputRef.current?.click();
    }
  };

  if (!isUploadEnabled) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 px-3 py-2 bg-gray-100 rounded-lg">
        <Upload size={14} />
        <span>Upgrade to JIVE or JIGGA for file uploads</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploadStatus === 'uploading'}
      />

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed
          transition-all cursor-pointer
          ${isDragging 
            ? 'border-gray-600 bg-gray-100' 
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
          ${disabled || uploadStatus === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {uploadStatus === 'uploading' ? (
          <>
            <Loader2 size={16} className="animate-spin text-gray-600" />
            <span className="text-xs text-gray-600">Processing...</span>
          </>
        ) : uploadStatus === 'success' ? (
          <>
            <Check size={16} className="text-green-600" />
            <span className="text-xs text-green-600">Uploaded!</span>
          </>
        ) : uploadStatus === 'error' ? (
          <>
            <AlertCircle size={16} className="text-red-500" />
            <span className="text-xs text-red-500">Failed</span>
          </>
        ) : (
          <>
            <Upload size={16} className="text-gray-500" />
            <span className="text-xs text-gray-600">
              {tier === 'jigga' ? 'Add to RAG' : 'Upload'}
            </span>
          </>
        )}
      </div>

      {error && uploadStatus === 'error' && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-red-50 border border-red-200 rounded px-2 py-1">
          <p className="text-[10px] text-red-600">{error}</p>
          <button
            onClick={() => { setError(null); setUploadStatus('idle'); }}
            className="absolute top-1 right-1"
          >
            <X size={10} className="text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}

export default FileUpload;
