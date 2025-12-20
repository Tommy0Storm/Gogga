'use client';

import { useState, useCallback, useRef } from 'react';
import type { TerminalLog } from '@/components/ChatTerminal';

interface ToolStreamingState {
  logs: TerminalLog[];
  isActive: boolean;
  toolsRunning: string[];
  toolCount: number;
  content: string;
  isThinking: boolean;
  thinkingContent: string;
  isDone: boolean;
  error: string | null;
  meta: {
    tier?: string;
    layer?: string;
    model?: string;
    latency?: number;
    mathToolsExecuted?: string[];
    mathToolCount?: number;
    cost?: number;
  };
}

interface UseToolStreamingOptions {
  onContent?: (content: string) => void;
  onComplete?: (state: ToolStreamingState) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for handling SSE streaming with live tool execution logs.
 * Connects to /api/v1/chat/stream-with-tools endpoint.
 */
export function useToolStreaming(options: UseToolStreamingOptions = {}) {
  const [state, setState] = useState<ToolStreamingState>({
    logs: [],
    isActive: false,
    toolsRunning: [],
    toolCount: 0,
    content: '',
    isThinking: false,
    thinkingContent: '',
    isDone: false,
    error: null,
    meta: {},
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (request: {
    user_id: string;
    message: string;
    history: Array<{ role: string; content: string }>;
    user_tier: string;
    context_tokens?: number;
    force_layer?: string;
    rag_context?: string;
  }) => {
    // Reset state
    setState({
      logs: [],
      isActive: true,
      toolsRunning: [],
      toolCount: 0,
      content: '',
      isThinking: false,
      thinkingContent: '',
      isDone: false,
      error: null,
      meta: {},
    });

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Use relative URL to proxy through Next.js API route (avoids CORS/mixed content)
      const response = await fetch(`/api/v1/chat/stream-with-tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'meta':
                setState(s => ({
                  ...s,
                  meta: { ...s.meta, tier: data.tier, layer: data.layer, model: data.model },
                }));
                break;

              case 'tool_start':
                setState(s => ({
                  ...s,
                  toolsRunning: data.tools || [],
                  logs: [...s.logs, { 
                    level: 'info', 
                    message: `🔧 Starting tools: ${(data.tools || []).join(', ')}`,
                    timestamp: Date.now(),
                  }],
                }));
                break;

              case 'tool_log':
                setState(s => ({
                  ...s,
                  logs: [...s.logs, {
                    level: data.level || 'info',
                    message: data.message,
                    icon: data.icon,
                    timestamp: Date.now(),
                  }],
                }));
                break;

              case 'tool_complete':
                setState(s => ({
                  ...s,
                  toolsRunning: [],
                  toolCount: data.count || 0,
                  logs: [...s.logs, {
                    level: 'success',
                    message: `✅ ${data.count || 1} tool(s) completed`,
                    timestamp: Date.now(),
                  }],
                }));
                break;

              case 'thinking_start':
                setState(s => ({ ...s, isThinking: true }));
                break;

              case 'thinking':
                setState(s => ({
                  ...s,
                  thinkingContent: s.thinkingContent + (data.content || ''),
                }));
                break;

              case 'thinking_end':
                setState(s => ({ ...s, isThinking: false }));
                break;

              case 'content':
                accumulatedContent += data.content || '';
                setState(s => ({ ...s, content: accumulatedContent }));
                options.onContent?.(accumulatedContent);
                break;

              case 'done':
                const finalState: ToolStreamingState = {
                  logs: [],
                  isActive: false,
                  toolsRunning: [],
                  toolCount: data.math_tool_count || 0,
                  content: accumulatedContent,
                  isThinking: false,
                  thinkingContent: '',
                  isDone: true,
                  error: null,
                  meta: {
                    tier: data.tier,
                    layer: data.layer,
                    model: data.model,
                    latency: data.latency,
                    mathToolsExecuted: data.math_tools_executed,
                    mathToolCount: data.math_tool_count,
                    cost: data.cost,
                  },
                };
                setState(s => ({ ...s, ...finalState }));
                options.onComplete?.(finalState);
                break;

              case 'error':
                setState(s => ({
                  ...s,
                  isActive: false,
                  error: data.message || 'Unknown error',
                }));
                options.onError?.(data.message || 'Unknown error');
                break;
            }
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      
      const errorMessage = error instanceof Error ? error.message : 'Stream failed';
      setState(s => ({
        ...s,
        isActive: false,
        error: errorMessage,
      }));
      options.onError?.(errorMessage);
    }
  }, [options]);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(s => ({ ...s, isActive: false }));
  }, []);

  const clearLogs = useCallback(() => {
    setState(s => ({ ...s, logs: [], toolCount: 0, toolsRunning: [] }));
  }, []);

  return {
    ...state,
    startStream,
    stopStream,
    clearLogs,
  };
}

export default useToolStreaming;
