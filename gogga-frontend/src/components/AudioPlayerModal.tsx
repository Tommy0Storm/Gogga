/**
 * AudioPlayerModal
 * 
 * Full-screen overlay audio player for Read Aloud feature.
 * Uses the useTextToSpeech hook which:
 * - Uses Gemini 2.5 Flash TTS with Charon voice (GOGGA's signature)
 * - Chunks text into ~50 words at sentence boundaries for cost savings
 * - When cancelled, stops fetching remaining chunks (no wasted API calls)
 * 
 * JIGGA tier only.
 */
'use client';

import React, { useEffect } from 'react';
import { Play, Pause, Square, Volume2, X, Loader2 } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface AudioPlayerModalProps {
  text: string;
  onClose: () => void;
}

export function AudioPlayerModal({ text, onClose }: AudioPlayerModalProps) {
  const { speak, stop, isPlaying, isLoading, error } = useTextToSpeech({
    onEnd: () => {
      // Audio finished playing
    },
    onError: (err) => {
      console.error('[AudioPlayerModal] TTS error:', err);
    },
  });

  // Start speaking when modal opens
  useEffect(() => {
    if (text) {
      speak(text);
    }
    
    return () => {
      stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  /**
   * Handle play/pause toggle
   */
  const handleToggle = () => {
    if (isPlaying || isLoading) {
      stop();
    } else {
      speak(text);
    }
  };

  /**
   * Handle stop and close
   */
  const handleStop = () => {
    stop();
    onClose();
  };

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
          {error ? (
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
              {/* Status indicator */}
              <div className="flex items-center justify-center gap-2 mb-6 text-primary-600">
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span className="font-medium">Loading audio...</span>
                  </>
                ) : isPlaying ? (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-4 bg-primary-600 rounded-full animate-pulse" />
                      <span className="w-1 h-6 bg-primary-600 rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-5 bg-primary-600 rounded-full animate-pulse delay-150" />
                      <span className="w-1 h-4 bg-primary-600 rounded-full animate-pulse delay-200" />
                    </div>
                    <span className="font-medium ml-2">Playing...</span>
                  </>
                ) : (
                  <span className="font-medium text-primary-400">Paused</span>
                )}
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
                  onClick={handleToggle}
                  className="p-5 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors shadow-lg"
                  title={isPlaying || isLoading ? 'Stop' : 'Play'}
                >
                  {isPlaying || isLoading ? (
                    <Pause size={32} />
                  ) : (
                    <Play size={32} className="ml-1" />
                  )}
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
