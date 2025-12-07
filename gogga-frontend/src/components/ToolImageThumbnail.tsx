/**
 * ToolImageThumbnail Component
 * Displays tool-generated image as a small thumbnail
 * Click to expand in a modal (uses same ImageModal as FLUX)
 * For external URLs (Pollinations, AI Horde)
 */

'use client';

import { useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import ImageModal from './ImageModal';

interface ToolImageThumbnailProps {
  imageUrl: string;
  prompt?: string;
  provider?: string;
}

export default function ToolImageThumbnail({ imageUrl, prompt, provider }: ToolImageThumbnailProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="relative w-32 h-24 bg-gray-300 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-400">
        <ImageOff size={24} className="text-gray-500 mb-1" />
        <span className="text-gray-500 text-[10px] font-medium">Failed to load</span>
        {/* Show provider badge even on error */}
        {provider && (
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded">
            {provider === 'pollinations' ? 'FLUX' : provider === 'ai-horde' ? 'Horde' : provider}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div 
        className="relative group cursor-pointer inline-block"
        onClick={() => setIsModalOpen(true)}
      >
        {loading && (
          <div className="w-32 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
            <Loader2 size={20} className="text-gray-400 animate-spin" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={prompt || 'Generated image'}
          className="w-32 h-auto max-h-32 object-contain rounded-lg shadow-md transition-transform group-hover:scale-[1.02] bg-gray-100"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-[10px] font-medium bg-black/50 px-2 py-0.5 rounded-full transition-opacity">
            Expand
          </span>
        </div>
        {/* Engine badge - show underlying AI engine */}
        {provider && (
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded">
            {provider === 'pollinations' ? 'FLUX' : provider === 'ai-horde' ? 'Horde' : provider}
          </div>
        )}
      </div>

      <ImageModal
        isOpen={isModalOpen}
        imageData={imageUrl}
        mimeType="image/png"
        prompt={prompt || 'Tool-generated image'}
        onClose={() => setIsModalOpen(false)}
        isUrl={true}
      />
    </>
  );
}
