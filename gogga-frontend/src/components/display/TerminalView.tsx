'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface TerminalLine {
  id: string;
  timestamp: Date;
  level: 'info' | 'debug' | 'success' | 'error' | 'warn';
  message: string;
  icon?: string;
}

interface TerminalViewProps {
  lines: TerminalLine[];
  title?: string;
  maxLines?: number;
  autoScroll?: boolean;
  showTimestamp?: boolean;
  className?: string;
}

/**
 * TerminalView - Live verbose output display for math tool execution
 * 
 * Displays real-time logs with color-coded levels and auto-scrolling.
 * Monochrome theme with grey gradients per project style.
 */
export default function TerminalView({
  lines,
  title = 'Execution Log',
  maxLines = 50,
  autoScroll = true,
  showTimestamp = true,
  className = '',
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (autoScroll && terminalRef.current && isExpanded) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, autoScroll, isExpanded]);

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

  // Get the last N lines
  const displayLines = lines.slice(-maxLines);

  return (
    <div
      className={`rounded-lg border border-gray-700 bg-gray-900 overflow-hidden font-mono text-sm ${className}`}
    >
      {/* Terminal Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {/* Traffic light dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-600" />
            <div className="w-3 h-3 rounded-full bg-gray-600" />
            <div className="w-3 h-3 rounded-full bg-gray-600" />
          </div>
          <span className="text-gray-400 text-xs font-medium ml-2">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
          <button
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {isExpanded && (
        <div
          ref={terminalRef}
          className="p-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        >
          {displayLines.length === 0 ? (
            <div className="text-gray-600 italic">Waiting for execution...</div>
          ) : (
            displayLines.map((line) => (
              <div
                key={line.id}
                className={`flex items-start gap-2 py-0.5 ${getLevelStyles(line.level)}`}
              >
                {showTimestamp && (
                  <span className="text-gray-600 text-xs shrink-0">
                    [{formatTime(line.timestamp)}]
                  </span>
                )}
                <span className="shrink-0">{line.icon || getLevelPrefix(line.level)}</span>
                <span className="break-all">{line.message}</span>
              </div>
            ))
          )}
          {/* Cursor blink effect */}
          <div className="flex items-center gap-1 mt-1">
            <span className="text-green-500">$</span>
            <span className="w-2 h-4 bg-gray-400 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage terminal lines state
 */
export function useTerminalLines(initialLines: TerminalLine[] = []) {
  const [lines, setLines] = useState<TerminalLine[]>(initialLines);

  const addLine = (
    message: string,
    level: TerminalLine['level'] = 'info',
    icon?: string
  ) => {
    const newLine: TerminalLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      icon,
    };
    setLines((prev) => [...prev, newLine]);
    return newLine.id;
  };

  const clear = () => setLines([]);

  const addInfo = (message: string, icon?: string) => addLine(message, 'info', icon);
  const addDebug = (message: string, icon?: string) => addLine(message, 'debug', icon);
  const addSuccess = (message: string, icon?: string) => addLine(message, 'success', icon);
  const addError = (message: string, icon?: string) => addLine(message, 'error', icon);
  const addWarn = (message: string, icon?: string) => addLine(message, 'warn', icon);

  return {
    lines,
    addLine,
    addInfo,
    addDebug,
    addSuccess,
    addError,
    addWarn,
    clear,
    setLines,
  };
}

/**
 * Parse backend log messages into terminal lines
 */
export function parseBackendLogs(logText: string): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const logLines = logText.split('\n').filter((l) => l.trim());

  for (const logLine of logLines) {
    let level: TerminalLine['level'] = 'info';
    let icon: string | undefined;
    let message = logLine;

    // Detect level from log format or emoji
    if (logLine.includes('ERROR') || logLine.includes('❌')) {
      level = 'error';
      icon = '❌';
    } else if (logLine.includes('WARNING') || logLine.includes('⚠')) {
      level = 'warn';
      icon = '⚠️';
    } else if (logLine.includes('SUCCESS') || logLine.includes('✔') || logLine.includes('✅')) {
      level = 'success';
      icon = '✅';
    } else if (logLine.includes('DEBUG') || logLine.includes('•')) {
      level = 'debug';
    }

    // Extract emoji icons from common patterns
    const emojiMatch = logLine.match(/^(📊|🧾|💰|🔍|🧮|🔧|✅|❌|⚠️)\s*/);
    if (emojiMatch) {
      icon = emojiMatch[1];
      message = logLine.slice(emojiMatch[0].length);
    }

    lines.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      icon,
    });
  }

  return lines;
}
