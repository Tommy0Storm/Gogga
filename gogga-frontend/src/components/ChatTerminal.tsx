'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Activity, Check, AlertCircle, Info, Sparkles, ChevronDown, ChevronUp, Brain } from 'lucide-react';

export interface TerminalLog {
  level: 'info' | 'debug' | 'success' | 'error' | 'warning';
  message: string;
  icon?: string;
  timestamp?: number;
}

interface ChatTerminalProps {
  logs: TerminalLog[];
  isActive: boolean;
  toolsRunning?: string[];
  toolCount?: number;
  thinkingContent?: string;
  isThinking?: boolean;
}

/**
 * GoggaSolve Terminal - Live execution logs for math tools.
 * Always visible once triggered, with scrollable buffered output.
 * Includes collapsible thinking block above the terminal.
 */
export function ChatTerminal({ 
  logs, 
  isActive, 
  toolsRunning = [], 
  toolCount = 0,
  thinkingContent = '',
  isThinking = false
}: ChatTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new logs (only if autoScroll enabled)
  useEffect(() => {
    if (scrollRef.current && autoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
      setAutoScroll(isAtBottom);
    }
  };

  const getLevelStyles = (level: TerminalLog['level']) => {
    switch (level) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-amber-400';
      case 'debug':
        return 'text-gray-500';
      case 'info':
      default:
        return 'text-gray-300';
    }
  };

  const getLevelIcon = (level: TerminalLog['level']) => {
    switch (level) {
      case 'success':
        return <Check size={12} className="text-green-400" />;
      case 'error':
        return <AlertCircle size={12} className="text-red-400" />;
      case 'warning':
        return <AlertCircle size={12} className="text-amber-400" />;
      case 'debug':
        return <span className="text-gray-500 text-xs">•</span>;
      case 'info':
      default:
        return <Info size={12} className="text-gray-400" />;
    }
  };

  // Don't render if no logs ever received
  if (logs.length === 0 && !isActive) return null;

  return (
    <div className="w-full space-y-2">
      {/* Collapsible Thinking Block (above terminal) */}
      {(thinkingContent || isThinking) && (
        <div className="rounded-lg overflow-hidden border border-gray-600 bg-gray-800">
          <button
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-purple-400" />
              <span className="text-xs font-medium text-gray-300">AI Thinking</span>
              {isThinking && (
                <div className="flex items-center gap-1.5">
                  <Activity size={12} className="text-purple-400 animate-pulse" />
                  <span className="text-xs text-purple-400">Processing...</span>
                </div>
              )}
            </div>
            {thinkingExpanded ? (
              <ChevronUp size={14} className="text-gray-400" />
            ) : (
              <ChevronDown size={14} className="text-gray-400" />
            )}
          </button>
          {thinkingExpanded && thinkingContent && (
            <div className="px-3 py-2 border-t border-gray-700 max-h-40 overflow-y-auto">
              <p className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                {thinkingContent}
              </p>
            </div>
          )}
        </div>
      )}

      {/* GoggaSolve Terminal */}
      <div className="rounded-lg overflow-hidden border border-gray-700 bg-gray-900 shadow-lg">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-primary-400" />
            <span className="text-xs font-medium text-primary-300">GoggaSolve</span>
            {isActive && (
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-green-400 animate-pulse" />
                <span className="text-xs text-green-400">Live</span>
              </div>
            )}
            {!isActive && logs.length > 0 && (
              <span className="text-xs text-gray-500">Complete</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {toolsRunning.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded text-xs">
                <Sparkles size={10} className="text-primary-400" />
                <span className="text-gray-300">{toolsRunning.join(', ')}</span>
              </div>
            )}
            {toolCount > 0 && (
              <span className="text-xs text-gray-500">
                {toolCount} calc{toolCount > 1 ? 's' : ''}
              </span>
            )}
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                  }
                }}
                className="text-xs text-primary-400 hover:text-primary-300 px-1"
              >
                ↓ Jump to bottom
              </button>
            )}
          </div>
        </div>

        {/* Terminal Body - Scrollable with buffered output */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="p-3 h-40 overflow-y-auto font-mono text-xs leading-relaxed scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900"
          style={{ backgroundColor: '#0d1117' }}
        >
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-pulse"></span>
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-pulse delay-100"></span>
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-pulse delay-200"></span>
              </div>
              <span>Initializing GoggaSolve...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5 select-none">{getLevelIcon(log.level)}</span>
                  <span className={`${getLevelStyles(log.level)} select-text`}>{log.message}</span>
                </div>
              ))}
              {isActive && (
                <div className="flex items-center gap-2 text-gray-500 mt-1">
                  <span className="inline-block w-2 h-3 bg-gray-400 animate-pulse"></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Terminal Footer - Status bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
          <span>{logs.length} log entries</span>
          <span>{isActive ? 'Calculating...' : 'Ready'}</span>
        </div>
      </div>
    </div>
  );
}

export default ChatTerminal;
