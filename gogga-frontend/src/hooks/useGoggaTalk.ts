/**
 * useGoggaTalk Hook
 * Manages WebSocket connection and audio streaming for voice chat with Gogga
 *
 * Architecture (based on LlamaIndex GeminiLiveVoiceAgent):
 * - Browser captures microphone audio (16kHz PCM)
 * - Streams to backend via WebSocket
 * - Backend forwards to Gemini Live API
 * - Receives audio response (24kHz PCM)
 * - Plays through Web Audio API
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

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

interface UseGoggaTalkOptions {
  onLog?: (log: GoggaTalkLog) => void;
  onTranscript?: (transcript: GoggaTalkTranscript) => void;
  userTier?: string;
}

// Audio settings matching Gemini Live requirements
const SEND_SAMPLE_RATE = 16000; // Input to Gemini
const RECEIVE_SAMPLE_RATE = 24000; // Output from Gemini
const CHUNK_SIZE = 4096;

export function useGoggaTalk(options: UseGoggaTalkOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<GoggaTalkLog[]>([]);
  const [transcripts, setTranscripts] = useState<GoggaTalkTranscript[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Get WebSocket URL
  const getWsUrl = useCallback(() => {
    // In browser, derive backend URL from current location
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      // Backend runs on port 8000
      return `${protocol}//${host}:8000/api/v1/voice/talk`;
    }
    // Fallback for SSR (should never be used for WebSocket)
    return 'ws://localhost:8000/api/v1/voice/talk';
  }, []);

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
    },
    [options]
  );

  // Convert Float32Array to Int16Array (PCM)
  const float32ToInt16 = useCallback(
    (float32Array: Float32Array): Int16Array => {
      const int16Array = new Int16Array(float32Array.length);
      for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i] ?? 0));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return int16Array;
    },
    []
  );

  // Play audio from queue
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || playQueueRef.current.length === 0) return;

    isPlayingRef.current = true;
    setIsPlaying(true);

    const audioData = playQueueRef.current.shift();
    if (!audioData) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    try {
      // Create audio context for playback
      const playContext = new AudioContext({ sampleRate: RECEIVE_SAMPLE_RATE });

      // Convert base64 PCM to AudioBuffer
      const int16Array = new Int16Array(audioData);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = (int16Array[i] ?? 0) / 32768;
      }

      const audioBuffer = playContext.createBuffer(
        1,
        float32Array.length,
        RECEIVE_SAMPLE_RATE
      );
      audioBuffer.getChannelData(0).set(float32Array);

      const source = playContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playContext.destination);

      source.onended = () => {
        playContext.close();
        isPlayingRef.current = false;
        setIsPlaying(false);
        // Play next in queue
        playNextAudio();
      };

      source.start();
    } catch (error) {
      console.error('Audio playback error:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
      playNextAudio();
    }
  }, []);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'log':
            addLog(data.level, data.message);
            break;

          case 'audio':
            // Decode base64 audio and queue for playback
            const binaryString = atob(data.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            playQueueRef.current.push(bytes.buffer);
            playNextAudio();
            break;

          case 'transcript':
            addTranscript(data.speaker, data.text);
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    },
    [addLog, addTranscript, playNextAudio]
  );

  // Connect to WebSocket and start session
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addLog('warning', 'Already connected');
      return;
    }

    const wsUrl = getWsUrl();
    addLog('info', '🦗 Connecting to GoggaTalk...');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        addLog('success', '🦗 Connected to GoggaTalk!');

        // Send start message
        ws.send(JSON.stringify({ type: 'start' }));
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addLog('error', 'Connection error - check if backend is running');
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsRecording(false);
        addLog('info', 'Disconnected from GoggaTalk');
      };
    } catch (error) {
      addLog('error', `Failed to connect: ${error}`);
    }
  }, [getWsUrl, addLog, handleMessage]);

  // Start recording and streaming audio
  const startRecording = useCallback(async () => {
    if (!isConnected) {
      addLog('warning', 'Not connected - connect first');
      return;
    }

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
          'Voice recording requires HTTPS. Please access via https:// or use localhost.'
        );
        return;
      }
      addLog('error', 'Microphone API not available in this browser');
      return;
    }

    try {
      addLog('info', '🎙️ Starting microphone...');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SEND_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      // Create audio context for processing
      audioContextRef.current = new AudioContext({
        sampleRate: SEND_SAMPLE_RATE,
      });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create script processor for audio chunks
      const processor = audioContextRef.current.createScriptProcessor(
        CHUNK_SIZE,
        1,
        1
      );
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
          return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = float32ToInt16(inputData);

        // Send as base64
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(pcmData.buffer))
        );

        wsRef.current.send(
          JSON.stringify({
            type: 'audio',
            data: base64,
          })
        );
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      setIsRecording(true);
      addLog('success', '🎙️ Listening...');
    } catch (error) {
      addLog('error', `Microphone error: ${error}`);
    }
  }, [isConnected, addLog, float32ToInt16]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    addLog('info', '🎙️ Stopped listening');
  }, [addLog]);

  // Disconnect
  const disconnect = useCallback(() => {
    stopRecording();

    // Clear play queue
    playQueueRef.current = [];
    setIsPlaying(false);

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        } catch {
          // Ignore
        }
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [stopRecording]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    setTranscripts([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processorRef.current) processorRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'stop' }));
          } catch {
            // Ignore
          }
        }
        wsRef.current.close();
      }
    };
  }, []);

  return {
    // State
    isConnected,
    isRecording,
    isPlaying,
    logs,
    transcripts,

    // Actions
    connect,
    disconnect,
    startRecording,
    stopRecording,
    clearLogs,
  };
}
