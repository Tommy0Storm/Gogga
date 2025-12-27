/**
 * VideoProgress Component
 * 
 * Shows video generation progress with polling.
 * Includes "Run in Background" option.
 * 
 * FIXED: Added proper cleanup, retry mechanism, timeout handling,
 * and mounted state tracking to prevent crashes.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Clock, CheckCircle2, XCircle, Minimize2, Maximize2, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  type VideoResponse,
  type VideoJobStatus,
  getVideoStatus,
} from '../shared';

interface VideoProgressProps {
  /** Initial response from video generation */
  initialResponse: VideoResponse;
  /** Called when video is ready */
  onComplete: (response: VideoResponse) => void;
  /** Called if generation fails */
  onError: (error: string) => void;
  /** Called when user wants to run in background */
  onRunInBackground?: () => void;
  /** Polling interval in ms */
  pollInterval?: number;
  /** Maximum time to wait before showing timeout warning (default: 10 minutes) */
  maxWaitTime?: number;
}

// Constants for retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const DEFAULT_MAX_WAIT_TIME = 10 * 60; // 10 minutes in seconds

const STATUS_CONFIG: Record<VideoJobStatus, {
  icon: typeof Loader2;
  label: string;
  color: string;
}> = {
  pending: { icon: Clock, label: 'Queued', color: 'text-yellow-500' },
  running: { icon: Loader2, label: 'Generating', color: 'text-blue-500' },
  completed: { icon: CheckCircle2, label: 'Complete', color: 'text-green-500' },
  failed: { icon: XCircle, label: 'Failed', color: 'text-red-500' },
};

export function VideoProgress({
  initialResponse,
  onComplete,
  onError,
  onRunInBackground,
  pollInterval = 3000,
  maxWaitTime = DEFAULT_MAX_WAIT_TIME,
}: VideoProgressProps) {
  const [response, setResponse] = useState(initialResponse);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(Date.now());
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { status, job_id, meta } = response;
  const progress = meta?.progress_percent || 0;
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);
  
  // Poll for status updates with retry logic
  const pollStatus = useCallback(async (retry = 0) => {
    if (!job_id || !isMountedRef.current) return;
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const newResponse = await getVideoStatus(job_id);
      
      // Check if still mounted before updating state
      if (!isMountedRef.current) return;
      
      // Clear any previous error on successful poll
      setPollError(null);
      setRetryCount(0);
      setResponse(newResponse);
      
      if (newResponse.status === 'completed') {
        onComplete(newResponse);
        return;
      }
      
      if (newResponse.status === 'failed') {
        onError(newResponse.error || 'Video generation failed');
        return;
      }
      
      // Continue polling if still mounted
      if (isMountedRef.current) {
        pollTimeoutRef.current = setTimeout(() => pollStatus(0), pollInterval);
      }
      
    } catch (err) {
      // Don't handle errors if unmounted
      if (!isMountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to check status';
      
      // Retry logic for transient errors
      if (retry < MAX_RETRIES) {
        console.warn(`[VideoProgress] Poll failed, retrying (${retry + 1}/${MAX_RETRIES}):`, errorMessage);
        setRetryCount(retry + 1);
        setPollError(`Connection issue, retrying... (${retry + 1}/${MAX_RETRIES})`);
        
        if (isMountedRef.current) {
          pollTimeoutRef.current = setTimeout(() => pollStatus(retry + 1), RETRY_DELAY_MS);
        }
      } else {
        // Max retries reached - show error but allow manual retry
        setPollError(`Unable to check status: ${errorMessage}`);
        setRetryCount(MAX_RETRIES);
        console.error('[VideoProgress] Max retries reached:', errorMessage);
      }
    }
  }, [job_id, onComplete, onError, pollInterval]);
  
  // Manual retry function
  const handleManualRetry = useCallback(() => {
    setPollError(null);
    setRetryCount(0);
    pollStatus(0);
  }, [pollStatus]);
  
  // Start polling
  useEffect(() => {
    if (status === 'pending' || status === 'running') {
      pollTimeoutRef.current = setTimeout(() => pollStatus(0), pollInterval);
    }
    
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [status, pollStatus, pollInterval]);
  
  // Track elapsed time and check for timeout
  useEffect(() => {
    if (status === 'completed' || status === 'failed') return;
    
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
      
      // Check for timeout
      if (elapsed >= maxWaitTime && !isTimedOut) {
        setIsTimedOut(true);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [status, maxWaitTime, isTimedOut]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const StatusIcon = STATUS_CONFIG[status]?.icon || Loader2;
  const statusLabel = STATUS_CONFIG[status]?.label || 'Processing';
  const statusColor = STATUS_CONFIG[status]?.color || 'text-blue-500';
  
  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white 
                    rounded-full shadow-lg z-50">
        <StatusIcon className={`w-4 h-4 ${status === 'running' ? 'animate-spin' : ''} ${statusColor}`} />
        <span className="text-sm">{statusLabel}</span>
        {progress > 0 && <span className="text-xs text-neutral-400">{progress}%</span>}
        {pollError && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1 hover:bg-neutral-800 rounded"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 
                  p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 ${statusColor}`}>
            <StatusIcon className={`w-5 h-5 ${status === 'running' ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="font-medium text-neutral-900 dark:text-white">
              {statusLabel}
            </h3>
            <p className="text-xs text-neutral-500">
              {response.prompt?.slice(0, 50) || 'Generating video'}...
            </p>
          </div>
        </div>
        {status === 'running' && (
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4 text-neutral-500" />
          </button>
        )}
      </div>
      
      {/* Poll error / retry UI */}
      {pollError && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 
                      dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{pollError}</p>
              {retryCount >= MAX_RETRIES && (
                <button
                  onClick={handleManualRetry}
                  className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 
                           text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Timeout warning */}
      {isTimedOut && status !== 'completed' && status !== 'failed' && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 
                      dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Taking longer than expected
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Video generation is still in progress. This occasionally happens with complex prompts.
                You can continue waiting or try again later.
              </p>
              <button
                onClick={() => onError('Generation cancelled by user - taking too long')}
                className="mt-2 px-3 py-1.5 border border-amber-300 dark:border-amber-700 
                         text-amber-700 dark:text-amber-300 text-sm rounded-lg 
                         hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                Cancel & Start Over
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Progress bar */}
      <div className="space-y-2 mb-4">
        <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'completed' ? 'bg-green-500' :
              status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${status === 'completed' ? 100 : progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-neutral-500">
          <span>{progress}% complete</span>
          <span>Elapsed: {formatTime(elapsedSeconds)}</span>
        </div>
      </div>
      
      {/* Status details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-neutral-500">Duration</div>
          <div className="font-medium text-neutral-900 dark:text-white">
            {response.duration_seconds || 5}s
          </div>
        </div>
        <div>
          <div className="text-neutral-500">Est. Cost</div>
          <div className="font-medium text-neutral-900 dark:text-white">
            R{meta?.estimated_cost_zar?.toFixed(2) || '-'}
          </div>
        </div>
      </div>
      
      {/* Background option */}
      {status === 'running' && onRunInBackground && (
        <button
          onClick={onRunInBackground}
          className="w-full mt-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 
                   dark:text-neutral-300 text-sm rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 
                   transition-colors"
        >
          Run in Background
        </button>
      )}
      
      {/* Tips while waiting */}
      {status === 'running' && !isTimedOut && !pollError && (
        <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
          <p className="text-xs text-neutral-500">
            💡 Video generation typically takes 2-5 minutes depending on complexity and duration.
          </p>
        </div>
      )}
    </div>
  );
}

export default VideoProgress;
