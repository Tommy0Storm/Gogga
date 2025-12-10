/**
 * useVoiceRecording Hook
 * Manages voice recording state and MediaRecorder lifecycle
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceRecordingProps {
  onAudioReady: (audioBlob: Blob) => void;
}

export function useVoiceRecording({ onAudioReady }: UseVoiceRecordingProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setError(undefined);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Keep modal open briefly to show completion state
        setTimeout(() => {
          setIsModalOpen(false);
        }, 1500);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsModalOpen(true);

    } catch (err) {
      console.error("Microphone Error:", err);
      const errorMessage = err instanceof Error 
        ? `Microphone access denied: ${err.message}`
        : "Please allow microphone access to talk to Gogga.";
      
      setError(errorMessage);
      setIsModalOpen(true);
    }
  }, [onAudioReady]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop the recorder without triggering onAudioReady
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      
      // Release hardware resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      chunksRef.current = [];
      setIsRecording(false);
    }
    
    setIsModalOpen(false);
    setError(undefined);
    setRecordingTime(0);
  }, [isRecording]);

  const closeModal = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  return {
    isRecording,
    recordingTime,
    error,
    isModalOpen,
    startRecording,
    stopRecording,
    cancelRecording,
    closeModal,
  };
}
