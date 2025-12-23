/**
 * GOGGA RxDB Monitoring React Hooks
 * 
 * React hooks that leverage RxJS observables for real-time database monitoring.
 * Uses proper subscription cleanup and optimized re-render patterns.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Subscription } from 'rxjs';

import {
  createStorageStatsObservable,
  createVectorStatsObservable,
  createPipelineObservable,
  createHealthObservable,
  createRealTimeMetricsObservable,
  getSearchHistoryObservable,
  getSearchPerformanceObservable,
  trackVectorSearch,
  subscribeWithCleanup,
  type UnifiedStorageStats,
  type VectorMonitoringState,
  type PipelineMonitoringState,
  type DatabaseHealth,
  type RealTimeMetrics,
  type VectorSearchResult,
} from './unifiedMonitoring';

// ============================================================================
// Unified Storage Stats Hook
// ============================================================================

export interface UseUnifiedStorageReturn {
  stats: UnifiedStorageStats | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for unified RxDB + Dexie storage statistics
 * Auto-refreshes at specified interval
 */
export function useUnifiedStorage(refreshInterval = 5000): UseUnifiedStorageReturn {
  const [stats, setStats] = useState<UnifiedStorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let mounted = true;
    
    const observable$ = createStorageStatsObservable(refreshInterval);
    
    const cleanup = subscribeWithCleanup(
      observable$,
      (value) => {
        if (mounted) {
          setStats(value);
          setIsLoading(false);
          setError(null);
        }
      },
      (err) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      cleanup();
    };
  }, [refreshInterval]);

  const refresh = useCallback(() => {
    setIsLoading(true);
  }, []);

  return { stats, isLoading, error, refresh };
}

// ============================================================================
// Vector Monitoring Hook
// ============================================================================

export interface UseVectorMonitoringReturn {
  state: VectorMonitoringState | null;
  isLoading: boolean;
  trackSearch: (result: VectorSearchResult) => void;
  searchHistory: VectorSearchResult[];
  performance: {
    averageLatency: number;
    p95Latency: number;
    totalSearches: number;
    searchesPerMinute: number;
  };
}

/**
 * Hook for vector database monitoring with search tracking
 */
export function useVectorMonitoring(refreshInterval = 10000): UseVectorMonitoringReturn {
  const [state, setState] = useState<VectorMonitoringState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchHistory, setSearchHistory] = useState<VectorSearchResult[]>([]);
  const [performance, setPerformance] = useState({
    averageLatency: 0,
    p95Latency: 0,
    totalSearches: 0,
    searchesPerMinute: 0,
  });

  useEffect(() => {
    let mounted = true;
    const subscriptions: (() => void)[] = [];

    // Subscribe to vector stats
    subscriptions.push(
      subscribeWithCleanup(
        createVectorStatsObservable(refreshInterval),
        (value) => {
          if (mounted) {
            setState(value);
            setIsLoading(false);
          }
        }
      )
    );

    // Subscribe to search history
    subscriptions.push(
      subscribeWithCleanup(
        getSearchHistoryObservable(),
        (history) => {
          if (mounted) {
            setSearchHistory(history);
          }
        }
      )
    );

    // Subscribe to performance metrics
    subscriptions.push(
      subscribeWithCleanup(
        getSearchPerformanceObservable(),
        (perf) => {
          if (mounted) {
            setPerformance(perf);
          }
        }
      )
    );

    return () => {
      mounted = false;
      subscriptions.forEach(unsub => unsub());
    };
  }, [refreshInterval]);

  return {
    state,
    isLoading,
    trackSearch: trackVectorSearch,
    searchHistory,
    performance,
  };
}

// ============================================================================
// Pipeline Monitoring Hook
// ============================================================================

export interface UsePipelineMonitoringReturn {
  state: PipelineMonitoringState;
  isRunning: boolean;
  progress: number; // 0-100
  eta: string | null; // Formatted ETA
}

/**
 * Hook for embedding pipeline monitoring with live updates
 */
export function usePipelineMonitoring(): UsePipelineMonitoringReturn {
  const [state, setState] = useState<PipelineMonitoringState>({
    isRunning: false,
    pending: 0,
    processing: 0,
    completed: 0,
    errors: 0,
    lastError: null,
    throughput: 0,
    estimatedTimeRemaining: null,
  });

  useEffect(() => {
    let mounted = true;

    const cleanup = subscribeWithCleanup(
      createPipelineObservable(),
      (value) => {
        if (mounted) {
          setState(value);
        }
      }
    );

    return () => {
      mounted = false;
      cleanup();
    };
  }, []);

  // Calculate progress percentage
  const progress = useMemo(() => {
    const total = state.pending + state.processing + state.completed;
    if (total === 0) return 100;
    return Math.round((state.completed / total) * 100);
  }, [state.pending, state.processing, state.completed]);

  // Format ETA
  const eta = useMemo(() => {
    if (state.estimatedTimeRemaining === null || state.estimatedTimeRemaining <= 0) {
      return null;
    }
    const seconds = Math.round(state.estimatedTimeRemaining);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }, [state.estimatedTimeRemaining]);

  return {
    state,
    isRunning: state.isRunning,
    progress,
    eta,
  };
}

