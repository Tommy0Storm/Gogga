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
        return 'text-success';
      case 'error':
        return 'text-error';
      case 'warning':
        return 'text-warning';
      case 'debug':
        return 'text-primary-500';
      case 'info':
      default:
        return 'text-info';
    }
  };

  const getLevelIcon = (level: TerminalLog['level']) => {
    switch (level) {
      case 'success':
        return <Check size={14} className="text-success" />;
      case 'error':
        return <AlertCircle size={14} className="text-error" />;
      case 'warning':
        return <AlertCircle size={14} className="text-warning" />;
      case 'debug':
        return <span className="text-primary-500 text-xs">•</span>;
      case 'info':
      default:
        return <Info size={14} className="text-info" />;
    }
  };

  // Don't render if no logs ever received
  if (logs.length === 0 && !isActive) return null;

  return (
    <div className="w-full space-y-3">
      {/* Collapsible Thinking Block (above terminal) */}
      {(thinkingContent || isThinking) && (
        <div className="rounded-xl overflow-hidden border border-primary-300 bg-primary-800 shadow-soft">
          <button
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-accent-gold" />
              <span className="text-sm font-medium text-primary-100">AI Thinking</span>
              {isThinking && (
                <div className="flex items-center gap-1.5">
                  <Activity size={14} className="text-accent-gold animate-pulse" />
                  <span className="text-xs text-accent-gold">Processing...</span>
                </div>
              )}
            </div>
            {thinkingExpanded ? (
              <ChevronUp size={16} className="text-primary-400" />
            ) : (
              <ChevronDown size={16} className="text-primary-400" />
            )}
          </button>
          {thinkingExpanded && thinkingContent && (
            <div className="px-4 py-3 border-t border-primary-600 max-h-48 overflow-y-auto">
              <p className="text-sm text-primary-300 font-mono whitespace-pre-wrap">
                {thinkingContent}
              </p>
            </div>
          )}
        </div>
      )}

      {/* GoggaSolve Terminal */}
      <div className="rounded-xl overflow-hidden border border-primary-300 bg-primary-900 shadow-elevated">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-primary-800 border-b border-primary-600">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-accent-teal" />
            <span className="text-sm font-medium text-primary-100">GoggaSolve</span>
            {isActive && (
              <div className="flex items-center gap-1.5">
                <Activity size={14} className="text-accent-teal animate-pulse" />
                <span className="text-xs text-accent-teal">Live</span>
              </div>
            )}
            {!isActive && logs.length > 0 && (
              <span className="text-xs text-primary-500">Complete</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {toolsRunning.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary-700 rounded-lg text-xs">
                <Sparkles size={12} className="text-accent-gold" />
                <span className="text-primary-200">{toolsRunning.join(', ')}</span>
              </div>
            )}
            {toolCount > 0 && (
              <span className="text-xs text-primary-500">
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
                className="text-xs text-accent-gold hover:text-accent-gold-dark px-1"
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
          className="p-4 h-48 overflow-y-auto font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-primary-600 scrollbar-track-primary-900"
          style={{ backgroundColor: 'var(--color-dark-bg)' }}
        >
          {logs.length === 0 ? (
            <div className="flex items-center gap-3 text-primary-500">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-accent-gold rounded-full animate-pulse"></span>
                <span className="w-2 h-2 bg-accent-gold rounded-full animate-pulse delay-100"></span>
                <span className="w-2 h-2 bg-accent-gold rounded-full animate-pulse delay-200"></span>
              </div>
              <span>Initializing GoggaSolve...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5 select-none">{getLevelIcon(log.level)}</span>
                  <span className={`${getLevelStyles(log.level)} select-text`}>{log.message}</span>
                </div>
              ))}
              {isActive && (
                <div className="flex items-center gap-2 text-primary-500 mt-2">
                  <span className="inline-block w-2 h-3 bg-accent-teal animate-pulse"></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Terminal Footer - Status bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-primary-800 border-t border-primary-600 text-sm text-primary-500">
          <span>{logs.length} log entries</span>
          <span>{isActive ? 'Calculating...' : 'Ready'}</span>
        </div>
      </div>
    </div>
  );
}

export default ChatTerminal;
