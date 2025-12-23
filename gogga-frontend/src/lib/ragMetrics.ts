/**
 * GOGGA RAG Metrics System
 * Dexie-persisted metrics collection for JIGGA tier analytics
 * 
 * Features:
 * - Event emission for retrieval operations
 * - Dexie persistence (survives page navigation, 3-day retention)
 * - Rolling buffer for recent metrics
 * - Aggregation utilities for dashboards
 * - Performance monitoring
 */

import { saveRagMetric, getRecentRagMetrics, runRetentionCleanup } from './db';

// Metric types
export type MetricType = 
  | 'retrieval'
  | 'embedding_generated'
  | 'query'
  | 'cache_hit'
  | 'cache_miss'
  | 'error';

// Base metric structure
export interface Metric {
  id: string;
  type: MetricType;
  timestamp: number;
  sessionId?: string;
  docId?: string;
  value: Record<string, any>;
}

// Aggregated statistics
export interface MetricAggregation {
  count: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  avgScore: number;
  topScore: number;
  totalChunksRetrieved: number;
  errorCount: number;
  periodStartMs: number;
  periodEndMs: number;
}

// Configuration
const CONFIG = {
  MAX_BUFFER_SIZE: 5000,
  AGGREGATION_WINDOW_MS: 60000, // 1 minute windows
} as const;

// ============================================================================
// Dexie Persistence (survives page navigation, 3-day retention)
// ============================================================================

// In-memory buffer for fast access + will be synced with Dexie
let metricsBuffer: Metric[] = [];
let metricIdCounter = 0;
let isInitialized = false;

/**
 * Initialize metrics from Dexie (call once on app load)
 */
async function initializeFromDexie(): Promise<void> {
  if (isInitialized || typeof window === 'undefined') return;
  
  try {
    // Run retention cleanup on startup
    await runRetentionCleanup();
    
    // Load recent metrics from Dexie (last 3 days, limited to buffer size)
    const storedMetrics = await getRecentRagMetrics({ limit: CONFIG.MAX_BUFFER_SIZE });
    
    // Convert RagMetric to Metric format
    metricsBuffer = storedMetrics.map(rm => ({
      id: rm.metricId,
      type: rm.type,
      timestamp: rm.timestamp,
      sessionId: rm.sessionId,
      docId: rm.docId,
      value: rm.value as Record<string, any>,
    }));
    
    metricIdCounter = metricsBuffer.length;
    isInitialized = true;
    
    console.log(`[RAGMetrics] Initialized from Dexie: ${metricsBuffer.length} metrics loaded`);
  } catch (e) {
    console.error('[RAGMetrics] Failed to load from Dexie:', e);
    isInitialized = true; // Continue with empty buffer
  }
}

/**
 * Save a metric to Dexie (async, non-blocking)
 */
async function persistMetricToDexie(metric: Metric): Promise<void> {
  try {
    await saveRagMetric({
      metricId: metric.id,
      type: metric.type,
      timestamp: metric.timestamp,
      sessionId: metric.sessionId,
      docId: metric.docId,
      value: metric.value,
    });
  } catch (e) {
    console.error('[RAGMetrics] Failed to persist to Dexie:', e);
  }
}

// Initialize on first import (client-side only)
if (typeof window !== 'undefined') {
  initializeFromDexie();
}

// Event listeners for real-time updates
type MetricListener = (metric: Metric) => void;
const listeners: Set<MetricListener> = new Set();

/**
 * Generate unique metric ID
 */
function generateMetricId(): string {
  return `m_${Date.now()}_${++metricIdCounter}`;
}

// BroadcastChannel for cross-tab communication
let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel('gogga_metrics');
      broadcastChannel.onmessage = (event) => {
        const metric = event.data as Metric;
        // Add to local buffer (don't re-broadcast)
        metricsBuffer.push(metric);
        if (metricsBuffer.length > CONFIG.MAX_BUFFER_SIZE) {
          metricsBuffer.shift();
        }
        // Notify local listeners
        listeners.forEach(listener => {
          try {
            listener(metric);
          } catch (error) {
            console.error('[RAGMetrics] Listener error:', error);
          }
        });
      };
    } catch (e) {
      console.debug('[RAGMetrics] BroadcastChannel not available');
    }
  }
  return broadcastChannel;
}

/**
 * Emit a metric to the buffer, persist to Dexie, and notify listeners
 */
export function emitMetric(data: Omit<Metric, 'id' | 'timestamp'>): Metric {
  const metric: Metric = {
    id: generateMetricId(),
    timestamp: Date.now(),
    ...data,
  };
  
  // Add to buffer
  metricsBuffer.push(metric);
  
  // Trim buffer if too large
  if (metricsBuffer.length > CONFIG.MAX_BUFFER_SIZE) {
    metricsBuffer.shift();
  }
  
  // Persist to Dexie (async, non-blocking)
  persistMetricToDexie(metric);
  
  // Notify local listeners
  listeners.forEach(listener => {
    try {
      listener(metric);
    } catch (error) {
      console.error('[RAGMetrics] Listener error:', error);
    }
  });
  
  // Broadcast to other tabs
  const channel = getBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage(metric);
    } catch (e) {
      // Ignore broadcast errors
    }
  }
  
  return metric;
}

