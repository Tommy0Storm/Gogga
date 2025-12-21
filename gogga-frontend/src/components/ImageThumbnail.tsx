/**
 * ImageThumbnail Component
 * Displays generated image thumbnail in chat
 * Shows placeholder for deleted images
 * Click to expand in modal
 */

'use client';

import { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';
import { getImage, type GeneratedImage } from '@/lib/db';
import ImageModal from './ImageModal';

interface ImageThumbnailProps {
  imageId: number;
  onDelete?: () => void;
}

export default function ImageThumbnail({ imageId, onDelete }: ImageThumbnailProps) {
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const loadImage = async () => {
      try {
        const img = await getImage(imageId);
        if (mounted) {
          setImage(img || null);
        }
      } catch (err) {
        console.error('Failed to load image:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    loadImage();
    
    return () => {
      mounted = false;
    };
  }, [imageId]);

  const handleDelete = async () => {
    if (onDelete) {
      onDelete();
    }
    // Reload to show deleted state
    try {
      const img = await getImage(imageId);
      setImage(img || null);
    } catch (err) {
      console.error('Failed to reload image:', err);
    }
  };

  if (loading) {
    return (
      <div className="w-64 h-64 bg-gray-200 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-400 text-xs">Loading...</span>
      </div>
    );
  }

  // Deleted image placeholder
  if (!image || image.isDeleted) {
    return (
      <div className="w-64 h-64 bg-gray-300 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-400">
        <ImageOff size={48} className="text-gray-500 mb-2" />
        <span className="text-gray-500 text-xs font-medium">Image Deleted</span>
      </div>
    );
  }

  const thumbnailSrc = `data:image/jpeg;base64,${image.thumbnailData}`;

  return (
    <>
      <div 
        className="relative group cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        <img
          src={thumbnailSrc}
          alt={image.prompt}
          className="w-64 h-auto rounded-lg shadow-md transition-transform group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium bg-black/50 px-3 py-1 rounded-full transition-opacity">
            Click to expand
          </span>
        </div>
        {/* Size badge */}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
          {image.width}×{image.height}
        </div>
      </div>

      <ImageModal
        isOpen={isModalOpen}
        imageData={image.fullImageData}
        mimeType={image.mimeType}
        prompt={image.prompt}
        enhancedPrompt={image.enhancedPrompt}
        onClose={() => setIsModalOpen(false)}
        onDelete={handleDelete}
      />
    </>
  );
}
