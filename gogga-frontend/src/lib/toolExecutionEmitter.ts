/**
 * Tool Execution Event Emitter
 * 
 * Provides real-time execution logs for tools that can be
 * displayed in the TerminalView component.
 */

import { TerminalLine } from '@/components/display/TerminalView';

type LogLevel = 'info' | 'debug' | 'success' | 'error' | 'warn';

interface ExecutionEvent {
  type: 'log' | 'start' | 'complete' | 'error';
  toolName: string;
  message: string;
  level: LogLevel;
  icon?: string;
  timestamp: Date;
  data?: unknown;
}

type ExecutionListener = (event: ExecutionEvent) => void;

class ToolExecutionEmitter {
  private listeners: Map<string, Set<ExecutionListener>> = new Map();
  private globalListeners: Set<ExecutionListener> = new Set();
  private executionLogs: Map<string, TerminalLine[]> = new Map();

  /**
   * Subscribe to all execution events
   */
  onAny(listener: ExecutionListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * Subscribe to events for a specific tool
   */
  on(toolName: string, listener: ExecutionListener): () => void {
    if (!this.listeners.has(toolName)) {
      this.listeners.set(toolName, new Set());
    }
    this.listeners.get(toolName)!.add(listener);
    return () => this.listeners.get(toolName)?.delete(listener);
  }

  /**
   * Emit an execution event
   */
  emit(event: Omit<ExecutionEvent, 'timestamp'>): void {
    const fullEvent: ExecutionEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Store in execution logs
    const executionId = `${event.toolName}-${Date.now()}`;
    if (!this.executionLogs.has(executionId)) {
      this.executionLogs.set(executionId, []);
    }
    this.executionLogs.get(executionId)!.push(this.eventToTerminalLine(fullEvent));

    // Notify tool-specific listeners
    this.listeners.get(event.toolName)?.forEach((listener) => listener(fullEvent));

    // Notify global listeners
    this.globalListeners.forEach((listener) => listener(fullEvent));

    // Also log to console for debugging
    console.log(`[ToolExecution] ${event.icon || '›'} ${event.toolName}: ${event.message}`);
  }

  /**
   * Convert event to TerminalLine for display
   */
  private eventToTerminalLine(event: ExecutionEvent): TerminalLine {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: event.timestamp,
      level: event.level,
      message: event.message,
      icon: event.icon,
    };
  }

  /**
   * Emit a start event
   */
  start(toolName: string, args?: unknown): void {
    this.emit({
      type: 'start',
      toolName,
      message: `Starting ${toolName}...`,
      level: 'info',
      icon: '🔧',
      data: args,
    });
  }

  /**
   * Emit an info log
   */
  info(toolName: string, message: string, icon?: string): void {
    this.emit({
      type: 'log',
      toolName,
      message,
      level: 'info',
      icon,
    });
  }

  /**
   * Emit a debug log
   */
  debug(toolName: string, message: string): void {
    this.emit({
      type: 'log',
      toolName,
      message,
      level: 'debug',
      icon: '•',
    });
  }

  /**
   * Emit a success event
   */
  success(toolName: string, message: string, data?: unknown): void {
    this.emit({
      type: 'complete',
      toolName,
      message,
      level: 'success',
      icon: '✅',
      data,
    });
  }

  /**
   * Emit an error event
   */
  error(toolName: string, message: string, error?: unknown): void {
    this.emit({
      type: 'error',
      toolName,
      message,
      level: 'error',
      icon: '❌',
      data: error,
    });
  }

  /**
   * Emit a warning
   */
  warn(toolName: string, message: string): void {
    this.emit({
      type: 'log',
      toolName,
      message,
      level: 'warn',
      icon: '⚠️',
    });
  }

  /**
   * Get all logs for a tool execution
   */
  getLogs(toolName: string): TerminalLine[] {
    const allLogs: TerminalLine[] = [];
    this.executionLogs.forEach((logs, key) => {
      if (key.startsWith(toolName)) {
        allLogs.push(...logs);
      }
    });
    return allLogs;
  }

  /**
   * Clear logs older than maxAge (default 5 minutes)
   */
  clearOldLogs(maxAgeMs: number = 5 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.executionLogs.forEach((logs, key) => {
      const timestamp = parseInt(key.split('-').pop() || '0', 10);
      if (timestamp < cutoff) {
        this.executionLogs.delete(key);
      }
    });
  }
}

// Singleton instance
export const toolExecutionEmitter = new ToolExecutionEmitter();

// Export types
export type { ExecutionEvent, ExecutionListener, LogLevel };
