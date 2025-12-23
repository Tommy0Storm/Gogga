/**
 * AudioPlayerModal
 * 
 * Full-screen overlay audio player with:
 * - Play/Pause/Stop controls
 * - Seekable progress bar
 * - Time display (current / total)
 * 
 * Uses backend TTS endpoint which calls Google Cloud TTS with service account.
 * WaveNet voices for quality at reasonable cost ($16/million chars).
 * 1 million free chars/month for Neural voices.
 */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Volume2, X } from 'lucide-react';

interface AudioPlayerModalProps {
  text: string;
  onClose: () => void;
}

/**
 * Clean text for speech synthesis
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'code block omitted')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/__TOOL_.*?__:[^\n]*/g, '')
    .replace(/\n{3,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format seconds as MM:SS
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayerModal({ text, onClose }: AudioPlayerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Update progress from audio element
   */
  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, []);

  /**
   * Handle play
   */
  const handlePlay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [updateProgress]);

  /**
   * Handle pause
   */
  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, []);

  /**
   * Handle stop and close
   */
  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    onClose();
  }, [onClose]);

  /**
   * Handle seek
   */
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !isFinite(duration) || duration === 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTime = percentage * duration;
    
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  }, [duration]);

  /**
   * Load audio via backend TTS endpoint
   */
  useEffect(() => {
    let isMounted = true;
    
    const loadAudio = async () => {
      const cleanText = cleanTextForSpeech(text);
      if (!cleanText) {
        setError('No text to speak');
        setIsLoading(false);
        return;
      }
      
      try {
        // Call backend TTS endpoint
        const response = await fetch('/api/v1/tts/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            voice_name: 'en-US-Wavenet-D',  // Male WaveNet voice
            language_code: 'en-US',
            speaking_rate: 1.0,
            pitch: 0.0
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        const data = await response.json();
        const audioContent = data.audio_content;
        
        if (!audioContent) {
          throw new Error('No audio generated');
        }

        if (!isMounted) return;

        // Create audio element with base64 MP3
        const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
        audioRef.current = audio;
        
        // Set initial duration estimate
        if (data.duration_estimate) {
          setDuration(data.duration_estimate);
        }
        
        // Wait for audio to be ready
        audio.addEventListener('loadedmetadata', () => {
          if (isMounted && isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        });
        
        audio.addEventListener('canplaythrough', () => {
          if (isMounted) {
            setIsLoading(false);
            // Auto-play
            audio.play();
            setIsPlaying(true);
            animationFrameRef.current = requestAnimationFrame(updateProgress);
          }
        });
        
        audio.addEventListener('ended', () => {
          if (isMounted) {
            setIsPlaying(false);
            setCurrentTime(duration);
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
          }
        });
        
        audio.addEventListener('error', (e) => {
          if (isMounted) {
            console.error('Audio error:', e);
            setError('Failed to play audio');
            setIsLoading(false);
          }
        });
        
        // Start loading
        audio.load();
        
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load audio');
          setIsLoading(false);
        }
      }
    };

    loadAudio();
    
    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-primary-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 size={24} />
            <span className="font-semibold">Gogga Reading Aloud</span>
          </div>
          <button
            onClick={handleStop}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-primary-600 font-medium">Loading audio...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={handleStop}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div
                className="h-3 bg-primary-100 rounded-full cursor-pointer mb-4 overflow-hidden relative"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-sm text-primary-500 mb-6">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                {/* Stop */}
                <button
                  onClick={handleStop}
                  className="p-3 bg-primary-100 text-primary-700 rounded-full hover:bg-primary-200 transition-colors"
                  title="Stop"
                >
                  <Square size={24} />
                </button>

                {/* Play/Pause */}
                <button
                  onClick={isPlaying ? handlePause : handlePlay}
                  className="p-5 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors shadow-lg"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                </button>

                {/* Spacer for symmetry */}
                <div className="w-12" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
