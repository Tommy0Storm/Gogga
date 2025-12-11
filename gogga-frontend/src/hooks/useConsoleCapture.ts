'use client';

import { useEffect, useRef, useCallback } from 'react';

interface LogEntry {
    type: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    timestamp: string;
    stack?: string;
}

interface NetworkEntry {
    url: string;
    method: string;
    status: number;
    duration: number;
    error?: string;
    timestamp: string;
}

const MAX_LOGS = 100;
const MAX_NETWORK = 50;

/**
 * Hook to capture browser console logs and failed network requests
 * for debug reporting by tester users.
 */
export function useConsoleCapture() {
    const consoleLogs = useRef<LogEntry[]>([]);
    const networkLogs = useRef<NetworkEntry[]>([]);
    const lastError = useRef<string | null>(null);

    useEffect(() => {
        // Store original console methods
        const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug,
        };

        // Intercept console methods
        const intercept = (type: LogEntry['type']) => {
            return (...args: unknown[]) => {
                const message = args
                    .map((arg) =>
                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    )
                    .join(' ');

                const entry: LogEntry = {
                    type,
                    message: message.slice(0, 2000), // Limit message size
                    timestamp: new Date().toISOString(),
                };

                if (type === 'error' && args[0] instanceof Error) {
                    entry.stack = (args[0] as Error).stack;
                    lastError.current = entry.stack || message;
                }

                consoleLogs.current.push(entry);
                if (consoleLogs.current.length > MAX_LOGS) {
                    consoleLogs.current.shift();
                }

                // Call original
                originalConsole[type](...args);
            };
        };

        console.log = intercept('log');
        console.warn = intercept('warn');
        console.error = intercept('error');
        console.info = intercept('info');
        console.debug = intercept('debug');

        // Intercept fetch for network errors
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const start = Date.now();
            const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
            const method = ((args[1]?.method || 'GET') as string).toUpperCase();

            try {
                const response = await originalFetch(...args);

                // Only log failed requests (4xx/5xx)
                if (!response.ok) {
                    networkLogs.current.push({
                        url,
                        method,
                        status: response.status,
                        duration: Date.now() - start,
                        timestamp: new Date().toISOString(),
                    });
                    if (networkLogs.current.length > MAX_NETWORK) {
                        networkLogs.current.shift();
                    }
                }

                return response;
            } catch (error) {
                // Network errors (failed to fetch, CORS, etc.)
                networkLogs.current.push({
                    url,
                    method,
                    status: 0,
                    duration: Date.now() - start,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString(),
                });
                if (networkLogs.current.length > MAX_NETWORK) {
                    networkLogs.current.shift();
                }
                throw error;
            }
        };

        // Capture unhandled errors
        const errorHandler = (event: ErrorEvent) => {
            lastError.current = event.error?.stack || event.message;
            consoleLogs.current.push({
                type: 'error',
                message: event.message,
                stack: event.error?.stack,
                timestamp: new Date().toISOString(),
            });
        };

        // Capture unhandled promise rejections
        const rejectionHandler = (event: PromiseRejectionEvent) => {
            const message = event.reason?.message || String(event.reason);
            lastError.current = event.reason?.stack || message;
            consoleLogs.current.push({
                type: 'error',
                message: `Unhandled Promise Rejection: ${message}`,
                stack: event.reason?.stack,
                timestamp: new Date().toISOString(),
            });
        };

        window.addEventListener('error', errorHandler);
        window.addEventListener('unhandledrejection', rejectionHandler);

        // Cleanup on unmount
        return () => {
            console.log = originalConsole.log;
            console.warn = originalConsole.warn;
            console.error = originalConsole.error;
            console.info = originalConsole.info;
            console.debug = originalConsole.debug;
            window.fetch = originalFetch;
            window.removeEventListener('error', errorHandler);
            window.removeEventListener('unhandledrejection', rejectionHandler);
        };
    }, []);

    const getCapture = useCallback(() => ({
        consoleLogs: [...consoleLogs.current],
        networkLogs: [...networkLogs.current],
        lastError: lastError.current,
    }), []);

    const clearCapture = useCallback(() => {
        consoleLogs.current = [];
        networkLogs.current = [];
        lastError.current = null;
    }, []);

    return { getCapture, clearCapture };
}
