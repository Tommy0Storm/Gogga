'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface LiveTerminalProps {
  service: string;
  onClose?: () => void;
}

export default function LiveTerminal({ service, onClose }: LiveTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLineRef = useRef<string>('');

  const fetchLogs = useCallback(async () => {
    if (isPaused || !terminalInstance.current) return;

    try {
      const res = await fetch(`/api/terminal/${service}/stream?lines=4000`);
      const data = await res.json();
      
      if (data.content) {
        const lines = data.content.split('\n');
        // Only write new lines (avoid duplicates)
        const newContent = data.content;
        if (newContent !== lastLineRef.current) {
          // Clear and rewrite to avoid duplication on refresh
          terminalInstance.current.clear();
          terminalInstance.current.write(newContent.replace(/\n/g, '\r\n'));
          lastLineRef.current = newContent;
        }
      }
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setIsConnected(false);
    }
  }, [service, isPaused]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Wait for next tick to ensure DOM is ready
    const initTimeout = setTimeout(() => {
      if (!terminalRef.current) return;

      // Initialize terminal
      const term = new Terminal({
        theme: {
          background: '#0a0a0a',
          foreground: '#22c55e', // Green text
          cursor: '#22c55e',
          cursorAccent: '#0a0a0a',
          selectionBackground: '#333333',
        },
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 4000,
        convertEol: true,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(terminalRef.current);
      
      // Delay fit to ensure container has dimensions
      requestAnimationFrame(() => {
        try {
          fit.fit();
        } catch (e) {
          console.warn('Terminal fit failed, will retry on resize');
        }
      });

      terminalInstance.current = term;
      fitAddon.current = fit;

      // Write welcome message
      term.writeln(`\x1b[1;36m╔════════════════════════════════════════╗\x1b[0m`);
      term.writeln(`\x1b[1;36m║\x1b[0m  \x1b[1;32mGOGGA Live Terminal\x1b[0m - ${service.toUpperCase()}  \x1b[1;36m║\x1b[0m`);
      term.writeln(`\x1b[1;36m╚════════════════════════════════════════╝\x1b[0m`);
      term.writeln('');
      term.writeln('\x1b[90mConnecting to service logs...\x1b[0m');
      term.writeln('');

      // Initial fetch
      fetchLogs();

      // Start polling for updates
      intervalRef.current = setInterval(fetchLogs, 2000);
    }, 100);

    // Handle resize
    const handleResize = () => {
      if (fitAddon.current) {
        try {
          fitAddon.current.fit();
        } catch (e) {
          // Ignore fit errors during resize
        }
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(initTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('resize', handleResize);
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
      }
    };
  }, [service, fetchLogs]);

  const handleClear = () => {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
      lastLineRef.current = '';
    }
  };

  const handleRefresh = () => {
    lastLineRef.current = '';
    fetchLogs();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Terminal toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#333]">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400 font-mono">
            {service} {isPaused ? '(paused)' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1 text-xs rounded ${
              isPaused 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
          >
            Clear
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
          >
            Refresh
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs bg-red-700 text-white rounded hover:bg-red-600"
            >
              Close
            </button>
          )}
        </div>
      </div>
      
      {/* Terminal container */}
      <div 
        ref={terminalRef} 
        className="flex-1 bg-[#0a0a0a] p-2 overflow-hidden"
        style={{ minHeight: '300px' }}
      />
    </div>
  );
}
