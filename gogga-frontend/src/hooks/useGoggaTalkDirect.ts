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

// Gogga SA personality
const GOGGA_SYSTEM_PROMPT = `You are Gogga, a proudly South African AI assistant with a warm, friendly personality.

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
  const [logs, setLogs] = useState<GoggaTalkLog[]>([]);
  const [transcripts, setTranscripts] = useState<GoggaTalkTranscript[]>([]);
  
  // Refs matching tested examples (single AudioContext at playback rate)
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);  // Store as Promise like tested examples
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const gainNodeRef = useRef<GainNode | null>(null);
  const isMutedRef = useRef(false);
  const isSessionOpenRef = useRef(false);
  
  // Add log entry
  const addLog = useCallback((level: GoggaTalkLog['level'], message: string) => {
    const log: GoggaTalkLog = { level, message, timestamp: Date.now() };
    setLogs(prev => [...prev, log]);
    options.onLog?.(log);
  }, [options]);
  
  // Add transcript
  const addTranscript = useCallback((speaker: 'user' | 'gogga', text: string) => {
    const transcript: GoggaTalkTranscript = { speaker, text, timestamp: Date.now() };
    setTranscripts(prev => [...prev, transcript]);
    options.onTranscript?.(transcript);
  }, [options]);

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
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const decodeAudio = async (data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> => {
    const int16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, int16.length, RECEIVE_SAMPLE_RATE);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) channelData[i] = int16[i] / 32768.0;
    return buffer;
  };

  const float32ToInt16 = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  };

  // Connect to Gemini Live API directly
  const connect = useCallback(async () => {
    // Guard against double-connect - clean up first if already connected
    if (isConnected || sessionPromiseRef.current) {
      addLog('warning', 'Already connected or connecting - cleaning up first...');
      // Clean up existing connection
      if (sessionPromiseRef.current) {
        try { 
          const session = await sessionPromiseRef.current;
          session.close(); 
        } catch(e) {}
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
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch(e) {}
        audioContextRef.current = null;
      }
      activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      activeSourcesRef.current.clear();
      isSessionOpenRef.current = false;
      setIsConnected(false);
      setIsRecording(false);
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    try {
      addLog('info', 'Initializing Gemini Live API...');
      
      // Dynamic import of Google GenAI
      const { GoogleGenAI, Modality } = await import('@google/genai');
      
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) {
        addLog('error', 'GOOGLE_API_KEY not configured');
        return;
      }
      
      addLog('debug', `API Key: ${apiKey.substring(0, 10)}...`);
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Create audio context for playback at 24kHz
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: RECEIVE_SAMPLE_RATE });
      audioContextRef.current = ctx;
      
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;
      
      // Get microphone
      addLog('info', 'Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          sampleRate: SEND_SAMPLE_RATE 
        }
      });
      streamRef.current = stream;
      addLog('success', 'Microphone access granted');
      
      // Set up audio processing - separate context for input at 16kHz
      // NOTE: ScriptProcessorNode is deprecated but AudioWorkletNode requires a separate file
      // and more complex setup. For browser voice chat, ScriptProcessorNode still works reliably.
      // TODO: Migrate to AudioWorkletNode for better performance in future refactor
      // IMPORTANT: Use SINGLE AudioContext at playback rate (24kHz) like tested examples
      // The ScriptProcessor will resample from mic's native rate
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      addLog('info', 'Connecting to Gemini Live API...');
      
      // Connect to Gemini Live - use correct model for API key access
      // IMPORTANT: Store as Promise and use callbacks pattern like tested examples
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-live-001',
        callbacks: {
          onopen: () => {
            addLog('success', '🦗 GoggaTalk connected!');
            addLog('info', '🇿🇦 Speak in any of our 11 languages');
            setIsConnected(true);
            isSessionOpenRef.current = true;
            
            // Send empty text to activate (like tested examples)
            sessionPromise.then(session => session.sendRealtimeInput({ text: '' }));
            
            // Now start audio processing after session is ready
            source.connect(processor);
            processor.connect(ctx.destination);
            setIsRecording(true);
            setIsMuted(false);
            isMutedRef.current = false;
            
            // Set up audio processor to send audio chunks
            processor.onaudioprocess = (e) => {
              // Only send if not muted
              if (isMutedRef.current || !isSessionOpenRef.current) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              const int16Data = float32ToInt16(inputData);
              const base64Audio = arrayBufferToBase64(int16Data.buffer as ArrayBuffer);
              
              // CRITICAL FIX: Use 'media' key not 'audio' like tested examples
              sessionPromise.then(session => {
                try {
                  session.sendRealtimeInput({
                    media: {
                      data: base64Audio,
                      mimeType: `audio/pcm;rate=${SEND_SAMPLE_RATE}`
                    }
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
              console.log('[GoggaTalk] Received message:', JSON.stringify(msg, null, 2).substring(0, 500));
            }
            
            // Handle audio response from Gogga
            const parts = msg.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              // Audio data
              if (part.inlineData?.data && ctx) {
                setIsPlaying(true);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                const buffer = await decodeAudio(base64ToBytes(part.inlineData.data), ctx);
                const bufferSource = ctx.createBufferSource();
                bufferSource.buffer = buffer;
                bufferSource.connect(gainNode);
                bufferSource.addEventListener('ended', () => {
                  activeSourcesRef.current.delete(bufferSource);
                  if (activeSourcesRef.current.size === 0) setIsPlaying(false);
                });
                bufferSource.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                activeSourcesRef.current.add(bufferSource);
              }
              
              // Text content from model (when TEXT modality is included)
              // Note: When AUDIO is primary, this may be empty - use outputTranscription instead
              if (part.text && part.text.trim()) {
                addLog('debug', `[Text] Gogga: ${part.text.substring(0, 50)}...`);
                // Don't add as transcript here - use outputTranscription for audio mode
              }
            }
            
            // Handle input transcription (user's speech-to-text from Gemini)
            // This is the real-time transcription of what the user says
            const inputTranscription = msg.serverContent?.inputTranscription?.text;
            if (inputTranscription && inputTranscription.trim()) {
              addTranscript('user', inputTranscription);
              addLog('debug', `[STT] User: ${inputTranscription.substring(0, 50)}...`);
            }
            
            // Handle output transcription (Gogga's speech-to-text from Gemini)
            // This is the transcription of what Gogga says out loud
            const outputTranscription = msg.serverContent?.outputTranscription?.text;
            if (outputTranscription && outputTranscription.trim()) {
              addTranscript('gogga', outputTranscription);
              addLog('debug', `[STT] Gogga: ${outputTranscription.substring(0, 50)}...`);
            }
            
            // Handle interruptions
            if (msg.serverContent?.interrupted) {
              activeSourcesRef.current.forEach((src: AudioBufferSourceNode) => { 
                try { src.stop(); } catch(e) {} 
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsPlaying(false);
              addLog('debug', 'Interrupted - stopping playback');
            }
            
            // Handle turn complete
            if (msg.serverContent?.turnComplete) {
              addLog('debug', 'Turn complete');
            }
          },
          onclose: (e: CloseEvent) => {
            isSessionOpenRef.current = false;
            sessionPromiseRef.current = null;
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
              streamRef.current.getTracks().forEach(track => track.stop());
              streamRef.current = null;
            }
            activeSourcesRef.current.forEach((src: AudioBufferSourceNode) => {
              try { src.stop(); } catch(e) {}
            });
            activeSourcesRef.current.clear();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
              try { audioContextRef.current.close(); } catch(e) {}
              audioContextRef.current = null;
            }
            nextStartTimeRef.current = 0;
            setIsConnected(false);
            setIsRecording(false);
            setIsPlaying(false);
            addLog('info', `Disconnected from GoggaTalk: ${e.reason || 'Connection closed'}`);
          },
          onerror: (e: ErrorEvent) => {
            console.error('GoggaTalk error:', e);
            addLog('error', `Connection error: ${e.message || 'Unknown error'}`);
            isSessionOpenRef.current = false;
            sessionPromiseRef.current = null;
            setIsConnected(false);
          }
        },
        config: {
          // CRITICAL FIX: Use ONLY AUDIO modality like tested examples
          // TEXT modality causes issues with Live API
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Aoede' } 
            } 
          },
          // CRITICAL FIX: Use plain string like tested examples
          systemInstruction: GOGGA_SYSTEM_PROMPT,
          // Enable input transcription to get user's speech as text
          inputAudioTranscription: {},
          // Enable output transcription to get Gogga's speech as text  
          outputAudioTranscription: {}
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      // NOTE: Audio processing is now set up inside onopen callback (like tested examples)
      
    } catch (error: any) {
      console.error('Connect error:', error);
      addLog('error', `Failed to connect: ${error.message}`);
      setIsConnected(false);
    }
  }, [addLog, addTranscript, isConnected]);

  // Disconnect - following tested examples cleanup pattern
  const disconnect = useCallback(async () => {
    isSessionOpenRef.current = false;
    if (sessionPromiseRef.current) {
      try { 
        const session = await sessionPromiseRef.current;
        session.close(); 
      } catch(e) {}
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
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch(e) {}
      audioContextRef.current = null;
    }
    
    // Stop all playing audio
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
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
    isMutedRef.current = false;
    setIsMuted(false);
    setIsRecording(true);
    addLog('info', '🎙️ Microphone unmuted - listening...');
  }, [isConnected, addLog]);

  // Stop recording (mute microphone)
  const stopRecording = useCallback(() => {
    isMutedRef.current = true;
    setIsMuted(true);
    setIsRecording(false);
    addLog('info', '🔇 Microphone muted');
  }, [addLog]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    setTranscripts([]);
  }, []);

  return {
    isConnected,
    isRecording,
    isMuted,
    isPlaying,
    logs,
    transcripts,
    connect,
    startRecording,
    stopRecording,
    disconnect,
    clearLogs,
  };
}
