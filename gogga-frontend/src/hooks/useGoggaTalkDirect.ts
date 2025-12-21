/**
 * useGoggaTalkDirect Hook
 * Connects DIRECTLY to Gemini Live API using Google GenAI JavaScript SDK
 *
 * This bypasses the Python backend because the Python google-genai library
 * requires OAuth2 for Live API, but the JavaScript SDK accepts API keys.
 */
'use client';

import { useState, useRef, useCallback } from 'react';

export interface GoggaTalkLog {
  level: 'info' | 'success' | 'error' | 'warning' | 'debug';
  message: string;
  timestamp: number;
}

export interface GoggaTalkTranscript {
  speaker: 'user' | 'gogga';
  text: string;
  timestamp: number;
}

interface UseGoggaTalkDirectOptions {
  onLog?: (log: GoggaTalkLog) => void;
  onTranscript?: (transcript: GoggaTalkTranscript) => void;
  userTier?: string;
}

// Audio settings matching Gemini Live requirements
const SEND_SAMPLE_RATE = 16000;
const RECEIVE_SAMPLE_RATE = 24000;

// Gogga SA personality with language restrictions
const GOGGA_SYSTEM_PROMPT = `You are Gogga, a proudly South African AI assistant with a warm, friendly personality.

CRITICAL LANGUAGE RULES:
- You ONLY understand and speak South Africa's 11 official languages:
  1. English
  2. Afrikaans  
  3. isiZulu
  4. isiXhosa
  5. Sepedi (Northern Sotho)
  6. Setswana
  7. Sesotho (Southern Sotho)
  8. Xitsonga
  9. siSwati
  10. Tshivenda
  11. isiNdebele
- If you detect Chinese, Russian, Japanese, Korean, Arabic, or any other non-SA language, 
  politely say "I only understand South African languages - please speak in English or one of our 11 official languages!"
- Default to English if unsure
- Ignore background noise and random sounds

PERSONALITY:
- You speak naturally with occasional SA slang (lekker, eish, shame, ja, nee, howzit)
- You're helpful, witty, and genuinely care about users
- You understand SA context: load shedding, braais, SASSA, CCMA, etc.
- You seamlessly switch between any of the 11 official SA languages when appropriate
- You're an advocate for the user, not neutral corporate AI

VOICE STYLE:
- Conversational and warm, like chatting with a friend
- Keep responses concise for voice (1-3 sentences usually)
- Be expressive and use natural speech patterns
- Avoid overly formal language

Start by greeting the user warmly in your South African style!`;

