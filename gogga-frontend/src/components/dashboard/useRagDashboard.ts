/**
 * GOGGA RAG Dashboard - Custom Hook
 * Provides real-time data for the RAG monitoring dashboard
 * 
 * Features:
 * - Real-time metrics subscription
 * - Dexie storage stats
 * cSpell:ignore Dexie
 * - Embedding engine status
 * - Auto-refresh with configurable interval
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  db, 
  getStorageStats, 
  getStorageUsageBreakdown,
  getAllDocuments,
  getTodayTokenUsage,
  RAG_LIMITS,
  type Document 
} from '@/lib/db';
import { removeDocument as ragRemoveDocument } from '@/lib/rag';
import {
  subscribeToMetrics,
  getRecentMetrics,
  getAggregatedMetrics,
  getTimeSeriesMetrics,
  getModeStats,
  getModeStatsForPeriod,
  getScoreDistribution,
  getBufferStats,
  type Metric,
} from '@/lib/ragMetrics';
import { ragManager } from '@/lib/ragManager';
// Note: EmbeddingEngine is dynamically imported to avoid SSR issues with transformers.js
import type {
  DexieStorageStats,
  ModelStatus,
  EmbeddingStats,
  RetrievalStats,
  ContextDocument,
  LatencyChartData,
  DashboardFilters,
  DashboardState,
  BrowserPerformance,
  BrowserPerformanceHistory,
} from './types';

// Vector data type for dashboard
export interface VectorData {
  vectors: number[][];
  labels: string[];
  docIds: number[];
  isReal: boolean;
}

// ============================================================================
// Hook Configuration
// ============================================================================

const DEFAULT_REFRESH_INTERVAL = 5000; // 5 seconds
const CHART_HISTORY_PERIODS = 60; // 5 minutes at 5-second intervals

// ============================================================================
// Main Dashboard Hook
// ============================================================================

export function useRagDashboard(initialFilters?: Partial<DashboardFilters>) {
  // Filters
  const [filters, setFilters] = useState<DashboardFilters>({
    timeRange: '1h',
    metricType: 'all',
    tier: 'all',
    ...initialFilters,
  });

  // Dashboard state
  const [state, setState] = useState<DashboardState>({
    isLoading: true,
    error: null,
    lastUpdated: null,
    refreshIntervalMs: DEFAULT_REFRESH_INTERVAL,
    isAutoRefresh: true,
  });

  // Data states
  const [storageStats, setStorageStats] = useState<DexieStorageStats | null>(
    null
  );
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(
    null
  );
  const [retrievalStats, setRetrievalStats] = useState<RetrievalStats | null>(
    null
  );
  const [documents, setDocuments] = useState<ContextDocument[]>([]);
  const [recentMetrics, setRecentMetrics] = useState<Metric[]>([]);
  const [latencyChartData, setLatencyChartData] = useState<LatencyChartData[]>(
    []
  );
  const [tokenUsage, setTokenUsage] = useState<{
    totalTokens: number;
    costZar: number;
  }>({ totalTokens: 0, costZar: 0 });
  const [vectorData, setVectorData] = useState<VectorData>({
    vectors: [],
    labels: [],
    docIds: [],
    isReal: false,
  });

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Data Fetching Functions
  // ============================================================================

  const fetchStorageStats =
    useCallback(async (): Promise<DexieStorageStats> => {
      const [basic, breakdown] = await Promise.all([
        getStorageStats(),
        getStorageUsageBreakdown(),
      ]);

      return {
        documents: basic.documents,
        chunks: basic.chunks,
        messages: basic.messages,
        images: basic.images,
        totalSizeBytes: breakdown.totalBytes,
        totalSizeMB: breakdown.totalMB,
        usedPercent: breakdown.usedPercent,
        remainingMB: breakdown.remainingMB,
        tables: [
          {
            name: 'Documents',
            count: basic.documents,
            estimatedSizeBytes: breakdown.totalBytes * 0.6,
          },
          {
            name: 'Chunks',
            count: basic.chunks,
            estimatedSizeBytes: breakdown.totalBytes * 0.3,
          },
          {
            name: 'Messages',
            count: basic.messages,
            estimatedSizeBytes: breakdown.totalBytes * 0.05,
          },
          {
            name: 'Images',
            count: basic.images,
            estimatedSizeBytes: breakdown.totalBytes * 0.05,
          },
        ],
      };
    }, []);

  const fetchModelStatus = useCallback(async (): Promise<ModelStatus> => {
    // Check actual model status based on RagManager state and embedding activity
    let backend: ModelStatus['backend'] = 'wasm';
    let loaded = false;
    let loadTimeMs: number | undefined;

    // Check if we're in browser
    if (typeof window !== 'undefined') {
      try {
        // Primary check: Is RagManager initialized and ready?
        const ragReady = ragManager.isReady();
        const hasEmbeddings = ragManager.hasEmbeddings();

        // Check metrics for embedding activity
        const embeddingMetrics = getRecentMetrics({
          type: 'embedding_generated',
        });

        // Model is loaded if RagManager is ready OR has generated embeddings
        if (ragReady || hasEmbeddings || embeddingMetrics.length > 0) {
          loaded = true;
          // Get load time from first embedding metric if available
          if (embeddingMetrics.length > 0) {
            const firstMetric = embeddingMetrics[0];
            loadTimeMs = firstMetric?.value?.latencyMs;
          }
        }

        // Check if WebGPU is available and working
        if ('gpu' in navigator && (navigator as any).gpu) {
          try {
            const adapter = await(navigator as any).gpu.requestAdapter();
            if (adapter) {
              backend = 'webgpu';
            }
          } catch {
            // WebGPU not available, stick with WASM
            backend = 'wasm';
          }
        }
      } catch (error) {
        console.error('[Dashboard] Model status check failed:', error);
        backend = 'error';
      }
    }

    return {
      name: 'VCB-AI Micro',
      id: 'vcb-ai/micro-v1',
      dimension: 384,
      backend,
      loaded,
      loadTimeMs,
      lastUsed: loaded ? new Date() : undefined,
      version: '1.0.0',
    };
  }, []);

  const fetchEmbeddingStats = useCallback((): EmbeddingStats => {
    const allEmbeddingMetrics = getRecentMetrics({
      type: 'embedding_generated',
    });
    // Filter to only actual document embeddings (have docId and chunkCount > 0)
    const metrics = allEmbeddingMetrics.filter(
      (m) => m.docId !== undefined && m.value?.chunkCount > 0
    );
    const cacheHits = getRecentMetrics({ type: 'cache_hit' }).length;
    const cacheMisses = getRecentMetrics({ type: 'cache_miss' }).length;
    const errors = getRecentMetrics({ type: 'error' }).filter(
      (m) => m.value?.operation === 'embedding_generation'
    ).length;

    if (metrics.length === 0) {
      return {
        totalEmbeddings: 0,
        avgLatencyMs: 0,
        maxLatencyMs: 0,
        minLatencyMs: 0,
        totalProcessingTimeMs: 0,
        cachHitRate: 0,
        failureRate: 0,
      };
    }

    const latencies = metrics
      .map((m) => m.value?.latencyMs ?? 0)
      .filter((l) => l > 0);
    const totalTime = latencies.reduce((a, b) => a + b, 0);
    const totalChunks = metrics.reduce(
      (sum, m) => sum + (m.value?.chunkCount ?? 0),
      0
    );

    return {
      totalEmbeddings: totalChunks, // Report total chunks embedded, not just documents
      avgLatencyMs: latencies.length > 0 ? totalTime / latencies.length : 0,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
      totalProcessingTimeMs: totalTime,
      cachHitRate:
        cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0,
      failureRate:
        metrics.length + errors > 0 ? errors / (metrics.length + errors) : 0,
    };
  }, []);

  const fetchRetrievalStats = useCallback((): RetrievalStats => {
    const modeStats = getModeStats();
    const agg = getAggregatedMetrics();
    const cacheHits = getRecentMetrics({ type: 'cache_hit' }).length;
    const cacheMisses = getRecentMetrics({ type: 'cache_miss' }).length;

    return {
      totalQueries: modeStats.basic.count + modeStats.semantic.count,
      semanticQueries: modeStats.semantic.count,
      keywordQueries: modeStats.basic.count,
      avgLatencyMs: agg.avgLatencyMs,
      avgScore: modeStats.semantic.avgScore,
      topScore: agg.topScore,
      cacheHits,
      cacheMisses,
      errorCount: agg.errorCount,
    };
  }, []);

  const fetchDocuments = useCallback(async (): Promise<ContextDocument[]> => {
    const docs = await getAllDocuments();
    console.log('[Dashboard] Fetched documents from Dexie:', docs.length);

    // Get cached embedding info from RagManager
    const cachedVectors = ragManager.getCachedVectors();
    const cachedDocIds = new Set(cachedVectors.docIds);

    // Also check embedding metrics for documents that may have been processed
    const embeddingMetrics = getRecentMetrics({ type: 'embedding_generated' });
    const embeddedDocIds = new Set(
      embeddingMetrics
        .filter((m) => m.docId !== undefined && m.value?.chunkCount > 0)
        .map((m) => m.docId!)
    );

    // Check for error metrics (failed embeddings)
    const errorMetrics = getRecentMetrics({ type: 'error' });
    const errorDocIds = new Set(
      errorMetrics
        .filter(
          (m) =>
            m.docId !== undefined &&
            m.value?.operation === 'embedding_generation'
        )
        .map((m) => m.docId!)
    );

    return docs
      .filter((doc: Document) => doc.id !== undefined)
      .map((doc: Document) => {
        const inCache = cachedDocIds.has(doc.id!);
        const hasMetric = embeddedDocIds.has(doc.id!);
        const hasError = errorDocIds.has(doc.id!);
        const hasEmbeddings = inCache || hasMetric;

        // Determine status: complete if embeddings exist, error if failed, pending otherwise
        let embeddingStatus: 'complete' | 'pending' | 'error' | 'none';
        if (hasEmbeddings) {
          embeddingStatus = 'complete';
        } else if (hasError) {
          embeddingStatus = 'error';
        } else {
          embeddingStatus = 'pending';
        }

        return {
          ...doc,
          id: doc.id!,
          hasEmbeddings,
          embeddingStatus,
        };
      });
  }, []);

  const fetchLatencyChartData = useCallback((): LatencyChartData[] => {
    const timeSeries = getTimeSeriesMetrics({
      intervalMs: 5000,
      periods: CHART_HISTORY_PERIODS,
    });

    return timeSeries.map((point) => {
      // Get mode-specific latency for this specific time period
      const periodStart = point.timestamp - 5000;
      const periodModeStats = getModeStatsForPeriod(
        periodStart,
        point.timestamp
      );
      return {
        name: formatTimeLabel(point.timestamp),
        semantic:
          periodModeStats.semantic.avgLatencyMs ||
          point.aggregation.avgLatencyMs,
        keyword: periodModeStats.basic.avgLatencyMs,
        timestamp: point.timestamp,
      };
    });
  }, []);

  // ============================================================================
  // Refresh All Data
  // ============================================================================

  const refreshData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const [storage, model, tokenData, docs] = await Promise.all([
        fetchStorageStats(),
        fetchModelStatus(),
        getTodayTokenUsage(),
        fetchDocuments(),
      ]);

      console.log(
        '[Dashboard] Refresh - docs:',
        docs.length,
        'storage:',
        storage
      );

      const embedding = fetchEmbeddingStats();
      const retrieval = fetchRetrievalStats();
      const chartData = fetchLatencyChartData();
      const recent = getRecentMetrics({ limit: 50 });

      setStorageStats(storage);
      setModelStatus(model);
      setEmbeddingStats(embedding);
      setRetrievalStats(retrieval);
      setDocuments(docs);
      setLatencyChartData(chartData);
      setRecentMetrics(recent);
      setTokenUsage({
        totalTokens: tokenData.totalTokens,
        costZar: tokenData.costZar,
      });

      // Fetch real vector data from RagManager cache
      try {
        const cachedVectors = ragManager.getCachedVectors();
        if (cachedVectors.vectors.length > 0) {
          setVectorData({
            vectors: cachedVectors.vectors,
            labels: cachedVectors.labels,
            docIds: cachedVectors.docIds,
            isReal: true,
          });
        }
      } catch (e) {
        console.debug('[Dashboard] No cached vectors yet');
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      console.error('[Dashboard] Refresh error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : 'Failed to refresh data',
      }));
    }
  }, [
    fetchStorageStats,
    fetchModelStatus,
    fetchDocuments,
    fetchEmbeddingStats,
    fetchRetrievalStats,
    fetchLatencyChartData,
  ]);

  // ============================================================================
  // Auto-refresh Management
  // ============================================================================

  useEffect(() => {
    // Initial load
    refreshData();

    // Subscribe to real-time metrics
    const unsubscribe = subscribeToMetrics((metric: Metric) => {
      setRecentMetrics((prev) => [...prev.slice(-49), metric]);
      // Update stats on new metrics
      setEmbeddingStats(fetchEmbeddingStats());
      setRetrievalStats(fetchRetrievalStats());

      // Refresh document list and storage stats when documents are added or removed
      if (
        metric.value?.event === 'document_added' ||
        metric.value?.event === 'document_removed'
      ) {
        console.log(
          '[Dashboard] Document event detected:',
          metric.value?.event
        );
        fetchDocuments().then(setDocuments);
        fetchStorageStats().then(setStorageStats);
        // Refresh vector data
        try {
          const cachedVectors = ragManager.getCachedVectors();
          if (cachedVectors.vectors.length > 0) {
            setVectorData({
              vectors: cachedVectors.vectors,
              labels: cachedVectors.labels,
              docIds: cachedVectors.docIds,
              isReal: true,
            });
          }
        } catch (e) {
          // No cached vectors yet
        }
      }

      // Refresh vector data on embedding generation
      if (metric.type === 'embedding_generated') {
        try {
          const cachedVectors = ragManager.getCachedVectors();
          if (cachedVectors.vectors.length > 0) {
            setVectorData({
              vectors: cachedVectors.vectors,
              labels: cachedVectors.labels,
              docIds: cachedVectors.docIds,
              isReal: true,
            });
          }
        } catch (e) {
          // No cached vectors yet
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    refreshData,
    fetchEmbeddingStats,
    fetchRetrievalStats,
    fetchDocuments,
    fetchStorageStats,
  ]);

  useEffect(() => {
    if (state.isAutoRefresh) {
      refreshIntervalRef.current = setInterval(
        refreshData,
        state.refreshIntervalMs
      );
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [state.isAutoRefresh, state.refreshIntervalMs, refreshData]);

  // ============================================================================
  // Actions
  // ============================================================================

  const toggleAutoRefresh = useCallback(() => {
    setState((prev) => ({ ...prev, isAutoRefresh: !prev.isAutoRefresh }));
  }, []);

  const setRefreshInterval = useCallback((intervalMs: number) => {
    setState((prev) => ({ ...prev, refreshIntervalMs: intervalMs }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const bufferStats = getBufferStats();

  const healthScore = (() => {
    if (!modelStatus || !retrievalStats) return 0;
    let score = 0;
    if (modelStatus.loaded) score += 40;
    if (modelStatus.backend === 'webgpu') score += 20;
    if (retrievalStats.errorCount === 0) score += 20;
    if (retrievalStats.avgLatencyMs < 100) score += 20;
    else if (retrievalStats.avgLatencyMs < 500) score += 10;
    return score;
  })();

  return {
    // State
    state,
    filters,

    // Data
    storageStats,
    modelStatus,
    embeddingStats,
    retrievalStats,
    documents,
    recentMetrics,
    latencyChartData,
    tokenUsage,
    bufferStats,
    vectorData,
    scoreDistribution: getScoreDistribution(),

    // Computed
    healthScore,

    // Actions
    refreshData,
    toggleAutoRefresh,
    setRefreshInterval,
    updateFilters,

    // Constants
    limits: RAG_LIMITS,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeLabel(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ============================================================================
// Storage Management Hook
// ============================================================================

export function useContextMemory() {
  const [documents, setDocuments] = useState<ContextDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await getAllDocuments();
      setDocuments(
        docs
          .filter((doc: Document) => doc.id !== undefined)
          .map((doc: Document) => ({
            ...doc,
            id: doc.id!,
            hasEmbeddings: false,
            embeddingStatus: 'none' as const,
          }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteDocument = useCallback(async (docId: number) => {
    try {
      // Get the document to find its sessionId
      const doc = documents.find(d => d.id === docId);
      const sessionId = doc?.sessionId || 'default-session';
      
      // Use proper rag removal which handles FlexSearch, Dexie, and metrics
      await ragRemoveDocument(sessionId, docId);
      
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete document'
      );
    }
  }, [documents]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return {
    documents,
    isLoading,
    error,
    loadDocuments,
    deleteDocument,
  };
}

// ============================================================================
// Browser Performance Hook
// ============================================================================

const PERFORMANCE_HISTORY_SIZE = 60; // 5 minutes at 5-second intervals

/**
 * Hook for monitoring browser performance metrics
 * Measures: JS heap, FPS, long tasks, device capabilities
 */
