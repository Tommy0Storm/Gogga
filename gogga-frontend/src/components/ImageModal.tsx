/**
 * ImageModal Component
 * Full-screen scrollable modal for viewing generated images
 * 
 * OPTIMIZATION: Uses object URLs instead of inline base64 to prevent
 * browser memory issues with large Imagen 3.0 images (5-10MB).
 */

'use client';

import { useEffect, useState, useEffectEvent } from 'react';
import { X, Download, Trash2, Loader2 } from 'lucide-react';
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
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // React 19.2: useEffectEvent for stable keyboard handler
  // Prevents event listener re-attachment on every render
  // Always uses latest onClose without being in dependency array
  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  });

  // Convert base64 to object URL for better memory handling
  // Object URLs are more efficient than inline base64 for large images
  useEffect(() => {
    if (!isOpen || isUrl) {
      setObjectUrl(null);
      return;
    }

    // For base64 data, convert to blob and create object URL
    try {
      const base64Data = imageData.startsWith('data:') 
        ? imageData.split(',')[1] 
        : imageData;
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType || 'image/png' });
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      setImageError(false);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error('[ImageModal] Failed to create object URL:', err);
      setImageError(true);
    }
  }, [isOpen, imageData, mimeType, isUrl]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setIsImageLoading(true);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]); // handleKeyDown is stable, not in deps

  if (!isOpen) return null;

  // Use object URL for base64, or direct URL
  const imageSrc = isUrl ? imageData : objectUrl;

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
    } else if (objectUrl) {
      // Use the already-created object URL
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `gogga-image-${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
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
        {/* Loading state */}
        {(isImageLoading || (!imageSrc && !imageError)) && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={48} className="text-white animate-spin" />
            <p className="text-white/70 mt-4">Loading image...</p>
          </div>
        )}

        {/* Error state */}
        {imageError && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-400">Failed to load image</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30"
            >
              Close
            </button>
          </div>
        )}

        {/* Image - only render when we have a valid src */}
        {imageSrc && !imageError && (
          <img
            src={imageSrc}
            alt={prompt}
            className={`max-w-full h-auto rounded-lg shadow-2xl transition-opacity duration-300 ${
              isImageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ maxHeight: 'none' }} // Allow full height
            onLoad={() => setIsImageLoading(false)}
            onError={() => {
              setIsImageLoading(false);
              setImageError(true);
            }}
          />
        )}
        
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