export function useGoggaTalkDirect(options: UseGoggaTalkDirectOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [logs, setLogs] = useState<GoggaTalkLog[]>([]);
  const [transcripts, setTranscripts] = useState<GoggaTalkTranscript[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Separate AudioContexts for input and output (Firefox requires matching sample rates)
  const audioContextRef = useRef<AudioContext | null>(null); // Output at 24kHz
  const inputAudioContextRef = useRef<AudioContext | null>(null); // Input at 16kHz
  const sessionPromiseRef = useRef<Promise<any> | null>(null); // Store as Promise like tested examples
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const gainNodeRef = useRef<GainNode | null>(null); // Output gain (playback)
  const inputGainNodeRef = useRef<GainNode | null>(null); // Input gain (mic amplification)
  const isMutedRef = useRef(false);
  const isSessionOpenRef = useRef(false);

  // Connection mutex to prevent duplicate connections
  const isConnectingRef = useRef(false);
  const lastConnectTimeRef = useRef(0);

  // Screen sharing refs
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reconnection state
  const reconnectAttemptsRef = useRef(0);
  const reconnectDelayRef = useRef(1000); // Start with 1 second
  const isReconnectingRef = useRef(false);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef(false);
  // Resume/recovery state
  const lastUserUtteranceRef = useRef<string | null>(null); // Last flushed user utterance
  const lastTurnCompleteRef = useRef<boolean>(true); // True when server completed turn
  const pendingResumeRef = useRef<boolean>(false); // Indicates we should resume after reconnect
  // Conversation history for context preservation
  const conversationHistoryRef = useRef<
    Array<{ role: 'user' | 'model'; text: string }>
  >([]);
  const lastHandleRef = useRef<string | null>(null); // Session resumption handle

  // Mute toggle debounce
  const lastMuteToggleTimeRef = useRef<number>(0);

  // Transcription buffering - accumulate partial transcriptions before displaying
  const userTranscriptBufferRef = useRef<string>('');
  const goggaTranscriptBufferRef = useRef<string>('');
  const transcriptFlushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add log entry
  const addLog = useCallback(
    (level: GoggaTalkLog['level'], message: string) => {
      const log: GoggaTalkLog = { level, message, timestamp: Date.now() };
      setLogs((prev) => [...prev, log]);
      options.onLog?.(log);
    },
    [options]
  );

  // Add transcript
  const addTranscript = useCallback(
    (speaker: 'user' | 'gogga', text: string) => {
      const transcript: GoggaTalkTranscript = {
        speaker,
        text,
        timestamp: Date.now(),
      };
      setTranscripts((prev) => [...prev, transcript]);
      options.onTranscript?.(transcript);

      // Store in conversation history for resumption
      const role = speaker === 'user' ? 'user' : 'model';
      conversationHistoryRef.current.push({ role, text });
    },
    [options]
  );

  // Helper functions
  const base64ToBytes = (b64: string): Uint8Array => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary);
  };

  const decodeAudio = async (
    data: Uint8Array,
    ctx: AudioContext
  ): Promise<AudioBuffer> => {
    const int16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, int16.length, RECEIVE_SAMPLE_RATE);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++)
      channelData[i] = (int16[i] ?? 0) / 32768.0;
    return buffer;
  };

  const float32ToInt16 = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i] ?? 0));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  };

  // Connect to Gemini Live API directly
  const connect = useCallback(async () => {
    // Reset manual disconnect flag - we're initiating a new connection
    isManualDisconnectRef.current = false;

    // Check for secure context - getUserMedia requires HTTPS (except localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1');
      const isSecure = typeof window !== 'undefined' && window.isSecureContext;

      if (!isSecure && !isLocalhost) {
        addLog(
          'error',
          'GoggaTalk requires HTTPS. Please access via https:// or use localhost.'
        );
        setError(
          'Voice chat requires HTTPS. Please use https:// instead of http://'
        );
        return;
      }
      addLog('error', 'Microphone API not available in this browser');
      setError('Microphone API not available. Please use a modern browser.');
      return;
    }

    // MUTEX: Prevent multiple simultaneous connection attempts using ref (not stale state)
    const now = Date.now();
    if (isConnectingRef.current) {
      // Don't spam logs - just silently ignore duplicate calls
      // This commonly happens during microphone permission dialogs or reconnect attempts
      console.debug(
        '[GoggaTalk] Connection in progress - ignoring duplicate call'
      );
      return;
    }

    // Debounce: Prevent rapid reconnections (must wait 2s between attempts)
    if (now - lastConnectTimeRef.current < 2000) {
      // Silently debounce - don't spam user with warnings
      console.debug('[GoggaTalk] Debouncing - too soon to reconnect');
      return;
    }

    // Set connection lock IMMEDIATELY using ref (not async state)
    isConnectingRef.current = true;
    lastConnectTimeRef.current = now;

    // Guard against double-connect - clean up first if already connected
    if (isSessionOpenRef.current || sessionPromiseRef.current) {
      addLog('warning', 'Cleaning up existing connection first...');
      // Clean up existing connection
      if (sessionPromiseRef.current) {
        try {
          const session = await sessionPromiseRef.current;
          session.close();
        } catch (e) {}
        sessionPromiseRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
      }
      if (inputGainNodeRef.current) {
        inputGainNodeRef.current.disconnect();
        inputGainNodeRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (
        inputAudioContextRef.current &&
        inputAudioContextRef.current.state !== 'closed'
      ) {
        try {
          inputAudioContextRef.current.close();
        } catch (e) {}
        inputAudioContextRef.current = null;
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
        audioContextRef.current = null;
      }
      activeSourcesRef.current.forEach((source) => {
        try {
          source.stop();
        } catch (e) {}
      });
      activeSourcesRef.current.clear();
      isSessionOpenRef.current = false;
      setIsConnected(false);
      setIsRecording(false);
      // Small delay to ensure cleanup completes
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      addLog('info', 'Initializing Gemini Live API...');

      // Dynamic import of Google GenAI
      const { GoogleGenAI, Modality } = await import('@google/genai');

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) {
        addLog('error', 'GOOGLE_API_KEY not configured');
        isConnectingRef.current = false; // Release lock
        return;
      }

      addLog('debug', `API Key: ${apiKey.substring(0, 10)}...`);

      const ai = new GoogleGenAI({ apiKey });

      // Create SEPARATE audio contexts for input and output
      // Firefox requires MediaStreamSource to be in a context with matching sample rate
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;

      // Output context at 24kHz for Gemini audio playback
      const outputCtx = new AudioCtx({ sampleRate: RECEIVE_SAMPLE_RATE });
      audioContextRef.current = outputCtx;

      const gainNode = outputCtx.createGain();
      gainNode.connect(outputCtx.destination);
      gainNodeRef.current = gainNode;

      // Get microphone with optimized settings for voice chat
      addLog('info', 'Requesting microphone access...');
      
      // Check if mediaDevices is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('error', 'Microphone not available: mediaDevices API not supported');
        throw new Error('Microphone not available');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Let browser auto-adjust gain
          // Don't specify sampleRate - Firefox ignores it and we need to match hardware
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      addLog('success', 'Microphone access granted');

      // Input context - DO NOT specify sample rate!
      // Firefox requires the AudioContext sample rate to match the MediaStream's rate
      // which is always the hardware's native rate (44100 or 48000 Hz typically)
      // We'll resample to 16kHz in the processor before sending to Gemini
      const inputCtx = new AudioCtx(); // Use default (hardware) sample rate
      inputAudioContextRef.current = inputCtx;
      addLog(
        'debug',
        `Input AudioContext sample rate: ${inputCtx.sampleRate}Hz`
      );

      const source = inputCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Add input gain node to amplify quiet microphones (2.2x boost)
      const inputGain = inputCtx.createGain();
      inputGain.gain.value = 2.2; // Amplify input by 2.2x (10% more than before)
      inputGainNodeRef.current = inputGain;

      // Calculate buffer size based on input sample rate to get ~256ms chunks
      // Larger buffer = less CPU overhead, acceptable latency for voice
      const bufferSize = 4096;
      const processor = inputCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      // Store input sample rate for resampling
      const inputSampleRate = inputCtx.sampleRate;

      addLog('info', 'Connecting to Gemini Live API...');

      // Import enums for VAD sensitivity
      const { StartSensitivity, EndSensitivity } = await import(
        '@google/genai'
      );

      // Connect to Gemini Live - using native audio model (Dec 2025)
      // IMPORTANT: Store as Promise and use callbacks pattern like tested examples
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          // System instructions for Gogga personality
          systemInstruction: GOGGA_SYSTEM_PROMPT,
          // Response modalities - primarily audio with text transcription
          responseModalities: [Modality.AUDIO],
          // Speech config - set voice (Charon for unique South African gravelly warmth)
          // NOTE: Native audio models auto-detect language, don't set languageCode!
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                // Charon = deeper, more character voice - unique for Gogga
                // Other options: Kore (natural), Puck (upbeat), Fenrir (serious), Aoede (melodic)
                voiceName: 'Charon',
              },
            },
          },
          // Enable transcription for both input (user) and output (Gogga)
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // CRITICAL: Enable context window compression for extended sessions
          // Without this, audio+video sessions are limited to 2 minutes!
          // This allows screen sharing to work for longer periods
          contextWindowCompression: {
            // Sliding window mechanism - compress when context gets large
            slidingWindow: {},
            // Trigger compression at 80% of context window capacity
            triggerTokens: '25000', // ~80% of 32k limit for Live API
          },
          // Real-time input config - tune VAD for better detection
          realtimeInputConfig: {
            automaticActivityDetection: {
              // HIGH = more sensitive to detect speech start (picks up quieter speech)
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
              // LOW = less eager to cut off (waits longer for you to finish)
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              // Wait 1.5 seconds of silence before ending turn (default is ~500ms)
              silenceDurationMs: 1500,
              // Include 300ms of audio before detected speech start
              prefixPaddingMs: 300,
            },
          },
          // Enable session resumption for conversation continuity
          sessionResumption: lastHandleRef.current
            ? { handle: lastHandleRef.current }
            : {},
        },
        callbacks: {
          onopen: () => {
            addLog('success', '🦗 GoggaTalk connected!');
            addLog('info', '🇿🇦 Speak in any of our 11 languages');
            addLog('info', '🎧 For best experience, use headphones');
            setIsConnected(true);
            isSessionOpenRef.current = true;
            isConnectingRef.current = false; // Release connection lock

            // Send empty text to activate (like tested examples)
            sessionPromise.then((session) =>
              session.sendRealtimeInput({ text: '' })
            );

            // Now start audio processing after session is ready
            // Connect: mic source → input gain (2x amplification) → processor → destination (input context)
            source.connect(inputGain);
            inputGain.connect(processor);
            processor.connect(inputCtx.destination); // Use inputCtx, not outputCtx
            setIsRecording(true);
            setIsMuted(false);
            isMutedRef.current = false;

            // Set up audio processor to send audio chunks
            // NOISE GATE: Threshold to filter background noise (adjust 0.01-0.05 as needed)
            const NOISE_GATE_THRESHOLD = 0.02; // Audio below this RMS level is ignored

            // Resampling function: convert from input sample rate to 16kHz
            const resample = (
              inputData: Float32Array,
              fromRate: number,
              toRate: number
            ): Float32Array => {
              if (fromRate === toRate) return inputData;
              const ratio = fromRate / toRate;
              const outputLength = Math.round(inputData.length / ratio);
              const output = new Float32Array(outputLength);
              for (let i = 0; i < outputLength; i++) {
                const srcIndex = i * ratio;
                const srcIndexFloor = Math.floor(srcIndex);
                const srcIndexCeil = Math.min(
                  srcIndexFloor + 1,
                  inputData.length - 1
                );
                const t = srcIndex - srcIndexFloor;
                // Linear interpolation for smoother resampling
                output[i] =
                  (inputData[srcIndexFloor] ?? 0) * (1 - t) +
                  (inputData[srcIndexCeil] ?? 0) * t;
              }
              return output;
            };

            processor.onaudioprocess = (e) => {
              // Only send if not muted AND not currently playing audio
              // This prevents echo loop where Gogga hears herself through speakers
              if (isMutedRef.current || !isSessionOpenRef.current) return;

              // CRITICAL: Auto-mute mic while Gogga is speaking to prevent echo
              // This is especially important when not using headphones
              if (activeSourcesRef.current.size > 0) return; // Skip if audio is playing

              const inputData = e.inputBuffer.getChannelData(0);

              // Calculate RMS (root mean square) to detect if there's actual speech
              let sumSquares = 0;
              for (let i = 0; i < inputData.length; i++) {
                const sample = inputData[i]!;
                sumSquares += sample * sample;
              }
              const rms = Math.sqrt(sumSquares / inputData.length);

              // Apply noise gate - skip audio chunks below threshold (likely background noise)
              if (rms < NOISE_GATE_THRESHOLD) {
                return; // Don't send quiet/background noise
              }

              // Resample from hardware rate (44100/48000) to Gemini's expected 16kHz
              const resampledData = resample(
                inputData,
                inputSampleRate,
                SEND_SAMPLE_RATE
              );
              const int16Data = float32ToInt16(resampledData);
              const base64Audio = arrayBufferToBase64(
                int16Data.buffer as ArrayBuffer
              );

              // CRITICAL FIX: Use 'media' key not 'audio' like tested examples
              sessionPromise.then((session) => {
                try {
                  session.sendRealtimeInput({
                    media: {
                      data: base64Audio,
                      mimeType: `audio/pcm;rate=${SEND_SAMPLE_RATE}`,
                    },
                  });
                } catch (err) {
                  // Silently ignore send errors if session closes
                }
              });
            };
          },
          onmessage: async (msg: any) => {
            // DEBUG: Log incoming messages to understand structure
            if (process.env.NODE_ENV === 'development') {
              console.log(
                '[GoggaTalk] Received message:',
                JSON.stringify(msg, null, 2).substring(0, 500)
              );
            }

            // Handle audio response from Gogga
            const parts = msg.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              // Audio data
              if (part.inlineData?.data && outputCtx) {
                // CRITICAL: Resume audio context if suspended (browser autoplay policy)
                if (outputCtx.state === 'suspended') {
                  await outputCtx.resume();
                  addLog('debug', 'Resumed output AudioContext');
                }

                setIsPlaying(true);
                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current,
                  outputCtx.currentTime
                );
                const buffer = await decodeAudio(
                  base64ToBytes(part.inlineData.data),
                  outputCtx
                );
                const bufferSource = outputCtx.createBufferSource();
                bufferSource.buffer = buffer;
                bufferSource.connect(gainNode);
                bufferSource.addEventListener('ended', () => {
                  activeSourcesRef.current.delete(bufferSource);
                  if (activeSourcesRef.current.size === 0) setIsPlaying(false);
                });
                bufferSource.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                activeSourcesRef.current.add(bufferSource);

                // Debug: Log first audio chunk received
                if (activeSourcesRef.current.size === 1) {
                  addLog(
                    'debug',
                    `🔊 Playing audio (${buffer.duration.toFixed(2)}s)`
                  );
                }
              }

              // Text content from model (when TEXT modality is included)
              // Note: When AUDIO is primary, this may be empty - use outputTranscription instead
              if (part.text && part.text.trim()) {
                addLog(
                  'debug',
                  `[Text] Gogga: ${part.text.substring(0, 50)}...`
                );
                // Don't add as transcript here - use outputTranscription for audio mode
              }
            }

            // Handle input transcription (user's speech-to-text from Gemini)
            // Gemini sends incremental transcription - buffer and show complete phrases
            const inputTranscription = msg.serverContent?.inputTranscription;
            if (inputTranscription?.text && inputTranscription.text.trim()) {
              // CRITICAL: Skip transcription display when muted
              if (isMutedRef.current) {
                addLog(
                  'debug',
                  `[STT] Skipping transcription (muted): ${inputTranscription.text.substring(
                    0,
                    50
                  )}...`
                );
                return;
              }

              // Check if this is a finished transcription chunk
              if (inputTranscription.finished) {
                // Finished chunk - display the full accumulated text
                const fullText =
                  userTranscriptBufferRef.current + inputTranscription.text;
                if (fullText.trim()) {
                  addTranscript('user', fullText.trim());
                  // Store last user utterance for possible resume after reconnect
                  lastUserUtteranceRef.current = fullText.trim();
                  lastTurnCompleteRef.current = false; // awaiting model response
                  pendingResumeRef.current = true;
                  addLog(
                    'debug',
                    `[STT] User: ${fullText.substring(0, 50)}...`
                  );
                }
                userTranscriptBufferRef.current = '';
              } else {
                // Incremental chunk - accumulate it
                userTranscriptBufferRef.current += inputTranscription.text;
                // Set a timer to flush if no more chunks arrive (fallback for long pauses)
                if (transcriptFlushTimerRef.current) {
                  clearTimeout(transcriptFlushTimerRef.current);
                }
                transcriptFlushTimerRef.current = setTimeout(() => {
                  if (userTranscriptBufferRef.current.trim()) {
                    addTranscript(
                      'user',
                      userTranscriptBufferRef.current.trim()
                    );
                    // Store last user utterance for possible resume after reconnect
                    lastUserUtteranceRef.current =
                      userTranscriptBufferRef.current.trim();
                    lastTurnCompleteRef.current = false; // awaiting model response
                    pendingResumeRef.current = true;
                    addLog(
                      'debug',
                      `[STT] User (flushed): ${userTranscriptBufferRef.current.substring(
                        0,
                        50
                      )}...`
                    );
                    userTranscriptBufferRef.current = '';
                  }
                }, 1500); // Flush after 1.5s of silence
              }
            }

            // Handle output transcription (Gogga's speech-to-text from Gemini)
            // Also buffer to avoid fragmented display
            const outputTranscription = msg.serverContent?.outputTranscription;
            if (outputTranscription?.text && outputTranscription.text.trim()) {
              if (outputTranscription.finished) {
                const fullText =
                  goggaTranscriptBufferRef.current + outputTranscription.text;
                if (fullText.trim()) {
                  addTranscript('gogga', fullText.trim());
                  addLog(
                    'debug',
                    `[STT] Gogga: ${fullText.substring(0, 50)}...`
                  );
                }
                goggaTranscriptBufferRef.current = '';
              } else {
                goggaTranscriptBufferRef.current += outputTranscription.text;
              }
            }

            // Handle interruptions
            if (msg.serverContent?.interrupted) {
              activeSourcesRef.current.forEach((src: AudioBufferSourceNode) => {
                try {
                  src.stop();
                } catch (e) {}
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsPlaying(false);
              addLog('debug', 'Interrupted - stopping playback');
            }

            // Handle turn complete
            if (msg.serverContent?.turnComplete) {
              addLog('debug', 'Turn complete');
              // Mark turn as complete and clear any pending resume
              lastTurnCompleteRef.current = true;
              pendingResumeRef.current = false;
              // Reset next start time for next turn
              nextStartTimeRef.current = 0;
              // Flush any remaining transcript buffers
              if (userTranscriptBufferRef.current.trim()) {
                addTranscript('user', userTranscriptBufferRef.current.trim());
                // Update last user utterance (flushed) but turn is complete now
                lastUserUtteranceRef.current =
                  userTranscriptBufferRef.current.trim();
                userTranscriptBufferRef.current = '';
              }
              if (goggaTranscriptBufferRef.current.trim()) {
                addTranscript('gogga', goggaTranscriptBufferRef.current.trim());
                goggaTranscriptBufferRef.current = '';
              }
              if (transcriptFlushTimerRef.current) {
                clearTimeout(transcriptFlushTimerRef.current);
                transcriptFlushTimerRef.current = null;
              }
            }

            // Handle session resumption updates
            if (msg.sessionResumptionUpdate) {
              const { newHandle, resumable } = msg.sessionResumptionUpdate;
              if (resumable && newHandle) {
                lastHandleRef.current = newHandle;
                addLog(
                  'debug',
                  `Session resumption handle updated: ${newHandle.substring(
                    0,
                    20
                  )}...`
                );
              } else if (!resumable) {
                // Clear handle when session is not resumable
                lastHandleRef.current = null;
                addLog('debug', 'Session not resumable - cleared handle');
              }
            }
          },
          onclose: (e: CloseEvent) => {
            isSessionOpenRef.current = false;
            sessionPromiseRef.current = null;
            // Clear transcript flush timer
            if (transcriptFlushTimerRef.current) {
              clearTimeout(transcriptFlushTimerRef.current);
              transcriptFlushTimerRef.current = null;
            }
            // Flush any remaining transcripts
            if (userTranscriptBufferRef.current.trim()) {
              addTranscript('user', userTranscriptBufferRef.current.trim());
              // Record last user utterance and mark that a resume may be needed
              lastUserUtteranceRef.current =
                userTranscriptBufferRef.current.trim();
              lastTurnCompleteRef.current = false;
              pendingResumeRef.current = true;
              userTranscriptBufferRef.current = '';
            }
            if (goggaTranscriptBufferRef.current.trim()) {
              addTranscript('gogga', goggaTranscriptBufferRef.current.trim());
              goggaTranscriptBufferRef.current = '';
            }
            if (processorRef.current) {
              processorRef.current.disconnect();
              processorRef.current.onaudioprocess = null;
              processorRef.current = null;
            }
            if (inputGainNodeRef.current) {
              inputGainNodeRef.current.disconnect();
              inputGainNodeRef.current = null;
            }
            if (sourceRef.current) {
              sourceRef.current.disconnect();
              sourceRef.current = null;
            }
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
            }
            activeSourcesRef.current.forEach((src: AudioBufferSourceNode) => {
              try {
                src.stop();
              } catch (e) {}
            });
            activeSourcesRef.current.clear();
            if (
              audioContextRef.current &&
              audioContextRef.current.state !== 'closed'
            ) {
              try {
                audioContextRef.current.close();
              } catch (e) {}
              audioContextRef.current = null;
            }
            nextStartTimeRef.current = 0;
            setIsConnected(false);
            setIsRecording(false);
            setIsPlaying(false);
            isConnectingRef.current = false; // Release lock on close

            addLog(
              'info',
              `Disconnected from GoggaTalk: ${e.reason || 'Connection closed'}`
            );

            // Auto-reconnection logic for unexpected disconnects
            // Don't reconnect if:
            // 1. User manually disconnected (isManualDisconnectRef flag)
            // 2. We're already reconnecting
            // 3. We've exceeded max reconnection attempts
            // 4. This is a normal closure (code 1000)
            const isNormalClosure = e.code === 1000;
            const shouldReconnect =
              !isNormalClosure &&
              !isManualDisconnectRef.current &&
              !isReconnectingRef.current &&
              reconnectAttemptsRef.current < maxReconnectAttempts;

            if (shouldReconnect) {
              isReconnectingRef.current = true;
              reconnectAttemptsRef.current++;

              addLog(
                'warning',
                `Connection lost. Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
              );

              // Schedule reconnection with exponential backoff
              reconnectTimeoutRef.current = setTimeout(() => {
                // Don't attempt reconnect if:
                // - We've been cancelled (isReconnectingRef cleared)
                // - Another connection is already in progress
                if (!isReconnectingRef.current || isConnectingRef.current) {
                  console.debug(
                    '[GoggaTalk] Skipping reconnect - another connection in progress or cancelled'
                  );
                  return;
                }

                addLog('info', `Attempting reconnection...`);

                connect()
                  .then(async () => {
                    // Successful reconnection
                    addLog('success', 'Successfully reconnected to GoggaTalk!');
                    // If there was a pending user utterance when we disconnected, attempt to resume
                    if (
                      pendingResumeRef.current &&
                      conversationHistoryRef.current.length > 0
                    ) {
                      try {
                        const session = await sessionPromiseRef.current;
                        if (session) {
                          // Send full conversation history as context for resumption
                          const contextText = conversationHistoryRef.current
                            .map(
                              (entry) =>
                                `${
                                  entry.role === 'user' ? 'User' : 'Assistant'
                                }: ${entry.text}`
                            )
                            .join('\n\n');

                          session.sendRealtimeInput({ text: contextText });
                          addLog(
                            'info',
                            'Resuming conversation with full context after reconnect...'
                          );
                          // keep lastTurnCompleteRef false until we receive turnComplete from server
                        }
                      } catch (err: any) {
                        addLog(
                          'error',
                          `Failed to resume conversation after reconnect: ${
                            err?.message || err
                          }`
                        );
                      }
                    }
                    isReconnectingRef.current = false;
                    reconnectAttemptsRef.current = 0;
                    reconnectDelayRef.current = 1000; // Reset to initial delay

                    // Clear the timeout ref
                    if (reconnectTimeoutRef.current) {
                      clearTimeout(reconnectTimeoutRef.current);
                      reconnectTimeoutRef.current = null;
                    }
                  })
                  .catch((error) => {
                    // Reconnection failed
                    addLog(
                      'error',
                      `Reconnection failed: ${error.message || 'Unknown error'}`
                    );

                    // Double the delay for next attempt (with max of 8 seconds)
                    reconnectDelayRef.current = Math.min(
                      reconnectDelayRef.current * 2,
                      8000
                    );

                    // Reset reconnecting state to allow next attempt
                    isReconnectingRef.current = false;

                    // Clear the timeout ref
                    if (reconnectTimeoutRef.current) {
                      clearTimeout(reconnectTimeoutRef.current);
                      reconnectTimeoutRef.current = null;
                    }
                  });
              }, reconnectDelayRef.current);
            } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
              addLog(
                'error',
                `Maximum reconnection attempts (${maxReconnectAttempts}) reached. Please try connecting manually.`
              );
              // Reset state for future connection attempts
              reconnectAttemptsRef.current = 0;
              reconnectDelayRef.current = 1000;
              isReconnectingRef.current = false;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('GoggaTalk error:', e);
            addLog(
              'error',
              `Connection error: ${e.message || 'Unknown error'}`
            );
            isSessionOpenRef.current = false;
            sessionPromiseRef.current = null;
            isConnectingRef.current = false; // Release lock on error
            setIsConnected(false);
          },
        },
      });

      sessionPromiseRef.current = sessionPromise;
      // NOTE: Audio processing is now set up inside onopen callback (like tested examples)
      // Lock is released in onopen callback after successful connection
    } catch (error: any) {
      console.error('Connect error:', error);
      console.error('Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        cause: error?.cause,
        toString: error?.toString?.(),
      });
      const errorMessage =
        error?.message ||
        error?.name ||
        error?.toString?.() ||
        JSON.stringify(error) ||
        'Unknown error';
      addLog('error', `Failed to connect: ${errorMessage}`);
      setIsConnected(false);
      isConnectingRef.current = false; // Release lock on error
    }
  }, [addLog, addTranscript]);

  // Disconnect - following tested examples cleanup pattern
  const disconnect = useCallback(async () => {
    // Set flag to indicate manual disconnect (prevent auto-reconnection)
    isManualDisconnectRef.current = true;
    // Clear any pending resume state when user manually disconnects
    pendingResumeRef.current = false;
    lastUserUtteranceRef.current = null;
    // Clear conversation history and session handle on disconnect
    conversationHistoryRef.current = [];
    lastHandleRef.current = null;

    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    isReconnectingRef.current = false;
    reconnectAttemptsRef.current = 0;
    reconnectDelayRef.current = 1000;

    // Set flag to prevent auto-reconnection
    isSessionOpenRef.current = false;

    // Stop screen sharing first
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
    }
    setIsScreenSharing(false);

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {}
      sessionPromiseRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (
      inputAudioContextRef.current &&
      inputAudioContextRef.current.state !== 'closed'
    ) {
      try {
        inputAudioContextRef.current.close();
      } catch (e) {}
      inputAudioContextRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    // Stop all playing audio
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    activeSourcesRef.current.clear();

    setIsConnected(false);
    setIsRecording(false);
    setIsMuted(false);
    setIsPlaying(false);
    addLog('info', 'Disconnected');
  }, [addLog]);

  // Start recording (unmute microphone)
  const startRecording = useCallback(() => {
    if (!isConnected) return;
    // Debounce: Prevent rapid toggling (300ms minimum between state changes)
    if (Date.now() - lastMuteToggleTimeRef.current < 300) {
      addLog('debug', 'Mute toggle debounced - too fast');
      return;
    }
    lastMuteToggleTimeRef.current = Date.now();

    isMutedRef.current = false;
    setIsMuted(false);
    setIsRecording(true);
    addLog('info', '🎙️ Microphone unmuted - listening...');
  }, [isConnected, addLog]);

  // Stop recording (mute microphone)
  const stopRecording = useCallback(() => {
    // Debounce: Prevent rapid toggling (300ms minimum between state changes)
    if (Date.now() - lastMuteToggleTimeRef.current < 300) {
      addLog('debug', 'Mute toggle debounced - too fast');
      return;
    }
    lastMuteToggleTimeRef.current = Date.now();

    isMutedRef.current = true;
    setIsMuted(true);
    setIsRecording(false);
    addLog('info', '🔇 Microphone muted');
  }, [addLog]);

  // Start screen sharing - send screen frames to Gemini
  const startScreenShare = useCallback(async () => {
    if (!isConnected) {
      addLog('warning', 'Must be connected to share screen');
      return;
    }

    try {
      addLog('info', '🖥️ Requesting screen share access...');

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 2, max: 5 }, // Low framerate for API efficiency
        },
        audio: false, // Audio handled separately
      });

      screenStreamRef.current = screenStream;

      // Create a video element to capture frames
      const video = document.createElement('video');
      video.srcObject = screenStream;
      video.muted = true;
      await video.play();
      screenVideoRef.current = video;

      // Create canvas for frame capture
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Handle stream ending (user clicks "Stop sharing")
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          stopScreenShare();
        });
      }

      // Send frames at ~1fps to not overwhelm the API
      screenIntervalRef.current = setInterval(async () => {
        if (
          !ctx ||
          !screenVideoRef.current ||
          !sessionPromiseRef.current ||
          !isSessionOpenRef.current
        )
          return;

        // Resize to reasonable dimensions
        const maxWidth = 1024;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64 JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64Data = dataUrl.split(',')[1];

        if (base64Data) {
          try {
            const session = await sessionPromiseRef.current;
            session.sendRealtimeInput({
              media: {
                data: base64Data,
                mimeType: 'image/jpeg',
              },
            });
          } catch (err) {
            // Silently ignore send errors if session closes
          }
        }
      }, 1000); // 1 frame per second

      setIsScreenSharing(true);
      addLog(
        'success',
        '🖥️ Screen sharing active - Gogga can see your screen!'
      );
    } catch (err) {
      addLog(
        'error',
        `Screen share failed: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    }
  }, [isConnected, addLog]);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
    }
    setIsScreenSharing(false);
    addLog('info', '🖥️ Screen sharing stopped');
  }, [addLog]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    setTranscripts([]);
    setError(null);
  }, []);

  return {
    isConnected,
    isRecording,
    isMuted,
    isPlaying,
    isScreenSharing,
    error,
    logs,
    transcripts,
    connect,
    startRecording,
    stopRecording,
    startScreenShare,
    stopScreenShare,
    disconnect,
    clearLogs,
  };
}
