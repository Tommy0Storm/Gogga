/**
 * useTextToSpeech Hook
 * 
 * Synthesizes speech from text using Google's Gemini TTS model.
 * Uses the Charon voice for consistent GOGGA identity (same as GoggaTalk).
 * 
 * OPTIMIZATION: Splits text into 2-3 sentence chunks for faster initial playback.
 * First chunk starts playing quickly while remaining chunks are fetched.
 * Uses a single AudioContext to avoid browser crashes.
 * 
 * JIGGA tier only - provides a "read aloud" feature for assistant responses.
 */
'use client';

import { useState, useRef, useCallback } from 'react';

// Audio settings matching Gemini output
const OUTPUT_SAMPLE_RATE = 24000;

// Chunk size: 2-3 sentences for good prosody and quick start
const SENTENCES_PER_CHUNK = 3;

interface UseTextToSpeechOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

/**
 * Clean text for speech synthesis - remove markdown, code blocks, etc.
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'code block omitted') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text
    .replace(/#{1,6}\s*/g, '') // Remove headers
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Remove bold/italic
    .replace(/__TOOL_.*?__:[^\n]*/g, '') // Remove tool markers
    .replace(/\n{3,}/g, '. ') // Convert multiple newlines to periods
    .replace(/\n/g, ' ') // Convert single newlines to spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Split text into chunks of 2-3 sentences for optimal TTS
 */
function splitIntoChunks(text: string): string[] {
  // Split on sentence boundaries
  const sentences = text.match(/[^.!?]*[.!?]+/g) || [text];
  const chunks: string[] = [];
  
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_CHUNK) {
    const chunk = sentences.slice(i, i + SENTENCES_PER_CHUNK).join(' ').trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }
  
  return chunks.length > 0 ? chunks : [text];
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);
  const isPlayingQueueRef = useRef(false);

  /**
   * Get or create AudioContext (reuse single instance)
   */
  const getAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Stop any currently playing audio and cancel pending requests
   */
  const stop = useCallback(() => {
    isCancelledRef.current = true;
    isPlayingQueueRef.current = false;
    audioQueueRef.current = [];
    
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // Already stopped
      }
      currentSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  /**
   * Fetch TTS audio for a chunk of text
   */
  const fetchChunkAudio = useCallback(async (
    chunkText: string,
    apiKey: string,
    signal: AbortSignal
  ): Promise<AudioBuffer | null> => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: chunkText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Charon' } // Same as GoggaTalk
              }
            }
          }
        }),
        signal,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      return null;
    }

    // Decode base64 and convert PCM Int16 to AudioBuffer
    const audioBytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
    const audioContext = await getAudioContext();
    
    const pcmData = new Int16Array(audioBytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      const sample = pcmData[i];
      floatData[i] = sample !== undefined ? sample / 32768.0 : 0;
    }
    
    const audioBuffer = audioContext.createBuffer(1, floatData.length, OUTPUT_SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(floatData);
    
    return audioBuffer;
  }, [getAudioContext]);

  /**
   * Play next buffer from queue
   */
  const playNextFromQueue = useCallback(async () => {
    if (isCancelledRef.current || !isPlayingQueueRef.current) {
      return;
    }

    const buffer = audioQueueRef.current.shift();
    if (!buffer) {
      // Queue empty, we're done
      setIsPlaying(false);
      isPlayingQueueRef.current = false;
      options.onEnd?.();
      return;
    }

    const audioContext = await getAudioContext();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    
    currentSourceRef.current = source;
    
    source.onended = () => {
      currentSourceRef.current = null;
      // Play next buffer when this one ends
      playNextFromQueue();
    };
    
    source.start();
  }, [getAudioContext, options]);

  /**
   * Synthesize and play speech with chunked streaming for fast start
   */
  const speak = useCallback(async (text: string) => {
    stop();
    isCancelledRef.current = false;
    
    if (!text.trim()) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) {
      const errorMsg = 'Google API key not configured';
      setError(errorMsg);
      options.onError?.(errorMsg);
      return;
    }

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    const chunks = splitIntoChunks(cleanText);
    
    setIsLoading(true);
    setError(null);
    options.onStart?.();

    try {
      abortControllerRef.current = new AbortController();
      audioQueueRef.current = [];
      isPlayingQueueRef.current = true;

      // Fetch first chunk immediately for quick playback start
      const firstBuffer = await fetchChunkAudio(
        chunks[0],
        apiKey,
        abortControllerRef.current.signal
      );

      if (isCancelledRef.current || !firstBuffer) {
        setIsLoading(false);
        return;
      }

      // Start playing immediately
      setIsLoading(false);
      setIsPlaying(true);
      
      const audioContext = await getAudioContext();
      const source = audioContext.createBufferSource();
      source.buffer = firstBuffer;
      source.connect(audioContext.destination);
      currentSourceRef.current = source;
      
      source.onended = () => {
        currentSourceRef.current = null;
        playNextFromQueue();
      };
      
      source.start();

      // Fetch remaining chunks in background
      for (let i = 1; i < chunks.length && !isCancelledRef.current; i++) {
        const buffer = await fetchChunkAudio(
          chunks[i],
          apiKey,
          abortControllerRef.current.signal
        );
        if (buffer && !isCancelledRef.current) {
          audioQueueRef.current.push(buffer);
        }
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setIsLoading(false);
        return;
      }
      
      const errorMsg = err instanceof Error ? err.message : 'Failed to synthesize speech';
      console.error('[TTS] Error:', errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      setIsPlaying(false);
      options.onError?.(errorMsg);
    }
  }, [options, stop, fetchChunkAudio, getAudioContext, playNextFromQueue]);

  /**
   * Toggle play/stop
   */
  const toggle = useCallback((text: string) => {
    if (isPlaying || isLoading) {
      stop();
    } else {
      speak(text);
    }
  }, [isPlaying, isLoading, speak, stop]);

  return {
    speak,
    stop,
    toggle,
    isPlaying,
    isLoading,
    error,
  };
}
