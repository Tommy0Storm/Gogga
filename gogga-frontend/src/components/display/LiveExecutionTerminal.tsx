'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { toolExecutionEmitter, ExecutionEvent } from '@/lib/toolExecutionEmitter';
import { TerminalLine } from './TerminalView';

interface LiveExecutionTerminalProps {
  /** Whether the terminal is currently active (subscribing to events) */
  isActive: boolean;
  /** Maximum lines to display (default 30) */
  maxLines?: number;
  /** Terminal title */
  title?: string;
  /** Additional className */
  className?: string;
  /** Whether to show timestamps */
  showTimestamp?: boolean;
}

/**
 * LiveExecutionTerminal - Real-time tool execution display for chat
 * 
 * Subscribes to toolExecutionEmitter and displays live logs during
 * math tool calculations. Styled to match the admin terminal aesthetic
 * but sized for chat bubble display.
 */
export default function LiveExecutionTerminal({
  isActive,
  maxLines = 30,
  title = 'Calculating...',
  className = '',
  showTimestamp = false,
}: LiveExecutionTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentTool, setCurrentTool] = useState<string>('');
  const [isComplete, setIsComplete] = useState(false);

  // Convert ExecutionEvent to TerminalLine
  const eventToLine = useCallback((event: ExecutionEvent): TerminalLine => ({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: event.timestamp,
    level: event.level,
    message: event.message,
    icon: event.icon,
  }), []);

  // Subscribe to execution events when active
  useEffect(() => {
    if (!isActive) {
      // Reset when inactive
      return;
    }

    // Clear previous logs when starting
    setLines([]);
    setIsComplete(false);

    const unsubscribe = toolExecutionEmitter.onAny((event) => {
      setCurrentTool(event.toolName);
      
      // Add line to display
      setLines(prev => {
        const newLines = [...prev, eventToLine(event)];
        // Keep only the last maxLines
        return newLines.slice(-maxLines);
      });

      // Track completion
      if (event.type === 'complete' || event.type === 'error') {
        setIsComplete(true);
      }
    });

    return unsubscribe;
  }, [isActive, maxLines, eventToLine]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Get color class based on log level
  const getLevelStyles = (level: TerminalLine['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'success':
        return 'text-green-400';
      case 'debug':
        return 'text-gray-500';
      case 'info':
      default:
        return 'text-gray-300';
    }
  };

  // Get level prefix
  const getLevelPrefix = (level: TerminalLine['level']) => {
    switch (level) {
      case 'error':
        return '✖';
      case 'warn':
        return '⚠';
      case 'success':
        return '✔';
      case 'debug':
        return '•';
      case 'info':
      default:
        return '›';
    }
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Dynamic title based on current tool
  const displayTitle = currentTool 
    ? `${currentTool}${isComplete ? ' (done)' : '...'}`
    : title;

  return (
    <div
      className={`rounded-lg border border-gray-700 bg-gray-900 overflow-hidden font-mono text-xs ${className}`}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* Traffic light dots - monochrome */}
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <div className="w-2 h-2 rounded-full bg-gray-600" />
          </div>
          <span className="text-gray-400 text-xs font-medium ml-1">
            {displayTitle}
          </span>
        </div>
        {/* Live indicator */}
        {!isComplete && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-green-500 text-xs">LIVE</span>
          </div>
        )}
      </div>

      {/* Terminal Body */}
      <div
        ref={terminalRef}
        className="p-2 max-h-48 min-h-16 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        style={{ fontSize: '11px' }}
      >
        {lines.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="animate-pulse">▌</span>
            <span>Initializing execution...</span>
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className={`flex items-start gap-1.5 py-0.5 leading-tight ${getLevelStyles(line.level)}`}
            >
              {showTimestamp && (
                <span className="text-gray-600 shrink-0">
                  {formatTime(line.timestamp)}
                </span>
              )}
              <span className="shrink-0 w-4 text-center">
                {line.icon || getLevelPrefix(line.level)}
              </span>
              <span className="break-all">{line.message}</span>
            </div>
          ))
        )}
        {/* Blinking cursor when still running */}
        {!isComplete && lines.length > 0 && (
          <div className="flex items-center gap-1.5 py-0.5 text-gray-500">
            <span className="w-4" />
            <span className="animate-pulse">▌</span>
          </div>
        )}
      </div>
    </div>
  );
}
