/**
 * GoggaTalkTerminal
 * 
 * A robust terminal interface for GoggaTalk voice chat.
 * Shows connection status, logs, transcripts, and voice controls.
 * Uses Gemini Live API for real-time voice conversation.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useGoggaTalkDirect, GoggaTalkLog } from '@/hooks/useGoggaTalkDirect';

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
    logs,
    transcripts,
    connect,
    startRecording,
    stopRecording,
    disconnect,
    clearLogs,
  } = useGoggaTalkDirect({ userTier });
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [showTranscripts, setShowTranscripts] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  
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
      case 'success': return '✓';
      case 'error': return '✗';
      case 'warning': return '⚠';
      case 'debug': return '○';
      default: return '●';
    }
  };
  
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
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
          
          {/* Title */}
          <span className="text-gray-300 text-sm font-mono font-medium">
            🦗 GoggaTalk Voice Chat
          </span>
          
          {/* Connection status */}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isConnected 
              ? 'bg-green-900/50 text-green-400' 
              : 'bg-gray-700 text-gray-400'
          }`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </span>
          
          {/* Recording indicator */}
          {isConnected && isRecording && !isMuted && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Listening...
            </span>
          )}
          
          {/* Muted indicator */}
          {isConnected && isMuted && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 flex items-center gap-1">
              🔇 Muted
            </span>
          )}
          
          {/* Playing indicator */}
          {isPlaying && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400 animate-pulse">
              🔊 Speaking...
            </span>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTranscripts(!showTranscripts)}
            className={`text-xs px-2 py-1 rounded ${
              showTranscripts ? 'bg-blue-700 text-blue-200' : 'bg-gray-800 text-gray-500'
            }`}
            title="Toggle transcripts"
          >
            💬
          </button>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`text-xs px-2 py-1 rounded ${
              showLogs ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-500'
            }`}
            title="Toggle logs"
          >
            📋
          </button>
          <button
            onClick={clearLogs}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200"
            title="Clear logs"
          >
            🗑️
          </button>
        </div>
      </div>
      
      {/* SA Flag Banner */}
      <div className="h-1 flex">
        <div className="flex-1 bg-red-600" />
        <div className="flex-1 bg-blue-600" />
        <div className="flex-1 bg-green-600" />
        <div className="flex-1 bg-yellow-500" />
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-white" />
      </div>
      
      {/* Title Banner */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🇿🇦</span>
          GoggaTalk - Voice Chat in 11 Official Languages
        </h2>
        <p className="text-gray-400 text-xs mt-1">
          Powered by Gemini Live API • Real-time voice conversation • Speak naturally
        </p>
      </div>
      
      {/* Main Content Area */}
      <div className="h-56 overflow-y-auto p-4 font-mono text-sm bg-black/50">
        {/* Transcripts Section */}
        {showTranscripts && (
          <div className="mb-4">
            {transcripts.length === 0 ? (
              <div className="text-gray-500 italic text-center py-4">
                {isConnected 
                  ? isRecording 
                    ? '🎙️ Listening... Speak to start the conversation!' 
                    : '🔇 Microphone muted. Click "Unmute" to speak.'
                  : '🔌 Click "Connect" to start voice chat with Gogga'
                }
              </div>
            ) : (
              transcripts.map((t, i) => (
                <div 
                  key={i} 
                  className={`mb-3 p-2 rounded-lg ${
                    t.speaker === 'user' 
                      ? 'bg-blue-900/30 border-l-2 border-blue-500 ml-8' 
                      : 'bg-green-900/30 border-l-2 border-green-500 mr-8'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{t.speaker === 'user' ? '👤' : '🦗'}</span>
                    <span className={`font-bold text-xs ${
                      t.speaker === 'user' ? 'text-blue-400' : 'text-green-400'
                    }`}>
                      {t.speaker === 'user' ? 'You' : 'Gogga'}
                    </span>
                    <span className="text-gray-600 text-xs">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className={`${t.speaker === 'user' ? 'text-blue-200' : 'text-green-200'}`}>
                    {t.text}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Logs Section - Hidden by default */}
        {showLogs && logs.length > 0 && (
          <div className={showTranscripts && transcripts.length > 0 ? 'pt-4 border-t border-gray-700' : ''}>
            <div className="text-gray-500 text-xs mb-2 uppercase tracking-wide">System Logs</div>
            {logs.map((log, index) => (
              <div key={index} className={`mb-1 text-xs ${getLogColor(log.level)}`}>
                <span className="mr-2">{getLogIcon(log.level)}</span>
                <span className="text-gray-600 mr-2">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {log.message}
              </div>
            ))}
          </div>
        )}
        <div ref={logsEndRef} />
      </div>
      
      {/* Control Bar */}
      <div className="bg-gray-800 px-4 py-3 border-t border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Connect/Disconnect Button */}
          {!isConnected ? (
            <button
              onClick={connect}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span>🔌</span> Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span>⏹️</span> Disconnect
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
                  <span>🎙️</span> Unmute
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <span>🔇</span> Mute
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Status */}
        <div className="text-gray-400 text-sm">
          {isConnected && isRecording && !isMuted && (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Listening...
            </span>
          )}
          {isConnected && (isMuted || !isRecording) && (
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-2 h-2 bg-gray-500 rounded-full" />
              Microphone muted
            </span>
          )}
          {isPlaying && (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Gogga is speaking...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
