/**
 * File Upload Component
 * Handles document uploads for JIVE/JIGGA tiers
 * JIGGA: Local RAG processing with embedding
 * JIVE: Server-side processing (placeholder)
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, File, X, Check, AlertCircle } from 'lucide-react';
import type { Tier } from '@/hooks/useRAG';

interface FileUploadProps {
  tier: Tier;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  isEmbedding?: boolean;
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

const ACCEPTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.pdf',
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Processing phases for the spinner
const PROCESSING_PHASES = [
  'Reading file',
  'Chunking text',
  'Generating vectors',
  'Indexing',
];

// Custom Orbital Spinner Component
function OrbitalSpinner({ size = 20 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Center dot */}
      <div
        className="absolute rounded-full bg-gray-800"
        style={{
          width: size * 0.2,
          height: size * 0.2,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      {/* Orbiting ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-gray-300 border-t-gray-800"
        style={{ animation: 'spin 0.8s linear infinite' }}
      />
      {/* Outer pulse ring */}
      <div
        className="absolute inset-0 rounded-full border border-gray-400"
        style={{
          animation: 'pulse 1.5s ease-in-out infinite',
          opacity: 0.5,
        }}
      />
      {/* Orbiting dot */}
      <div
        className="absolute"
        style={{
          width: size * 0.15,
          height: size * 0.15,
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          animation: 'orbit 1.2s linear infinite',
          transformOrigin: `50% ${size / 2}px`,
        }}
      >
        <div className="w-full h-full rounded-full bg-gray-700" />
      </div>
      <style jsx>{`
        @keyframes orbit {
          from {
            transform: translateX(-50%) rotate(0deg);
          }
          to {
            transform: translateX(-50%) rotate(360deg);
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
}

export function FileUpload({
  tier,
  onUpload,
  disabled = false,
  isEmbedding = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [processingPhase, setProcessingPhase] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploadEnabled = tier === 'jive' || tier === 'jigga';
  const isProcessing = uploadStatus === 'uploading' || isEmbedding;

  // Cycle through processing phases during upload
  useEffect(() => {
    if (!isProcessing) {
      setProcessingPhase(0);
      return;
    }

    const interval = setInterval(() => {
      setProcessingPhase((prev) => (prev + 1) % PROCESSING_PHASES.length);
    }, 1200);

    return () => clearInterval(interval);
  }, [isProcessing]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ACCEPTED_EXTENSIONS.includes(`.${ext}`)) {
        return `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(
          ', '
        )}`;
      }
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  };

  const handleUpload = useCallback(
    async (file: File) => {
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
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (!isUploadEnabled || disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const firstFile = files[0];
      if (files.length > 0 && firstFile) {
        handleUpload(firstFile);
      }
    },
    [isUploadEnabled, disabled, handleUpload]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isUploadEnabled && !disabled) {
        setIsDragging(true);
      }
    },
    [isUploadEnabled, disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      const firstFile = files?.[0];
      if (files && files.length > 0 && firstFile) {
        handleUpload(firstFile);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleUpload]
  );

  const handleClick = () => {
    if (isUploadEnabled && !disabled && !isProcessing) {
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
        disabled={disabled || isProcessing}
      />

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed
          transition-all cursor-pointer min-w-[140px]
          ${
            isDragging
              ? 'border-gray-600 bg-gray-100'
              : 'border-gray-300 hover:border-gray-400 bg-white'
          }
          ${disabled || isProcessing ? 'opacity-75 cursor-not-allowed' : ''}
          ${isProcessing ? 'border-gray-500 bg-gray-50' : ''}
        `}
      >
        {isProcessing ? (
          <div className="flex items-center gap-2.5">
            <OrbitalSpinner size={18} />
            {/* Dynamic phase text with typing dots */}
            <span className="text-xs text-gray-700 font-medium">
              {PROCESSING_PHASES[processingPhase]}
              <span className="inline-flex w-4">
                <span
                  className="animate-bounce"
                  style={{ animationDelay: '0ms' }}
                >
                  .
                </span>
                <span
                  className="animate-bounce"
                  style={{ animationDelay: '150ms' }}
                >
                  .
                </span>
                <span
                  className="animate-bounce"
                  style={{ animationDelay: '300ms' }}
                >
                  .
                </span>
              </span>
            </span>
          </div>
        ) : uploadStatus === 'success' ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Check size={16} className="text-green-600" />
              <div className="absolute inset-0 animate-ping opacity-50">
                <Check size={16} className="text-green-400" />
              </div>
            </div>
            <span className="text-xs text-green-600 font-medium">Ready!</span>
          </div>
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
            onClick={() => {
              setError(null);
              setUploadStatus('idle');
            }}
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