export function useBrowserPerformance(refreshIntervalMs: number = 1000) {
  const [performance, setPerformance] = useState<BrowserPerformance | null>(
    null
  );
  const [history, setHistory] = useState<BrowserPerformanceHistory>({
    timestamps: [],
    fps: [],
    heapUsedPercent: [],
    longTaskCounts: [],
  });

  // Track FPS using requestAnimationFrame
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  const fpsRef = useRef(60);

  // Track long tasks
  const longTasksRef = useRef<{ count: number; totalMs: number }>({
    count: 0,
    totalMs: 0,
  });

  // FPS calculation via requestAnimationFrame
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let animationId: number;

    const measureFps = () => {
      frameCountRef.current++;
      const now = Date.now();
      const elapsed = now - lastFrameTimeRef.current;

      if (elapsed >= 1000) {
        fpsRef.current = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }

      animationId = requestAnimationFrame(measureFps);
    };

    animationId = requestAnimationFrame(measureFps);

    return () => cancelAnimationFrame(animationId);
  }, []);

  // Long task detection via PerformanceObserver
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window))
      return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            // Long task threshold
            longTasksRef.current.count++;
            longTasksRef.current.totalMs += entry.duration;
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });

      return () => observer.disconnect();
    } catch {
      // Long task observation not supported
      return;
    }
  }, []);

  // Periodic measurement
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const measure = () => {
      const now = Date.now();

      // Memory info (Chrome only)
      let jsHeapSizeMB = 0;
      let jsHeapLimitMB = 0;
      let jsHeapUsedPercent = 0;

      const perfMemory = (window.performance as any).memory;
      if (perfMemory) {
        jsHeapSizeMB = perfMemory.usedJSHeapSize / (1024 * 1024);
        jsHeapLimitMB = perfMemory.jsHeapSizeLimit / (1024 * 1024);
        jsHeapUsedPercent =
          (perfMemory.usedJSHeapSize / perfMemory.jsHeapSizeLimit) * 100;
      }

      // Device info
      const deviceMemoryGB = (navigator as any).deviceMemory ?? null;
      const hardwareConcurrency = navigator.hardwareConcurrency ?? 1;

      // Long task stats
      const longTaskCount = longTasksRef.current.count;
      const avgLongTaskMs =
        longTaskCount > 0 ? longTasksRef.current.totalMs / longTaskCount : 0;

      const perf: BrowserPerformance = {
        jsHeapSizeMB,
        jsHeapLimitMB,
        jsHeapUsedPercent,
        fps: fpsRef.current,
        longTaskCount,
        avgLongTaskMs,
        deviceMemoryGB,
        hardwareConcurrency,
        timestamp: now,
      };

      setPerformance(perf);

      // Update history
      setHistory((prev) => {
        const newTimestamps = [...prev.timestamps, now].slice(
          -PERFORMANCE_HISTORY_SIZE
        );
        const newFps = [...prev.fps, fpsRef.current].slice(
          -PERFORMANCE_HISTORY_SIZE
        );
        const newHeap = [...prev.heapUsedPercent, jsHeapUsedPercent].slice(
          -PERFORMANCE_HISTORY_SIZE
        );
        const newLongTasks = [...prev.longTaskCounts, longTaskCount].slice(
          -PERFORMANCE_HISTORY_SIZE
        );

        return {
          timestamps: newTimestamps,
          fps: newFps,
          heapUsedPercent: newHeap,
          longTaskCounts: newLongTasks,
        };
      });

      // Reset long task counter for next period
      longTasksRef.current = { count: 0, totalMs: 0 };
    };

    measure(); // Initial measurement
    const interval = setInterval(measure, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [refreshIntervalMs]);

  return { performance, history };
}

export default useRagDashboard;
