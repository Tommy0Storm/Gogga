/**
 * GOGGA RAG Upload Button Component
 * 
 * Handles persistent RAG document store uploads.
 * - FREE: Shows upgrade prompt
 * - JIVE: 1 doc enticement (shows "Add to your RAG collection!")
 * - JIGGA: Full 200 doc access
 * 
 * Key features:
 * - Upload progress with embedding status
 * - Storage usage display
 * - Document processing phases
 * - Tier-appropriate messaging
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { BookOpen, Upload, Lock, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import type { Tier } from '@/lib/config/tierConfig';
import { getTierConfig, canUploadRAGDocuments } from '@/lib/config/tierConfig';
import { POOL_LIMITS } from '@/lib/rag/documentPool';

// Processing phases for visual feedback
const PROCESSING_PHASES = [
  { phase: 'reading', label: 'Reading file' },
  { phase: 'chunking', label: 'Chunking text' },
  { phase: 'embedding', label: 'Generating vectors' },
  { phase: 'indexing', label: 'Indexing' },
  { phase: 'complete', label: 'Complete' },
] as const;

type ProcessingPhase = typeof PROCESSING_PHASES[number]['phase'];

// Accepted file types for RAG documents
const ACCEPTED_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
];

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.doc', '.docx', '.odt', '.rtf'];

// Max file size based on tier
const MAX_FILE_SIZES: Record<Tier, number> = {
  free: 0,           // No RAG for FREE
  jive: 5 * 1024 * 1024,    // 5MB for JIVE (limited)
  jigga: 10 * 1024 * 1024,  // 10MB for JIGGA
} as const;

interface RAGUploadButtonProps {
  tier: Tier;
  currentDocCount: number;
  currentStorageMB: number;
  onUpload: (file: File) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
}

// Orbital spinner for processing animation
function OrbitalSpinner({ size = 20 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
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
      <div
        className="absolute inset-0 rounded-full border-2 border-gray-300 border-t-gray-800 animate-spin"
      />
    </div>
  );
}

export function RAGUploadButton({
  tier,
  currentDocCount,
  currentStorageMB,
  onUpload,
  disabled = false,
}: RAGUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ProcessingPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const tierConfig = getTierConfig(tier);
  const canUpload = canUploadRAGDocuments(tier);
  const maxDocs = tierConfig.ragMaxDocs;
  const maxStorageMB = tierConfig.ragMaxStorageMB;
  const maxFileSizeMB = tierConfig.ragMaxFileSizeMB;
  const remainingSlots = maxDocs - currentDocCount;
  const remainingStorageMB = maxStorageMB - currentStorageMB;
  
  // Validate file before processing
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension) && !ACCEPTED_TYPES.includes(file.type)) {
      return { 
        valid: false, 
        error: `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}` 
      };
    }
    
    // Check file size
    const maxSize = MAX_FILE_SIZES[tier] || 0;
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `File too large. Max size: ${maxFileSizeMB}MB` 
      };
    }
    
    // Check remaining slots
    if (remainingSlots <= 0) {
      return { 
        valid: false, 
        error: `Document limit reached (${maxDocs} docs). Delete some documents to upload more.` 
      };
    }
    
    // Check storage
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > remainingStorageMB) {
      return { 
        valid: false, 
        error: `Not enough storage. ${remainingStorageMB.toFixed(1)}MB remaining, file is ${fileSizeMB.toFixed(1)}MB` 
      };
    }
    
    return { valid: true };
  }, [tier, maxFileSizeMB, remainingSlots, maxDocs, remainingStorageMB]);
  
  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset state
    setError(null);
    setSuccess(false);
    
    // Validate
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // Start processing
    setIsProcessing(true);
    setCurrentPhase('reading');
    
    try {
      // Simulate phase progression (actual phases determined by backend)
      const phases: ProcessingPhase[] = ['reading', 'chunking', 'embedding', 'indexing'];
      let phaseIndex = 0;
      
      const phaseInterval = setInterval(() => {
        phaseIndex++;
        const nextPhase = phases[phaseIndex];
        if (nextPhase) {
          setCurrentPhase(nextPhase);
        }
      }, 800);
      
      // Do the actual upload
      const result = await onUpload(file);
      
      clearInterval(phaseInterval);
      
      if (result.success) {
        setCurrentPhase('complete');
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setCurrentPhase(null);
        }, 2000);
      } else {
        setError(result.error || 'Upload failed');
        setCurrentPhase(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setCurrentPhase(null);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [validateFile, onUpload]);
  
  // FREE tier - show upgrade prompt
  if (!canUpload) {
    return (
      <div className="p-4 rounded-xl border border-gray-200 bg-linear-to-r from-gray-50 to-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-gray-200">
            <Lock size={20} className="text-gray-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">📚 RAG Document Store</h3>
            <p className="text-xs text-gray-500">Persistent document collection</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Upload documents once, use them across all your chats. 
          Semantic search finds relevant context automatically.
        </p>
        <div className="space-y-2 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} />
            <span><strong>JIVE:</strong> 1 doc to try it out</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-gray-700" />
            <span><strong>JIGGA:</strong> 200 docs with full semantic search</span>
          </div>
        </div>
        <button
          className="w-full py-2 px-4 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
        >
          Upgrade to Unlock
        </button>
      </div>
    );
  }
  
  // Get phase info
  const phaseInfo = currentPhase 
    ? PROCESSING_PHASES.find(p => p.phase === currentPhase) 
    : null;
  
  return (
    <div className="space-y-3">
      {/* Storage and count info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <BookOpen size={14} />
          {currentDocCount}/{maxDocs} docs
        </span>
        <span>
          {currentStorageMB.toFixed(1)}/{maxStorageMB}MB
        </span>
      </div>
      
      {/* Upload button */}
      <div>
        <input
          id="rag-upload-input"
          name="rag-upload-input"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isProcessing || remainingSlots <= 0}
          className={`
            w-full py-3 px-4 rounded-lg font-medium text-sm
            flex items-center justify-center gap-2
            transition-all duration-200
            ${isProcessing || success
              ? 'bg-gray-100 border-2 border-gray-300'
              : remainingSlots <= 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-800 text-white hover:bg-gray-700 active:scale-[0.98]'
            }
          `}
        >
          {isProcessing ? (
            <>
              <OrbitalSpinner size={18} />
              <span>{phaseInfo?.label || 'Processing...'}</span>
            </>
          ) : success ? (
            <>
              <CheckCircle size={18} className="text-green-600" />
              <span className="text-green-600">Added to RAG Store!</span>
            </>
          ) : remainingSlots <= 0 ? (
            <>
              <Lock size={18} />
              <span>Document Limit Reached</span>
            </>
          ) : (
            <>
              <Upload size={18} />
              <span>Add to RAG Store</span>
            </>
          )}
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Help text */}
      <p className="text-xs text-gray-400 text-center">
        {tier === 'jive' ? (
          <>
            Try RAG with 1 doc! Upgrade to JIGGA for 200 docs & semantic search.
          </>
        ) : (
          <>
            Add documents to your persistent RAG store. 
            {ACCEPTED_EXTENSIONS.join(', ')} supported.
          </>
        )}
      </p>
      
      {/* JIVE enticement */}
      {tier === 'jive' && currentDocCount >= maxDocs && (
        <div className="p-3 bg-linear-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600 mb-2">
            <strong>Love RAG?</strong> Upgrade to JIGGA for:
          </p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• 200 persistent documents</li>
            <li>• Semantic vector search</li>
            <li>• Cross-session document access</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default RAGUploadButton;
