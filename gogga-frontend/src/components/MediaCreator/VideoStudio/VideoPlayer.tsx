/**
 * VideoPlayer Component
 * 
 * Custom video player for generated content.
 * Includes download option and video controls.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Download, RefreshCw, Share2 } from 'lucide-react';
import type { VideoResponse } from '../shared';

interface VideoPlayerProps {
  /** Video response with URL or base64 data */
  response: VideoResponse;
  /** Auto play on mount */
  autoPlay?: boolean;
  /** Show download button */
  showDownload?: boolean;
  /** Callback for generating new video */
  onGenerateNew?: () => void;
}

export function VideoPlayer({
  response,
  autoPlay = false,
  showDownload = true,
  onGenerateNew,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  
  // Convert base64 to Blob URL to avoid large data URLs in memory
  useEffect(() => {
    if (response.video_data) {
      try {
        const byteCharacters = atob(response.video_data);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        
        // Cleanup on unmount or when video data changes
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error('Failed to convert video data to blob:', err);
      }
    }
  }, [response.video_data]);
  
  // Use blob URL if available, otherwise fall back to video_url
  const videoSrc = blobUrl || response.video_url || '';
  
  // Track play promise to avoid race condition
  const playPromiseRef = useRef<Promise<void> | null>(null);
  
  // Play/pause - handle async play() to avoid AbortError
  const togglePlay = async () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      // Wait for any pending play() to complete before pausing
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current;
        } catch {
          // Ignore - play was already interrupted
        }
        playPromiseRef.current = null;
      }
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Store the play promise to handle race conditions
      playPromiseRef.current = videoRef.current.play();
      try {
        await playPromiseRef.current;
        setIsPlaying(true);
      } catch (err) {
        // Play was interrupted (e.g., user paused quickly) - ignore
        console.debug('[VideoPlayer] Play interrupted:', err);
      }
      playPromiseRef.current = null;
    }
  };
  
  // Mute toggle
  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };
  
  // Fullscreen
  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (!isFullscreen) {
      videoRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };
  
  // Handle progress click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = percent * duration;
  };
  
  // Download video
  const handleDownload = async () => {
    try {
      let downloadUrl: string;
      let shouldRevoke = false;
      
      if (blobUrl) {
        // Already have a blob URL - use it directly
        downloadUrl = blobUrl;
      } else if (response.video_url) {
        // Fetch from URL and create blob
        const res = await fetch(response.video_url);
        const blob = await res.blob();
        downloadUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      } else {
        return;
      }
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `gogga-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Only revoke if we created a new URL for the download
      if (shouldRevoke) {
        URL.revokeObjectURL(downloadUrl);
      }
      
    } catch (err) {
      console.error('Download failed:', err);
    }
  };
  
  // Update progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / video.duration) * 100);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!videoSrc) {
    return (
      <div className="p-8 text-center bg-neutral-100 dark:bg-neutral-800 rounded-lg">
        <p className="text-neutral-500">Video not available</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Video container */}
      <div className="relative group bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full aspect-video"
          playsInline
          autoPlay={autoPlay}
          onClick={togglePlay}
        />
        
        {/* Play button overlay */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-8 h-8 text-neutral-900 ml-1" />
            </div>
          </button>
        )}
        
        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent 
                      opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="h-1 bg-white/30 rounded-full mb-2 cursor-pointer"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Control buttons */}
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            
            <button onClick={toggleMute} className="text-white hover:text-white/80 transition-colors">
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            <span className="text-white text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            
            <div className="flex-1" />
            
            <button onClick={toggleFullscreen} className="text-white hover:text-white/80 transition-colors">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Info and actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">
          {response.duration_seconds}s • {response.meta.generate_audio ? 'With audio' : 'No audio'}
          {response.meta.cost_zar && ` • R${response.meta.cost_zar.toFixed(2)}`}
        </div>
        
        <div className="flex items-center gap-2">
          {showDownload && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 dark:bg-white text-white 
                       dark:text-neutral-900 text-sm rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 
                       transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
          
          {onGenerateNew && (
            <button
              onClick={onGenerateNew}
              className="flex items-center gap-1 px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 
                       text-neutral-700 dark:text-neutral-300 text-sm rounded-lg hover:bg-neutral-50 
                       dark:hover:bg-neutral-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              New Video
            </button>
          )}
        </div>
      </div>
      
      {/* Prompt used */}
      <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
        <div className="text-xs text-neutral-500 mb-1">Prompt used:</div>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {response.prompt}
        </p>
      </div>
    </div>
  );
}

export default VideoPlayer;
