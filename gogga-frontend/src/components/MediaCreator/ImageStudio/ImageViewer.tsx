/**
 * ImageViewer Component
 * 
 * Displays a generated/edited image with:
 * - SynthID badge (if watermarked)
 * - AI actions panel (Generate video, Inpaint, Outpaint, Export)
 * - Thumbnail gallery for multiple images
 * - Image details (dimensions, prompt, model)
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Video,
  Paintbrush2,
  Expand,
  Download,
  ZoomIn,
  ZoomOut,
  X,
  ChevronLeft,
  ChevronRight,
  Badge,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import type { GeneratedImage, UserTier } from '../shared';
import { downloadBase64Image } from '../shared';

interface ImageViewerProps {
  /** Array of generated images */
  images: GeneratedImage[];
  /** Original prompt used */
  prompt: string;
  /** User's subscription tier */
  tier: UserTier;
  /** Whether images have SynthID watermark (FREE tier) */
  hasWatermark?: boolean;
  /** Image metadata */
  meta?: {
    model?: string;
    aspect_ratio?: string;
    operation?: string;
  };
  /** Callback for Generate video action */
  onGenerateVideo?: (image: GeneratedImage) => void;
  /** Callback for Inpaint action */
  onInpaint?: (image: GeneratedImage) => void;
  /** Callback for Outpaint action */
  onOutpaint?: (image: GeneratedImage) => void;
  /** Callback when viewer is closed */
  onClose?: () => void;
}

interface AIAction {
  id: string;
  icon: typeof Video;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  tierRequired?: UserTier;
}

export function ImageViewer({
  images,
  prompt,
  tier,
  hasWatermark = false,
  meta,
  onGenerateVideo,
  onInpaint,
  onOutpaint,
  onClose,
}: ImageViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  
  const selectedImage = images[selectedIndex];
  const isFree = tier === 'free';
  
  // Navigate between images
  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);
  
  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);
  
  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);
  
  // Export/download
  const handleExport = useCallback(() => {
    if (!selectedImage) return;
    const filename = `gogga-${Date.now()}-${selectedIndex + 1}.png`;
    downloadBase64Image(selectedImage.data, filename, selectedImage.mime_type);
  }, [selectedImage, selectedIndex]);
  
  // AI actions configuration
  const aiActions: AIAction[] = [
    {
      id: 'generate-video',
      icon: Video,
      label: 'Generate video',
      description: 'Create video from this image using Veo',
      onClick: () => selectedImage && onGenerateVideo?.(selectedImage),
      disabled: isFree || !onGenerateVideo,
      tierRequired: 'jive',
    },
    {
      id: 'inpaint',
      icon: Paintbrush2,
      label: 'Inpaint',
      description: 'Add or remove elements with masking',
      onClick: () => selectedImage && onInpaint?.(selectedImage),
      disabled: isFree || !onInpaint,
      tierRequired: 'jive',
    },
    {
      id: 'outpaint',
      icon: Expand,
      label: 'Outpaint',
      description: 'Extend image canvas in any direction',
      onClick: () => selectedImage && onOutpaint?.(selectedImage),
      disabled: isFree || !onOutpaint,
      tierRequired: 'jive',
    },
    {
      id: 'export',
      icon: Download,
      label: 'Export image',
      description: hasWatermark ? 'Download with SynthID watermark' : 'Download full quality image',
      onClick: handleExport,
    },
  ];
  
  if (!selectedImage) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        <p>No image to display</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-900">
      {/* Header with badges and controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          {/* SynthID Badge */}
          {hasWatermark && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 
                          rounded-full text-blue-700 dark:text-blue-400">
              <Badge className="w-4 h-4" />
              <span className="text-xs font-medium">SynthID detected</span>
            </div>
          )}
          
          {/* Model badge */}
          {meta?.model && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 
                          rounded-full text-neutral-600 dark:text-neutral-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs">{meta.model}</span>
            </div>
          )}
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          <span className="text-sm text-neutral-600 dark:text-neutral-400 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
          )}
        </div>
      </div>
      
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Image display */}
        <div className="flex-1 relative overflow-auto flex items-center justify-center p-4">
          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-black/50 
                         hover:bg-white dark:hover:bg-black/70 rounded-full shadow-lg transition-colors z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6 text-neutral-900 dark:text-white" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-black/50 
                         hover:bg-white dark:hover:bg-black/70 rounded-full shadow-lg transition-colors z-10"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6 text-neutral-900 dark:text-white" />
              </button>
            </>
          )}
          
          {/* Image with zoom */}
          <div
            className="relative transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={`data:${selectedImage.mime_type};base64,${selectedImage.data}`}
              alt={prompt}
              className="max-w-full max-h-[60vh] rounded-lg shadow-xl object-contain"
            />
            
            {/* Watermark overlay for FREE tier */}
            {hasWatermark && (
              <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/60 rounded-lg">
                <span className="text-xs text-white/90 font-medium">
                  GOGGA • SynthID Watermark
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* AI Actions Panel (right sidebar) */}
        <div className="w-64 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 
                      flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              AI actions
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {aiActions.map((action) => {
              const Icon = action.icon;
              const needsUpgrade = action.tierRequired && isFree;
              
              return (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`w-full p-3 rounded-xl text-left transition-all group
                            ${action.disabled
                              ? 'opacity-50 cursor-not-allowed bg-neutral-100 dark:bg-neutral-900'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-98'
                            }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      action.disabled
                        ? 'bg-neutral-200 dark:bg-neutral-700'
                        : 'bg-primary-100 dark:bg-primary-900/30 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        action.disabled
                          ? 'text-neutral-400'
                          : 'text-primary-600 dark:text-primary-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          action.disabled
                            ? 'text-neutral-500'
                            : 'text-neutral-900 dark:text-white'
                        }`}>
                          {action.label}
                        </span>
                        {needsUpgrade && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 
                                         text-yellow-700 dark:text-yellow-400 rounded uppercase font-medium">
                            {action.tierRequired}+
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Image details */}
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
              Image details
            </h4>
            <div className="space-y-1.5 text-sm">
              {meta?.aspect_ratio && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Aspect ratio</span>
                  <span className="text-neutral-900 dark:text-white">{meta.aspect_ratio}</span>
                </div>
              )}
              {meta?.operation && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Operation</span>
                  <span className="text-neutral-900 dark:text-white capitalize">
                    {meta.operation.toLowerCase()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">Tier</span>
                <span className="text-neutral-900 dark:text-white uppercase">{tier}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Thumbnail gallery */}
      {images.length > 1 && (
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden 
                          border-2 transition-all ${
                            index === selectedIndex
                              ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900'
                              : 'border-transparent hover:border-neutral-300 dark:hover:border-neutral-600'
                          }`}
              >
                <img
                  src={`data:${image.mime_type};base64,${image.data}`}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {index === selectedIndex && (
                  <div className="absolute inset-0 bg-primary-500/20" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Prompt display (collapsible) */}
      <details className="border-t border-neutral-200 dark:border-neutral-800">
        <summary className="px-4 py-2 cursor-pointer text-sm text-neutral-500 hover:text-neutral-700 
                         dark:hover:text-neutral-300 select-none">
          View prompt
        </summary>
        <div className="px-4 pb-3">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 
                      rounded-lg p-3">
            {prompt}
          </p>
        </div>
      </details>
    </div>
  );
}

export default ImageViewer;
