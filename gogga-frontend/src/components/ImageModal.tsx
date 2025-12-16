/**
 * ImageModal Component
 * Full-screen scrollable modal for viewing generated images
 */

'use client';

import { useEffect, useCallback, useEffectEvent } from 'react';
import { X, Download, Trash2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface ImageModalProps {
  isOpen: boolean;
  imageData: string;
  mimeType: string;
  prompt: string;
  enhancedPrompt?: string;
  onClose: () => void;
  onDelete?: () => void;
  isUrl?: boolean; // If true, imageData is a URL, not base64
}

function ImageModalContent({
  isOpen,
  imageData,
  mimeType,
  prompt,
  enhancedPrompt,
  onClose,
  onDelete,
  isUrl = false,
}: ImageModalProps) {
  // React 19.2: useEffectEvent for stable keyboard handler
  // Prevents event listener re-attachment on every render
  // Always uses latest onClose without being in dependency array
  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  });

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]); // handleKeyDown is stable, not in deps

  if (!isOpen) return null;

  // Handle both URLs and base64 data
  const imageSrc = isUrl 
    ? imageData 
    : (imageData.startsWith('data:') 
        ? imageData 
        : `data:${mimeType};base64,${imageData}`);

  const handleDownload = async () => {
    if (isUrl) {
      // For URLs, fetch and download
      try {
        const response = await fetch(imageData);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gogga-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        // Fallback: open in new tab
        window.open(imageData, '_blank');
      }
    } else {
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = `gogga-image-${Date.now()}.${mimeType.split('/')[1]}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-start justify-center overflow-y-auto"
      onClick={handleBackdropClick}
    >
      {/* Close button - fixed position */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Close"
      >
        <X size={24} className="text-white" />
      </button>

      {/* Action buttons - fixed position */}
      <div className="fixed top-4 left-4 z-50 flex gap-2">
        <button
          onClick={handleDownload}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          aria-label="Download"
          title="Download image"
        >
          <Download size={20} className="text-white" />
        </button>
        {onDelete && (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-full transition-colors"
            aria-label="Delete"
            title="Delete image"
          >
            <Trash2 size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="min-h-full w-full max-w-5xl py-16 px-4 flex flex-col items-center">
        {/* Image */}
        <img
          src={imageSrc}
          alt={prompt}
          className="max-w-full h-auto rounded-lg shadow-2xl"
          style={{ maxHeight: 'none' }} // Allow full height
        />
        
        {/* Prompt info */}
        <div className="mt-6 w-full max-w-2xl bg-white/10 rounded-lg p-4 text-white">
          <div className={enhancedPrompt ? 'mb-3' : ''}>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Prompt</span>
            <p className="text-sm mt-1">{prompt}</p>
          </div>
          {enhancedPrompt && (
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Enhanced Prompt</span>
              <p className="text-sm mt-1 text-gray-300">{enhancedPrompt}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ImageModal(props: ImageModalProps) {
  return (
    <ErrorBoundary fallback={() => (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
          <p className="text-red-500 font-medium">Error loading image modal</p>
          <button
            onClick={props.onClose}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    )}>
      <ImageModalContent {...props} />
    </ErrorBoundary>
  );
}
