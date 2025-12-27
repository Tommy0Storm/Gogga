/**
 * useTextToSpeech Hook
 * 
 * Synthesizes speech from text using Gemini TTS with Charon voice via the backend.
 * Uses 50-word sentence-boundary chunking for cost savings on cancellation.
 * 
 * OPTIMIZATION: Splits text into ~50 word chunks ending at sentence boundaries.
 * First chunk starts playing quickly while remaining chunks are fetched sequentially.
 * When user cancels, remaining chunks are NOT fetched - saving API costs.
 * 
 * JIGGA tier only - provides a "read aloud" feature for assistant responses.
 */
'use client';

import { useState, useRef, useCallback } from 'react';

// Chunk size: split every ~50 words at sentence boundaries for cost savings on cancel
const WORDS_PER_CHUNK = 50;

// Default voice - Charon for consistent GOGGA identity
const DEFAULT_VOICE = 'Charon';

interface UseTextToSpeechOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  voiceName?: string;
}

interface TTSResponse {
  audio_content: string;  // Base64 encoded WAV
  duration_estimate: number;
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
 * Split text into chunks of ~50 words, ending at sentence boundaries.
 * 
 * This ensures cancellation stops at a natural pause point and
 * prevents API calls for unsent chunks (saving costs).
 */
function splitIntoChunks(text: string, maxWords: number = WORDS_PER_CHUNK): string[] {
  const chunks: string[] = [];
  
  // Split into sentences first (preserving punctuation)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk: string[] = [];
  let currentWordCount = 0;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    const sentenceWords = trimmedSentence.split(/\s+/).length;
    
    // If this sentence alone exceeds maxWords, split it
    if (sentenceWords > maxWords && currentChunk.length === 0) {
      // Split long sentence at word boundaries
      const words = trimmedSentence.split(/\s+/);
      for (let i = 0; i < words.length; i += maxWords) {
        const slice = words.slice(i, i + maxWords).join(' ');
        if (slice.trim()) {
          chunks.push(slice.trim());
        }
      }
      continue;
    }
    
    // If adding this sentence exceeds limit, finalize current chunk
    if (currentWordCount + sentenceWords > maxWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' ').trim());
      currentChunk = [];
      currentWordCount = 0;
    }
    
    // Add sentence to current chunk
    currentChunk.push(trimmedSentence);
    currentWordCount += sentenceWords;
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' ').trim());
  }
  
  return chunks.filter(c => c.length > 0);
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const currentIndexRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);
  const isFetchingRef = useRef(false);

  /**
   * Stop any currently playing audio and cancel pending requests
   */
  const stop = useCallback(() => {
    isCancelledRef.current = true;
    isFetchingRef.current = false;
    
    // Stop and clean up all audio elements
    audioElementsRef.current.forEach(audio => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    });
    audioElementsRef.current = [];
    currentIndexRef.current = 0;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  /**
   * Fetch TTS audio for a chunk of text from backend
   */
  const fetchChunkAudio = useCallback(async (
    chunkText: string,
    voiceName: string,
    signal: AbortSignal
  ): Promise<HTMLAudioElement | null> => {
    const response = await fetch('/api/v1/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunkText,
        voice_name: voiceName,
        language_code: 'en-US',
        speaking_rate: 1.0,
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `TTS error: ${response.status}`);
    }

    const data: TTSResponse = await response.json();
    
    if (!data.audio_content) {
      return null;
    }

    // Create audio element from base64 WAV (Gemini TTS returns WAV)
    const audio = new Audio(`data:audio/wav;base64,${data.audio_content}`);
    await new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => reject(new Error('Failed to load audio'));
      audio.load();
    });
    
    return audio;
  }, []);

  /**
   * Play the next audio element in sequence
   */
  const playNext = useCallback(() => {
    if (isCancelledRef.current) {
      return;
    }

    const index = currentIndexRef.current;
    const audioElements = audioElementsRef.current;
    
    if (index >= audioElements.length) {
      // No more audio ready - are we still fetching?
      if (isFetchingRef.current) {
        // Still fetching, retry in 100ms
        setTimeout(() => playNext(), 100);
        return;
      }
      // All done
      setIsPlaying(false);
      options.onEnd?.();
      return;
    }

    const audio = audioElements[index];
    if (!audio) {
      // This chunk isn't ready yet, wait
      if (isFetchingRef.current) {
        setTimeout(() => playNext(), 100);
        return;
      }
      // No more coming
      setIsPlaying(false);
      options.onEnd?.();
      return;
    }

    audio.onended = () => {
      currentIndexRef.current++;
      playNext();
    };

    audio.play().catch(err => {
      console.error('[TTS] Playback error:', err);
      options.onError?.(err.message);
      stop();
    });
  }, [options, stop]);

  /**
   * Synthesize and play speech with chunked streaming for fast start
   */
  const speak = useCallback(async (text: string) => {
    stop();
    isCancelledRef.current = false;
    
    if (!text.trim()) return;

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    const chunks = splitIntoChunks(cleanText);
    if (chunks.length === 0) return;

    const voiceName = options.voiceName || DEFAULT_VOICE;

    setIsLoading(true);
    setError(null);
    options.onStart?.();

    try {
      abortControllerRef.current = new AbortController();
      audioElementsRef.current = new Array(chunks.length).fill(null);
      currentIndexRef.current = 0;
      isFetchingRef.current = chunks.length > 1;

      // Fetch first chunk immediately for quick playback start
      const firstAudio = await fetchChunkAudio(
        chunks[0]!, // Non-null assertion: we checked chunks.length > 0
        voiceName,
        abortControllerRef.current.signal
      );

      if (isCancelledRef.current || !firstAudio) {
        setIsLoading(false);
        return;
      }

      audioElementsRef.current[0] = firstAudio;

      // Start playing immediately
      setIsLoading(false);
      setIsPlaying(true);
      playNext();

      // Fetch remaining chunks in background
      for (let i = 1; i < chunks.length && !isCancelledRef.current; i++) {
        try {
          const audio = await fetchChunkAudio(
            chunks[i]!, // Non-null assertion: loop ensures i < chunks.length
            voiceName,
            abortControllerRef.current.signal
          );
          if (audio && !isCancelledRef.current) {
            audioElementsRef.current[i] = audio;
          }
        } catch (err) {
          // Don't fail the whole playback for one chunk
          console.warn(`[TTS] Failed to fetch chunk ${i}:`, err);
        }
      }
      
      // Mark fetching complete
      isFetchingRef.current = false;

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
  }, [options, stop, fetchChunkAudio, playNext]);

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
