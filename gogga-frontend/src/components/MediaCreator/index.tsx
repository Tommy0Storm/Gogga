/**
 * MediaCreator Component
 * 
 * Main entry point for GOGGA's AI media creation tools.
 * Provides access to Image Studio and Video Studio.
 * 
 * Entry points:
 * - ToolShed panel → Media Creator card
 * - Chat integration → "/image" or "/video" commands
 */

'use client';

import { useState, useEffect } from 'react';
import { Image, Video, Sparkles, Crown, X, ChevronLeft } from 'lucide-react';
import { ImageStudio } from './ImageStudio';
import { VideoStudio } from './VideoStudio';
import { type UserTier, TierGate, UpgradePrompt, TIER_LIMITS } from './shared';

interface MediaCreatorProps {
  /** User's subscription tier */
  tier: UserTier;
  /** Usage quotas */
  quota: {
    images: { used: number; limit: number };
    videos: { used: number; limit: number };
  };
  /** Initial view to show */
  initialView?: 'home' | 'image' | 'video';
  /** Initial prompt for generation */
  initialPrompt?: string;
  /** Reference image for editing/img2vid */
  referenceImage?: string;
  /** Callback when user closes the creator */
  onClose?: () => void;
  /** Fullscreen mode (for modal/panel) */
  fullscreen?: boolean;
}

type View = 'home' | 'image' | 'video';

export function MediaCreator({
  tier,
  quota,
  initialView = 'home',
  initialPrompt = '',
  referenceImage,
  onClose,
  fullscreen = false,
}: MediaCreatorProps) {
  const [view, setView] = useState<View>(initialView);
  
  // Update view if initialView changes
  useEffect(() => {
    setView(initialView);
  }, [initialView]);
  
  const isFree = tier === 'free';
  
  // Render home view with studio cards
  const renderHome = () => (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-100 to-pink-100 
                      dark:from-purple-900/30 dark:to-pink-900/30 rounded-full mb-4">
          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            AI Media Creation
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
          Create Amazing Visuals
        </h1>
        <p className="text-neutral-500 mt-2 max-w-md mx-auto">
          Generate stunning images and videos using Google&apos;s latest AI models. 
          {isFree && ' Upgrade to unlock the full experience.'}
        </p>
      </div>
      
      {/* Studio cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Image Studio Card */}
        <button
          onClick={() => setView('image')}
          className="group relative p-6 bg-white dark:bg-neutral-800 rounded-2xl border-2 
                   border-neutral-200 dark:border-neutral-700 hover:border-blue-500 
                   dark:hover:border-blue-400 transition-all text-left"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-linear-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 
                          dark:to-cyan-900/30 rounded-xl group-hover:scale-110 transition-transform">
              <Image className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                Image Studio
              </h3>
              <p className="text-sm text-neutral-500 mb-3">
                Create, edit, and upscale images with Imagen 3 & 4
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded text-xs 
                               text-neutral-600 dark:text-neutral-400">
                  Text to Image
                </span>
                <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded text-xs 
                               text-neutral-600 dark:text-neutral-400">
                  Edit & Inpaint
                </span>
                <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded text-xs 
                               text-neutral-600 dark:text-neutral-400">
                  Upscale 4K
                </span>
              </div>
            </div>
          </div>
          
          {/* Quota indicator */}
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Monthly quota</span>
              <span className="font-medium text-neutral-900 dark:text-white">
                {quota.images.used} / {quota.images.limit}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (quota.images.used / quota.images.limit) * 100)}%` }}
              />
            </div>
          </div>
        </button>
        
        {/* Video Studio Card */}
        <button
          onClick={() => setView('video')}
          className="group relative p-6 bg-white dark:bg-neutral-800 rounded-2xl border-2 
                   border-neutral-200 dark:border-neutral-700 hover:border-purple-500 
                   dark:hover:border-purple-400 transition-all text-left"
        >
          {/* Premium badge for FREE users */}
          {isFree && (
            <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 
                          bg-linear-to-r from-amber-500 to-orange-500 rounded-full 
                          text-white text-xs font-medium shadow-lg">
              <Crown className="w-3 h-3" />
              Premium
            </div>
          )}
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-linear-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 
                          dark:to-pink-900/30 rounded-xl group-hover:scale-110 transition-transform">
              <Video className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                Video Studio
              </h3>
              <p className="text-sm text-neutral-500 mb-3">
                Generate videos from text or images with Veo 3.1
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded text-xs 
                               text-neutral-600 dark:text-neutral-400">
                  Text to Video
                </span>
                <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded text-xs 
                               text-neutral-600 dark:text-neutral-400">
                  Image to Video
                </span>
                <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded text-xs 
                               text-neutral-600 dark:text-neutral-400">
                  Audio Generation
                </span>
              </div>
            </div>
          </div>
          
          {/* Quota indicator or upgrade prompt */}
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
            {isFree ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>Upgrade to create videos</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Monthly quota</span>
                  <span className="font-medium text-neutral-900 dark:text-white">
                    {quota.videos.used} / {quota.videos.limit}
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (quota.videos.used / quota.videos.limit) * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </button>
      </div>
      
      {/* Tier comparison for FREE users */}
      {isFree && (
        <div className="max-w-3xl mx-auto">
          <UpgradePrompt
            type="quality_comparison"
            currentTier={tier}
            featureName="Media Creation"
          />
        </div>
      )}
      
      {/* Feature highlights */}
      <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'HD Quality', desc: 'Up to 4K resolution' },
          { label: 'Fast Generation', desc: '10-30 seconds' },
          { label: 'Edit & Refine', desc: 'Inpaint, mask, upscale' },
          { label: 'South African', desc: 'R pricing, local context' },
        ].map((feature) => (
          <div key={feature.label} className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl text-center">
            <div className="text-sm font-medium text-neutral-900 dark:text-white">
              {feature.label}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {feature.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  // Main render
  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-neutral-900 overflow-y-auto' : ''}`}>
      {/* Navigation header */}
      {view !== 'home' && (
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm 
                      border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setView('home')}
              className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 
                       hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back to Media Creator</span>
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 
                         transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Home header with close */}
      {view === 'home' && onClose && (
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex justify-end">
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 
                       transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className={`max-w-4xl mx-auto p-4 md:p-6 ${fullscreen ? 'pb-20' : ''}`}>
        {view === 'home' && renderHome()}
        
        {view === 'image' && (
          <ImageStudio
            tier={tier}
          />
        )}
        
        {view === 'video' && (
          <VideoStudio
            tier={tier}
            quota={quota.videos}
          />
        )}
      </div>
    </div>
  );
}

// Export all sub-components for direct use
export { ImageStudio } from './ImageStudio';
export { VideoStudio } from './VideoStudio';
export * from './shared';

export default MediaCreator;
