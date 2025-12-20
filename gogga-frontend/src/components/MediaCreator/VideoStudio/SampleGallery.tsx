/**
 * SampleGallery Component
 * 
 * Shows stunning AI-generated video examples to FREE tier users.
 * Creates desire through visual demonstration of premium features.
 */

'use client';

import { useState } from 'react';
import { Play, Sparkles, Clock, Volume2, Wand2, Crown } from 'lucide-react';
import { UpgradePrompt, type UserTier } from '../shared';

interface SampleVideo {
  id: string;
  title: string;
  prompt: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  hasAudio: boolean;
  resolution: '720p' | '1080p' | '4K';
  tier: 'JIVE' | 'JIGGA';
}

// Sample videos to showcase capabilities
const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: '1',
    title: 'Cape Town Sunset Timelapse',
    prompt: 'Stunning timelapse of the sun setting over Table Mountain in Cape Town, golden hour light painting the clouds in shades of orange and purple, city lights beginning to twinkle below',
    thumbnailUrl: '/samples/video-thumb-1.jpg',
    videoUrl: '/samples/video-1.mp4',
    duration: 8,
    hasAudio: true,
    resolution: '1080p',
    tier: 'JIVE',
  },
  {
    id: '2',
    title: 'African Wildlife Portrait',
    prompt: 'Majestic lion walking through tall golden grass in the Kruger National Park, morning light creating a stunning backlit silhouette, cinematic slow motion',
    thumbnailUrl: '/samples/video-thumb-2.jpg',
    videoUrl: '/samples/video-2.mp4',
    duration: 6,
    hasAudio: true,
    resolution: '4K',
    tier: 'JIGGA',
  },
  {
    id: '3',
    title: 'Johannesburg City Life',
    prompt: 'Drone flight through downtown Johannesburg at night, Nelson Mandela Bridge illuminated in rainbow colors, cars streaming below creating light trails',
    thumbnailUrl: '/samples/video-thumb-3.jpg',
    videoUrl: '/samples/video-3.mp4',
    duration: 8,
    hasAudio: true,
    resolution: '1080p',
    tier: 'JIVE',
  },
  {
    id: '4',
    title: 'Drakensberg Mountains',
    prompt: 'Breathtaking aerial reveal of the Drakensberg mountains at sunrise, mist rolling through valleys, dramatic cliffs catching golden light, ethereal and cinematic',
    thumbnailUrl: '/samples/video-thumb-4.jpg',
    videoUrl: '/samples/video-4.mp4',
    duration: 8,
    hasAudio: true,
    resolution: '4K',
    tier: 'JIGGA',
  },
  {
    id: '5',
    title: 'Traditional Dance',
    prompt: 'Zulu dancers in colorful traditional attire performing a celebratory dance, dust rising from their feet, vibrant beadwork catching the sunlight',
    thumbnailUrl: '/samples/video-thumb-5.jpg',
    videoUrl: '/samples/video-5.mp4',
    duration: 6,
    hasAudio: true,
    resolution: '1080p',
    tier: 'JIVE',
  },
  {
    id: '6',
    title: 'Garden Route Scenic',
    prompt: 'Flying through the lush Garden Route forest, ancient yellowwood trees, turquoise river below, mystical light rays filtering through the canopy',
    thumbnailUrl: '/samples/video-thumb-6.jpg',
    videoUrl: '/samples/video-6.mp4',
    duration: 8,
    hasAudio: true,
    resolution: '4K',
    tier: 'JIGGA',
  },
];

interface SampleGalleryProps {
  /** Current user tier */
  tier: UserTier;
  /** Callback when user wants to try creating */
  onTryCreate?: () => void;
}

export function SampleGallery({ tier, onTryCreate }: SampleGalleryProps) {
  const [selectedVideo, setSelectedVideo] = useState<SampleVideo | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  
  const isFree = tier === 'free';
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Stunning Video Examples
          </h3>
          <p className="text-sm text-neutral-500 mt-1">
            See what&apos;s possible with GOGGA Video Studio
          </p>
        </div>
        
        {isFree && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 
                        dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 
                        dark:border-amber-800">
            <Crown className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Upgrade to create your own
            </span>
          </div>
        )}
      </div>
      
      {/* Gallery grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SAMPLE_VIDEOS.map((video) => (
          <div
            key={video.id}
            className="group relative bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden 
                     cursor-pointer hover:ring-2 hover:ring-neutral-300 dark:hover:ring-neutral-600 
                     transition-all"
            onClick={() => setSelectedVideo(video)}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video">
              {playingVideo === video.id ? (
                <video
                  src={video.videoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  onMouseLeave={() => setPlayingVideo(null)}
                />
              ) : (
                <>
                  <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-300 
                                dark:from-neutral-700 dark:to-neutral-800 flex items-center justify-center">
                    <Wand2 className="w-12 h-12 text-neutral-400 dark:text-neutral-600" />
                  </div>
                  
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 
                                opacity-0 group-hover:opacity-100 transition-opacity"
                       onMouseEnter={() => setPlayingVideo(video.id)}>
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-6 h-6 text-neutral-900 ml-0.5" />
                    </div>
                  </div>
                </>
              )}
              
              {/* Tier badge */}
              <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium
                            ${video.tier === 'JIGGA' 
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                              : 'bg-neutral-900 text-white'}`}>
                {video.tier}
              </div>
              
              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white 
                            flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {video.duration}s
              </div>
              
              {/* Audio indicator */}
              {video.hasAudio && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white 
                              flex items-center gap-1">
                  <Volume2 className="w-3 h-3" />
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="p-3">
              <h4 className="font-medium text-neutral-900 dark:text-white text-sm">
                {video.title}
              </h4>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                {video.prompt}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-xs 
                               text-neutral-600 dark:text-neutral-400">
                  {video.resolution}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Video detail modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
             onClick={() => setSelectedVideo(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            {/* Video player */}
            <div className="relative aspect-video bg-black">
              <video
                src={selectedVideo.videoUrl}
                className="w-full h-full object-contain"
                controls
                autoPlay
              />
            </div>
            
            {/* Details */}
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {selectedVideo.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium
                                    ${selectedVideo.tier === 'JIGGA' 
                                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                                      : 'bg-neutral-900 text-white'}`}>
                      {selectedVideo.tier}
                    </span>
                    <span className="text-sm text-neutral-500">
                      {selectedVideo.duration}s • {selectedVideo.resolution}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="p-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  ✕
                </button>
              </div>
              
              {/* Prompt */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="text-xs text-neutral-500 mb-1">Prompt used:</div>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  {selectedVideo.prompt}
                </p>
              </div>
              
              {/* CTA for FREE users */}
              {isFree && (
                <UpgradePrompt
                  type="feature_locked"
                  currentTier={tier}
                  featureName="Video Generation"
                />
              )}
              
              {/* Create similar button */}
              {!isFree && onTryCreate && (
                <button
                  onClick={() => {
                    setSelectedVideo(null);
                    onTryCreate();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 
                           dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 
                           dark:hover:bg-neutral-100 transition-colors"
                >
                  <Sparkles className="w-5 h-5" />
                  Create Similar Video
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Upgrade CTA for FREE users */}
      {isFree && (
        <div className="mt-8">
          <UpgradePrompt
            type="feature_locked"
            currentTier={tier}
            featureName="Video Generation"
          />
        </div>
      )}
    </div>
  );
}

export default SampleGallery;
