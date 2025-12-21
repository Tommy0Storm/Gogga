/**
 * GoggaTalkTerminal
 * 
 * A robust terminal interface for GoggaTalk voice chat.
 * Shows connection status, logs, transcripts, and voice controls.
 * Uses Gemini Live API for real-time voice conversation.
 * 
 * Design: Monochrome Material Icons only (no emojis)
 * Features:
 * - Audio sinewave visualizer (white = Gogga, blue = user, gray = idle)
 * - Chat transcripts shown by default (logs hidden, expandable)
 * - Session resumption for interrupted conversations
 * - Screen sharing support
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Power, 
  StopCircle, 
  Monitor, 
  Mic, 
  MicOff, 
  MessageSquare, 
  ScrollText, 
  Trash2,
  Headphones,
  Globe,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Circle,
  CircleDot,
  Bug,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useGoggaTalkDirect, GoggaTalkLog } from '@/hooks/useGoggaTalkDirect';
import { AudioWaveVisualizer, type VisualizerState } from './AudioWaveVisualizer';

interface GoggaTalkTerminalProps {
  onClose: () => void;
  isVisible: boolean;
  userTier?: string;
}

export function GoggaTalkTerminal({ onClose, isVisible, userTier = 'FREE' }: GoggaTalkTerminalProps) {
  const {
    isConnected,
    isRecording,
    isMuted,
    isPlaying,
    isScreenSharing,
    error,
    logs,
    transcripts,
    userAudioLevel,
    goggaAudioLevel,
    connect,
    startRecording,
    stopRecording,
    startScreenShare,
    stopScreenShare,
    disconnect,
    clearLogs,
  } = useGoggaTalkDirect({ userTier });
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [showTranscripts, setShowTranscripts] = useState(true);
  const [showLogs, setShowLogs] = useState(false); // Logs hidden by default - transcripts are primary
  
  // Derive visualizer state from connection state
  const visualizerState: VisualizerState = isPlaying 
    ? 'gogga-speaking' 
    : (isRecording && !isMuted) 
      ? 'user-speaking' 
      : 'idle';
  
  // Select appropriate audio level based on state
  const currentAudioLevel = isPlaying ? goggaAudioLevel : userAudioLevel;
  
  // Auto-scroll to bottom when logs update
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, transcripts]);
  
  // Cleanup only when component unmounts
  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  if (!isVisible) return null;
  
  const getLogColor = (level: GoggaTalkLog['level']) => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'debug': return 'text-gray-500';
      default: return 'text-gray-300';
    }
  };
  
  const getLogIcon = (level: GoggaTalkLog['level']) => {
    switch (level) {
      case 'success': return <CheckCircle size={12} className="text-green-400" />;
      case 'error': return <XCircle size={12} className="text-red-400" />;
      case 'warning': return <AlertTriangle size={12} className="text-yellow-400" />;
      case 'debug': return <Circle size={10} className="text-gray-500" />;
      default: return <CircleDot size={12} className="text-gray-300" />;
    }
  };
  
  return (
    // Modal overlay - centered on screen
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Modal container with max dimensions */}
      <div className="w-full max-w-2xl mx-4 bg-gray-900 rounded-xl overflow-hidden border border-gray-600 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header - Always visible */}
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            {/* Terminal dots */}
            <div className="flex gap-1.5">
              <button 
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors"
                title="Close"
              />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            
            {/* Title - Icon + Text (no emojis) */}
            <div className="flex items-center gap-2">
              <Bug size={18} className="text-green-400" />
              <span className="text-white font-semibold">GoggaTalk Voice Chat</span>
            </div>
          </div>
          
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1.5 ${
              isConnected 
                ? 'bg-green-900/50 text-green-400' 
                : 'bg-gray-700 text-gray-400'
            }`}>
              {isConnected ? <><CircleDot size={10} /> Connected</> : <><Circle size={10} /> Disconnected</>}
            </span>
            
            {/* Screen sharing indicator */}
            {isScreenSharing && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-900/50 text-purple-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                Screen
              </span>
            )}
          </div>
        </div>
        
        {/* SA Flag Banner */}
        <div className="h-1 flex shrink-0">
          <div className="flex-1 bg-red-600" />
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-green-600" />
          <div className="flex-1 bg-yellow-500" />
          <div className="flex-1 bg-black" />
          <div className="flex-1 bg-white" />
        </div>
        
        {/* Control Bar - Primary actions at top for visibility */}
        <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Main control buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Connect/Disconnect Button */}
              {!isConnected ? (
                <button
                  onClick={connect}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Power size={16} /> Connect
                </button>
              ) : (
                <button
                  onClick={disconnect}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <StopCircle size={16} /> Disconnect
                </button>
              )}
              
              {/* Screen Share Button - Always visible next to connect */}
              {!isScreenSharing ? (
                <button
                  onClick={startScreenShare}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  title={isConnected ? "Share your screen with Gogga" : "Connect first to share screen"}
                >
                  <Monitor size={16} /> Share Screen
                </button>
              ) : (
                <button
                  onClick={stopScreenShare}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  title="Stop sharing screen"
                >
                  <Monitor size={16} /> Stop Share
                </button>
              )}
              
              {/* Mute/Unmute Button */}
              {isConnected && (
                <>
                  {isMuted || !isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={isPlaying}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Mic size={16} /> Unmute
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <MicOff size={16} /> Mute
                    </button>
                  )}
                </>
              )}
            </div>
            
            {/* Toggle buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTranscripts(!showTranscripts)}
                className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  showTranscripts ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
                title="Toggle conversation view"
              >
                <MessageSquare size={12} /> Chat
              </button>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  showLogs ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
                title={showLogs ? "Hide system logs" : "Show system logs"}
              >
                <ScrollText size={12} /> 
                Logs
                {showLogs ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
              <button
                onClick={clearLogs}
                className="text-xs px-2 py-1.5 rounded-lg bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 flex items-center transition-colors"
                title="Clear all logs and transcripts"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          
          {/* Status indicators with Audio Visualizer */}
          <div className="flex items-center gap-3 mt-3">
            {/* Audio Visualizer - Central focus */}
            {isConnected && (
              <div className="flex-1 flex justify-center">
                <AudioWaveVisualizer
                  state={visualizerState}
                  audioLevel={currentAudioLevel}
                  width={180}
                  height={32}
                  showActivityIndicator={true}
                />
              </div>
            )}
            
            {/* Status text indicators */}
            <div className="flex items-center gap-3 text-xs shrink-0">
              {isConnected && isRecording && !isMuted && !isPlaying && (
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Listening...
                </span>
              )}
              {isConnected && (isMuted || !isRecording) && !isPlaying && (
                <span className="flex items-center gap-1 text-gray-500">
                  <span className="w-2 h-2 bg-gray-500 rounded-full" />
                  Mic muted
                </span>
              )}
              {isPlaying && (
                <span className="flex items-center gap-1 text-white font-medium">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Gogga speaking
                </span>
              )}
              {!isConnected && (
                <span className="flex-1 text-gray-600 flex items-center justify-center gap-1">
                  <Headphones size={12} /> Headphones recommended
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Error Banner - Shown when microphone permission denied or other errors */}
        {error && (
          <div className="mx-4 mt-2 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-3">
            <XCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-300 text-sm">{error}</p>
              <button
                onClick={connect}
                className="mt-2 text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
        
        {/* Main Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-black/50 min-h-50">
          {/* Transcripts Section */}
          {showTranscripts && (
            <div className="mb-4">
              {transcripts.length === 0 ? (
                <div className="text-gray-500 italic text-center py-8">
                  {isConnected ? (
                    // Connected but no transcripts yet - show large visualizer
                    <div className="flex flex-col items-center gap-4">
                      <AudioWaveVisualizer
                        state={visualizerState}
                        audioLevel={currentAudioLevel}
                        width={240}
                        height={48}
                        showActivityIndicator={true}
                      />
                      {isRecording && !isMuted ? (
                        <span className="flex items-center gap-2 text-blue-400">
                          <Mic size={16} /> Listening... Speak to start the conversation!
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-gray-500">
                          <MicOff size={16} /> Microphone muted. Click "Unmute" to speak.
                        </span>
                      )}
                    </div>
                  ) : (
                    // Not connected - show connect prompt with SA flag
                    <div>
                      <div className="flex justify-center mb-3">
                        <div className="flex w-16 h-4 rounded overflow-hidden">
                          <div className="flex-1 bg-red-600" />
                          <div className="flex-1 bg-blue-600" />
                          <div className="flex-1 bg-green-600" />
                          <div className="flex-1 bg-yellow-500" />
                          <div className="flex-1 bg-black" />
                          <div className="flex-1 bg-white" />
                        </div>
                      </div>
                      <p className="mb-2 flex items-center justify-center gap-2">
                        <Power size={16} /> Click "Connect" to start voice chat
                      </p>
                      <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                        <Globe size={12} /> Supports all 11 SA official languages
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                transcripts.map((t, i) => (
                  <div 
                    key={i} 
                    className={`mb-3 p-3 rounded-lg ${
                      t.speaker === 'user' 
                        ? 'bg-blue-900/30 border-l-4 border-blue-500 ml-8' 
                        : 'bg-green-900/30 border-l-4 border-green-500 mr-8'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {t.speaker === 'user' 
                        ? <User size={16} className="text-blue-400" /> 
                        : <Bug size={16} className="text-green-400" />
                      }
                      <span className={`font-bold text-xs ${
                        t.speaker === 'user' ? 'text-blue-400' : 'text-green-400'
                      }`}>
                        {t.speaker === 'user' ? 'You' : 'Gogga'}
                      </span>
                      <span className="text-gray-600 text-xs">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={`text-sm ${t.speaker === 'user' ? 'text-blue-200' : 'text-green-200'}`}>
                      {t.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {/* Verbose Logs Section - Below transcript, visible by default */}
          {showLogs && logs.length > 0 && (
            <div className={showTranscripts && transcripts.length > 0 ? 'pt-4 border-t border-gray-700' : ''}>
              <div className="text-gray-500 text-xs mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <ScrollText size={12} /> Verbose System Logs
              </div>
              {logs.map((log, index) => (
                <div key={index} className={`mb-1 text-xs flex items-start gap-2 ${getLogColor(log.level)}`}>
                  <span className="shrink-0 mt-0.5">{getLogIcon(log.level)}</span>
                  <span className="text-gray-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
