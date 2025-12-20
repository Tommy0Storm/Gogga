/**
 * VideoProgress Component
 * 
 * Shows video generation progress with polling.
 * Includes "Run in Background" option.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Clock, CheckCircle2, XCircle, Minimize2, Maximize2 } from 'lucide-react';
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
}

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
}: VideoProgressProps) {
  const [response, setResponse] = useState(initialResponse);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(Date.now());
  
  const { status, job_id, meta } = response;
  const progress = meta?.progress_percent || 0;
  
  // Poll for status updates
  const pollStatus = useCallback(async () => {
    if (!job_id) return;
    
    try {
      const newResponse = await getVideoStatus(job_id);
      setResponse(newResponse);
      
      if (newResponse.status === 'completed') {
        onComplete(newResponse);
        return;
      }
      
      if (newResponse.status === 'failed') {
        onError(newResponse.error || 'Video generation failed');
        return;
      }
      
      // Continue polling
      pollTimeoutRef.current = setTimeout(pollStatus, pollInterval);
      
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to check status');
    }
  }, [job_id, onComplete, onError, pollInterval]);
  
  // Start polling
  useEffect(() => {
    if (status === 'pending' || status === 'running') {
      pollTimeoutRef.current = setTimeout(pollStatus, pollInterval);
    }
    
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [status, pollStatus, pollInterval]);
  
  // Track elapsed time
  useEffect(() => {
    if (status === 'completed' || status === 'failed') return;
    
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [status]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const StatusIcon = STATUS_CONFIG[status].icon;
  const statusLabel = STATUS_CONFIG[status].label;
  const statusColor = STATUS_CONFIG[status].color;
  
  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white 
                    rounded-full shadow-lg z-50">
        <StatusIcon className={`w-4 h-4 ${status === 'running' ? 'animate-spin' : ''} ${statusColor}`} />
        <span className="text-sm">{statusLabel}</span>
        {progress > 0 && <span className="text-xs text-neutral-400">{progress}%</span>}
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
              {response.prompt.slice(0, 50)}...
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
            {response.duration_seconds}s
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
      {status === 'running' && (
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
