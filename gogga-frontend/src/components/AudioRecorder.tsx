'use client';

import { Mic } from 'lucide-react';

interface AudioRecorderProps {
  onStartRecording: () => void;
  disabled?: boolean;
}

export default function AudioRecorder({ 
  onStartRecording,
  disabled = false
}: AudioRecorderProps) {
  return (
    <div className="flex items-center justify-center">
      <button
        onClick={onStartRecording}
        disabled={disabled}
        className="p-3 bg-primary-600 rounded-full hover:bg-primary-700 text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Start Recording"
      >
        <Mic size={24} />
      </button>
    </div>
  );
}
