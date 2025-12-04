/**
 * ImageModal Component
 * Full-screen scrollable modal for viewing generated images
 */

'use client';

import { useEffect, useCallback } from 'react';
import { X, Download, Trash2 } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  imageData: string;
  mimeType: string;
  prompt: string;
  enhancedPrompt: string;
  onClose: () => void;
  onDelete?: () => void;
}

export default function ImageModal({
  isOpen,
  imageData,
  mimeType,
  prompt,
  enhancedPrompt,
  onClose,
  onDelete,
}: ImageModalProps) {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const imageSrc = imageData.startsWith('data:') 
    ? imageData 
    : `data:${mimeType};base64,${imageData}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `gogga-image-${Date.now()}.${mimeType.split('/')[1]}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <div className="mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Original Prompt</span>
            <p className="text-sm mt-1">{prompt}</p>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Enhanced Prompt</span>
            <p className="text-sm mt-1 text-gray-300">{enhancedPrompt}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
