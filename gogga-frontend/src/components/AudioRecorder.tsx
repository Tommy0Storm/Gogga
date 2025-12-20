'use client';

import { useState, useRef } from 'react';
import { Mic, Square } from 'lucide-react';

interface AudioRecorderProps {
  onAudioReady: (audioBlob: Blob) => void;
}

export default function AudioRecorder({ onAudioReady }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      // Check for secure context - getUserMedia requires HTTPS (except localhost)
      if (!navigator.mediaDevices?.getUserMedia) {
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const isSecure = typeof window !== 'undefined' && window.isSecureContext;
        
        if (!isSecure && !isLocalhost) {
          alert('Voice recording requires HTTPS. Please access via https:// instead of http://');
          return;
        }
        alert('Microphone API not available. Please use a modern browser.');
        return;
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine supported mimeType (Safari supports mp4/aac, Chrome webm/opus)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        // Create final Blob
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onAudioReady(blob);
        chunksRef.current = [];

        // Stop all tracks to release hardware resource
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

    } catch (err) {
      console.error("Microphone Error:", err);
      alert("Please allow microphone access to talk to Gogga.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex items-center justify-center">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="p-3 bg-primary-600 rounded-full hover:bg-primary-700 text-white shadow-lg transition-transform hover:scale-105"
          aria-label="Start Recording"
        >
          <Mic size={24} />
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="p-3 bg-primary-900 rounded-full hover:bg-primary-800 text-white shadow-lg animate-pulse"
          aria-label="Stop Recording"
        >
          <Square size={24} />
        </button>
      )}
    </div>
  );
}