// ============================================================================
// Database Health Hook
// ============================================================================

export interface UseDatabaseHealthReturn {
  health: DatabaseHealth | null;
  isHealthy: boolean;
  issues: string[];
  lastCheck: Date | null;
}

/**
 * Hook for database health monitoring
 */
export function useDatabaseHealth(checkInterval = 15000): UseDatabaseHealthReturn {
  const [health, setHealth] = useState<DatabaseHealth | null>(null);

  useEffect(() => {
    let mounted = true;

    const cleanup = subscribeWithCleanup(
      createHealthObservable(checkInterval),
      (value) => {
        if (mounted) {
          setHealth(value);
        }
      }
    );

    return () => {
      mounted = false;
      cleanup();
    };
  }, [checkInterval]);

  return {
    health,
    isHealthy: health?.status === 'healthy',
    issues: health?.issues || [],
    lastCheck: health?.lastHealthCheck ? new Date(health.lastHealthCheck) : null,
  };
}

// ============================================================================
// Real-Time Metrics Hook (Combined)
// ============================================================================

export interface UseRealTimeMetricsReturn {
  metrics: RealTimeMetrics | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  storage: UnifiedStorageStats | null;
  vectors: VectorMonitoringState | null;
  pipeline: PipelineMonitoringState | null;
  health: DatabaseHealth | null;
}

/**
 * Combined hook for all real-time database metrics
 * Use this for comprehensive dashboard views
 */
export function useRealTimeMetrics(config?: {
  storageInterval?: number;
  vectorInterval?: number;
  healthInterval?: number;
}): UseRealTimeMetricsReturn {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const cleanup = subscribeWithCleanup(
      createRealTimeMetricsObservable(config),
      (value) => {
        if (mounted) {
          setMetrics(value);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      cleanup();
    };
  }, [config?.storageInterval, config?.vectorInterval, config?.healthInterval]);

  return {
    metrics,
    isLoading,
    lastUpdated: metrics?.timestamp ? new Date(metrics.timestamp) : null,
    storage: metrics?.storage || null,
    vectors: metrics?.vectors || null,
    pipeline: metrics?.pipeline || null,
    health: metrics?.health || null,
  };
}

// ============================================================================
// Animation Helpers for Vector Visualization
// ============================================================================

export interface VectorAnimationState {
  frame: number;
  isAnimating: boolean;
  speed: number;
}

/**
 * Hook for vector animation frame management
 * Provides smooth animation loop for vector visualizations
 */
export function useVectorAnimation(fps = 30): VectorAnimationState & {
  start: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
} {
  const [frame, setFrame] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    const frameTime = 1000 / (fps * speed);
    
    if (time - lastTimeRef.current >= frameTime) {
      setFrame(f => (f + 1) % 360);
      lastTimeRef.current = time;
    }
    
    rafRef.current = requestAnimationFrame(animate);
  }, [fps, speed]);

  const start = useCallback(() => {
    if (!isAnimating) {
      setIsAnimating(true);
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [isAnimating, animate]);

  const stop = useCallback(() => {
    setIsAnimating(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { frame, isAnimating, speed, start, stop, setSpeed };
}

/**
 * Hook for similarity wave animation
 * Creates a pulsing effect based on similarity scores
 */
export function useSimilarityWave(
  similarities: number[],
  config: { duration?: number; staggerDelay?: number } = {}
): {
  scales: number[];
  opacities: number[];
  isAnimating: boolean;
  trigger: () => void;
} {
  const { duration = 1000, staggerDelay = 100 } = config;
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    const elapsed = time - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    setAnimationProgress(progress);

    if (progress < 1) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      setIsAnimating(false);
    }
  }, [duration]);

  const trigger = useCallback(() => {
    setIsAnimating(true);
    setAnimationProgress(0);
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Calculate scales and opacities based on animation progress
  const scales = useMemo(() => {
    if (!isAnimating) return similarities.map(() => 1);
    
    return similarities.map((similarity, index) => {
      const staggerOffset = (index * staggerDelay) / duration;
      const localProgress = Math.max(0, Math.min(1, animationProgress - staggerOffset));
      
      // Ease out bounce effect
      const eased = 1 - Math.pow(1 - localProgress, 3);
      const bounceScale = 1 + (similarity * 0.3 * (1 - Math.abs(eased - 0.5) * 2));
      
      return bounceScale;
    });
  }, [similarities, isAnimating, animationProgress, staggerDelay, duration]);

  const opacities = useMemo(() => {
    if (!isAnimating) return similarities.map(() => 1);
    
    return similarities.map((similarity, index) => {
      const staggerOffset = (index * staggerDelay) / duration;
      const localProgress = Math.max(0, Math.min(1, animationProgress - staggerOffset));
      
      // Pulse opacity based on similarity
      return 0.5 + (similarity * 0.5 * Math.sin(localProgress * Math.PI));
    });
  }, [similarities, isAnimating, animationProgress, staggerDelay, duration]);

  return { scales, opacities, isAnimating, trigger };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  UnifiedStorageStats,
  VectorMonitoringState,
  PipelineMonitoringState,
  DatabaseHealth,
  RealTimeMetrics,
  VectorSearchResult,
} from './unifiedMonitoring';
