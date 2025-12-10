/**
 * VoiceRecordingModal Component
 * Modal interface for voice recording with visual feedback
 */

'use client';

import { useEffect, useCallback } from 'react';
import { X, Mic, Square, AlertCircle, Check } from 'lucide-react';

interface VoiceRecordingModalProps {
  isOpen: boolean;
  isRecording: boolean;
  recordingTime: number;
  error?: string;
  onClose: () => void;
  onStop: () => void;
}

export default function VoiceRecordingModal({
  isOpen,
  isRecording,
  recordingTime,
  error,
  onClose,
  onStop,
}: VoiceRecordingModalProps) {
  // Handle escape key to cancel
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

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Mic size={24} className={isRecording ? 'text-primary-500' : 'text-gray-400'} />
            Voice Recording
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Cancel recording"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Recording Status */}
        <div className="flex flex-col items-center justify-center py-8">
          {isRecording ? (
            <>
              {/* Animated Recording Indicator */}
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-primary-500/20 flex items-center justify-center animate-pulse">
                  <div className="w-20 h-20 rounded-full bg-primary-500/40 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center">
                      <Mic size={32} className="text-white" />
                    </div>
                  </div>
                </div>
                {/* Pulse animation */}
                <div className="absolute inset-0 rounded-full bg-primary-500/30 animate-ping"></div>
              </div>

              {/* Recording Timer */}
              <div className="text-4xl font-mono font-bold text-white mb-2">
                {formatTime(recordingTime)}
              </div>
              <p className="text-gray-400 text-sm mb-8">Recording in progress...</p>

              {/* Stop Button */}
              <button
                onClick={onStop}
                className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full font-medium transition-colors flex items-center gap-2 shadow-lg"
                aria-label="Stop recording"
              >
                <Square size={20} />
                Stop Recording
              </button>
            </>
          ) : (
            <>
              {/* Completed State */}
              <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-green-500/40 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                    <Check size={32} className="text-white" strokeWidth={3} />
                  </div>
                </div>
              </div>
              <p className="text-white text-lg mb-2">Recording Complete</p>
              <p className="text-gray-400 text-sm">
                Audio captured successfully. Transcription coming soon.
              </p>
            </>
          )}
        </div>

        {/* Cancel Button (only show while recording) */}
        {isRecording && (
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
