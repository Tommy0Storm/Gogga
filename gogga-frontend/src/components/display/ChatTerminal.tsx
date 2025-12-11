'use client';

/**
 * ChatTerminal - Real-time execution log for math tools in chat
 * 
 * Adapted from gogga-admin LiveTerminal for chat UI context.
 * Shows live execution logs during tool execution, styled as a terminal.
 * Uses toolExecutionEmitter for real-time updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { toolExecutionEmitter, ExecutionEvent } from '@/lib/toolExecutionEmitter';

interface ChatTerminalProps {
  isActive?: boolean;
  maxHeight?: number;
  title?: string;
  className?: string;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'debug' | 'success' | 'error' | 'warn';
  message: string;
  icon?: string;
}

/**
 * ChatTerminal - Live execution terminal for chat interface
 */
export default function ChatTerminal({
  isActive = true,
  maxHeight = 200,
  title = 'Execution Log',
  className = '',
}: ChatTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current && !isMinimized) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, isMinimized]);

  // Subscribe to tool execution events
  useEffect(() => {
    if (!isActive) return;

    const handleEvent = (event: ExecutionEvent) => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: event.timestamp,
        level: event.level,
        message: event.message,
        icon: event.icon,
      };
      setLogs((prev) => [...prev.slice(-49), entry]); // Keep last 50 logs
    };

    const unsubscribe = toolExecutionEmitter.onAny(handleEvent);
    return () => unsubscribe();
  }, [isActive]);

  // Clear logs when component mounts
  useEffect(() => {
    setLogs([]);
  }, []);

  // Get color class based on log level
  const getLevelColor = (level: LogEntry['level']): string => {
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

  // Format time
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Don't render if no logs and not active
  if (!isActive && logs.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-gray-700 bg-[#0a0a0a] overflow-hidden font-mono text-xs shadow-lg ${className}`}
    >
      {/* Terminal Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-gray-700 cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          {/* Traffic light dots */}
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-gray-400 text-xs font-medium ml-1">
            {title}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-green-500 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">
            {logs.length} lines
          </span>
          <button
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
            aria-label={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {!isMinimized && (
        <div
          ref={terminalRef}
          className="p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 text-gray-600 py-1">
              <span className="text-green-500 animate-pulse">$</span>
              <span className="italic">Initializing...</span>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-2 py-0.5 ${getLevelColor(log.level)}`}
              >
                <span className="text-gray-600 shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span className="shrink-0">{log.icon || '›'}</span>
                <span className="break-all whitespace-pre-wrap">{log.message}</span>
              </div>
            ))
          )}
          {/* Active cursor */}
          {isActive && (
            <div className="flex items-center gap-1 mt-1 py-0.5">
              <span className="text-green-500">$</span>
              <span className="w-2 h-3.5 bg-green-500 animate-pulse" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to check if math tool is currently executing
 */
export function useMathToolExecution(): { isExecuting: boolean; toolName: string | null } {
  const [isExecuting, setIsExecuting] = useState(false);
  const [toolName, setToolName] = useState<string | null>(null);

  useEffect(() => {
    const handleEvent = (event: ExecutionEvent) => {
      // Check if it's a math tool
      if (event.toolName.startsWith('math_')) {
        if (event.type === 'start') {
          setIsExecuting(true);
          setToolName(event.toolName);
        } else if (event.type === 'complete' || event.type === 'error') {
          setIsExecuting(false);
          setToolName(null);
        }
      }
    };

    const unsubscribe = toolExecutionEmitter.onAny(handleEvent);
    return () => unsubscribe();
  }, []);

  return { isExecuting, toolName };
}