/**
 * Subscribe to real-time metric updates
 */
export function subscribeToMetrics(listener: MetricListener): () => void {
  // Ensure BroadcastChannel is initialized to receive cross-tab messages
  getBroadcastChannel();
  
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get recent metrics from in-memory buffer (fast, sync)
 * For full historical data, use getRecentMetricsAsync
 */
export function getRecentMetrics(options?: {
  sessionId?: string;
  type?: MetricType;
  limit?: number;
  sinceMs?: number;
}): Metric[] {
  let result = [...metricsBuffer];
  
  // Filter by time
  if (options?.sinceMs) {
    result = result.filter(m => m.timestamp >= options.sinceMs!);
  }
  
  // Filter by session
  if (options?.sessionId) {
    result = result.filter(m => m.sessionId === options.sessionId);
  }
  
  // Filter by type
  if (options?.type) {
    result = result.filter(m => m.type === options.type);
  }
  
  // Apply limit (from end - most recent)
  if (options?.limit && options.limit < result.length) {
    result = result.slice(-options.limit);
  }
  
  return result;
}

/**
 * Get recent metrics from Dexie (async, full 3-day history)
 * Use this for dashboard data that needs persistence across page navigation
 */
export async function getRecentMetricsAsync(options?: {
  sessionId?: string;
  type?: MetricType;
  docId?: number;
  limit?: number;
  sinceMs?: number;
}): Promise<Metric[]> {
  try {
    const storedMetrics = await getRecentRagMetrics({
      type: options?.type,
      sessionId: options?.sessionId,
      limit: options?.limit,
      since: options?.sinceMs,
    });
    
    // Convert RagMetric to Metric format
    return storedMetrics.map(rm => ({
      id: rm.metricId,
      type: rm.type,
      timestamp: rm.timestamp,
      sessionId: rm.sessionId,
      docId: rm.docId,
      value: rm.value as Record<string, any>,
    }));
  } catch (e) {
    console.error('[RAGMetrics] Failed to get metrics from Dexie:', e);
    // Fallback to in-memory buffer
    return getRecentMetrics(options);
  }
}

/**
 * Get aggregated metrics for a time period
 */
export function getAggregatedMetrics(options?: {
  sessionId?: string;
  sinceMs?: number;
  untilMs?: number;
}): MetricAggregation {
  const sinceMs = options?.sinceMs ?? Date.now() - CONFIG.AGGREGATION_WINDOW_MS;
  const untilMs = options?.untilMs ?? Date.now();
  
  const metrics = getRecentMetrics({
    sessionId: options?.sessionId,
    sinceMs,
  }).filter(m => m.timestamp <= untilMs);
  
  // Initialize aggregation
  const agg: MetricAggregation = {
    count: 0,
    avgLatencyMs: 0,
    maxLatencyMs: 0,
    minLatencyMs: Infinity,
    avgScore: 0,
    topScore: 0,
    totalChunksRetrieved: 0,
    errorCount: 0,
    periodStartMs: sinceMs,
    periodEndMs: untilMs,
  };
  
  if (metrics.length === 0) {
    agg.minLatencyMs = 0;
    return agg;
  }
  
  let totalLatency = 0;
  let totalScore = 0;
  let scoreCount = 0;
  
  for (const metric of metrics) {
    agg.count++;
    
    if (metric.type === 'error') {
      agg.errorCount++;
      continue;
    }
    
    const latency = metric.value?.latencyMs ?? 0;
    totalLatency += latency;
    agg.maxLatencyMs = Math.max(agg.maxLatencyMs, latency);
    agg.minLatencyMs = Math.min(agg.minLatencyMs, latency);
    
    const score = metric.value?.topScore ?? metric.value?.averageScore;
    if (typeof score === 'number') {
      totalScore += score;
      scoreCount++;
      agg.topScore = Math.max(agg.topScore, score);
    }
    
    const chunks = metric.value?.chunksRetrieved ?? metric.value?.docsRetrieved ?? 0;
    agg.totalChunksRetrieved += chunks;
  }
  
  agg.avgLatencyMs = agg.count > 0 ? totalLatency / agg.count : 0;
  agg.avgScore = scoreCount > 0 ? totalScore / scoreCount : 0;
  
  if (agg.minLatencyMs === Infinity) {
    agg.minLatencyMs = 0;
  }
  
  return agg;
}

/**
 * Get time-series data for charting
 */
export function getTimeSeriesMetrics(options?: {
  sessionId?: string;
  intervalMs?: number;
  periods?: number;
}): Array<{
  timestamp: number;
  aggregation: MetricAggregation;
}> {
  const intervalMs = options?.intervalMs ?? 5000; // 5 second intervals
  const periods = options?.periods ?? 60; // Last 5 minutes by default
  
  const now = Date.now();
  const series: Array<{ timestamp: number; aggregation: MetricAggregation }> = [];
  
  for (let i = periods - 1; i >= 0; i--) {
    const periodEnd = now - (i * intervalMs);
    const periodStart = periodEnd - intervalMs;
    
    series.push({
      timestamp: periodEnd,
      aggregation: getAggregatedMetrics({
        sessionId: options?.sessionId,
        sinceMs: periodStart,
        untilMs: periodEnd,
      }),
    });
  }
  
  return series;
}

/**
 * Get retrieval mode statistics
 */
export function getModeStats(sessionId?: string): {
  basic: { count: number; avgLatencyMs: number };
  semantic: { count: number; avgLatencyMs: number; avgScore: number };
} {
  const metrics = getRecentMetrics({ sessionId, type: 'retrieval' });
  
  const stats = {
    basic: { count: 0, totalLatency: 0 },
    semantic: { count: 0, totalLatency: 0, totalScore: 0 },
  };
  
  for (const m of metrics) {
    if (m.value?.mode === 'basic') {
      stats.basic.count++;
      stats.basic.totalLatency += m.value?.latencyMs ?? 0;
    } else if (m.value?.mode === 'semantic') {
      stats.semantic.count++;
      stats.semantic.totalLatency += m.value?.latencyMs ?? 0;
      stats.semantic.totalScore += m.value?.topScore ?? 0;
    }
  }
  
  return {
    basic: {
      count: stats.basic.count,
      avgLatencyMs: stats.basic.count > 0 
        ? stats.basic.totalLatency / stats.basic.count 
        : 0,
    },
    semantic: {
      count: stats.semantic.count,
      avgLatencyMs: stats.semantic.count > 0 
        ? stats.semantic.totalLatency / stats.semantic.count 
        : 0,
      avgScore: stats.semantic.count > 0 
        ? stats.semantic.totalScore / stats.semantic.count 
        : 0,
    },
  };
}

/**
 * Get retrieval mode statistics for a specific time range
 * Used for per-period latency in charts
 */
export function getModeStatsForPeriod(sinceMs: number, untilMs: number): {
  basic: { count: number; avgLatencyMs: number };
  semantic: { count: number; avgLatencyMs: number; avgScore: number };
} {
  const metrics = getRecentMetrics({ type: 'retrieval', sinceMs })
    .filter(m => m.timestamp <= untilMs);
  
  const stats = {
    basic: { count: 0, totalLatency: 0 },
    semantic: { count: 0, totalLatency: 0, totalScore: 0 },
  };
  
  for (const m of metrics) {
    if (m.value?.mode === 'basic') {
      stats.basic.count++;
      stats.basic.totalLatency += m.value?.latencyMs ?? 0;
    } else if (m.value?.mode === 'semantic') {
      stats.semantic.count++;
      stats.semantic.totalLatency += m.value?.latencyMs ?? 0;
      stats.semantic.totalScore += m.value?.topScore ?? 0;
    }
  }
  
  return {
    basic: {
      count: stats.basic.count,
      avgLatencyMs: stats.basic.count > 0 
        ? stats.basic.totalLatency / stats.basic.count 
        : 0,
    },
    semantic: {
      count: stats.semantic.count,
      avgLatencyMs: stats.semantic.count > 0 
        ? stats.semantic.totalLatency / stats.semantic.count 
        : 0,
      avgScore: stats.semantic.count > 0 
        ? stats.semantic.totalScore / stats.semantic.count 
        : 0,
    },
  };
}

/**
 * Get score distribution for histogram
 * Returns counts of scores in ranges: 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0
 */
export function getScoreDistribution(): Array<{ range: string; count: number }> {
  const metrics = getRecentMetrics({ type: 'retrieval' });
  
  const buckets = [
    { range: '0.0-0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 },
  ];
  
  for (const m of metrics) {
    const score = m.value?.topScore ?? m.value?.averageScore;
    if (typeof score === 'number' && score >= 0 && score <= 1) {
      for (const bucket of buckets) {
        if (score >= bucket.min && (score < bucket.max || (score === 1 && bucket.max === 1))) {
          bucket.count++;
          break;
        }
      }
    }
  }
  
  return buckets.map(b => ({ range: b.range, count: b.count }));
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metricsBuffer.length = 0;
}

/**
 * Clear metrics for a specific session
 */
export function clearSessionMetrics(sessionId: string): void {
  for (let i = metricsBuffer.length - 1; i >= 0; i--) {
    const metric = metricsBuffer[i];
    if (metric?.sessionId === sessionId) {
      metricsBuffer.splice(i, 1);
    }
  }
}

/**
 * Export metrics for debugging/analysis
 */
export function exportMetrics(): Metric[] {
  return [...metricsBuffer];
}

/**
 * Get buffer statistics
 */
export function getBufferStats(): {
  size: number;
  maxSize: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
} {
  return {
    size: metricsBuffer.length,
    maxSize: CONFIG.MAX_BUFFER_SIZE,
    oldestTimestamp: metricsBuffer.length > 0 ? (metricsBuffer[0]?.timestamp ?? null) : null,
    newestTimestamp: metricsBuffer.length > 0 ? (metricsBuffer[metricsBuffer.length - 1]?.timestamp ?? null) : null,
  };
}

// Export types
export type { Metric as RagMetric, MetricAggregation as RagMetricAggregation };
