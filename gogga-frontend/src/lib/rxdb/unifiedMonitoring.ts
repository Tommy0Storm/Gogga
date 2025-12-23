/**
 * GOGGA Unified Database Monitoring
 * 
 * Real-time monitoring for both RxDB and Dexie databases
 * Uses RxJS observables with proper operators for efficient updates
 * 
 * RxJS v7.8.2 operators used:
 * - interval: Periodic updates
 * - switchMap: Cancel previous async calls
 * - distinctUntilChanged: Skip duplicate emissions
 * - shareReplay: Cache last value for late subscribers
 * - combineLatest: Merge multiple streams
 * - debounceTime: Throttle rapid updates
 * - catchError: Handle errors gracefully
 * - startWith: Emit initial value immediately
 */

import {
  Observable,
  Subject,
  BehaviorSubject,
  interval,
  from,
  combineLatest,
  merge,
  of,
  EMPTY,
} from 'rxjs';
import {
  switchMap,
  distinctUntilChanged,
  shareReplay,
  debounceTime,
  catchError,
  startWith,
  map,
  filter,
  tap,
  takeUntil,
  retry,
  scan,
} from 'rxjs/operators';

import { getDatabase, getStorageStats, RAG_LIMITS } from './database';
import { getVectorStats, findSimilarVectors } from './vectorCollection';
import { getPipelineStats, onPipelineProgress, getPipelineState } from './embeddingPipeline';
import type { GoggaRxDatabase } from './schemas';

// ============================================================================
// Types
// ============================================================================

export interface UnifiedStorageStats {
  rxdb: {
    documents: number;
    chunks: number;
    messages: number;
    images: number;
    vectors: number;
    totalMB: number;
    isLeader: boolean;
  };
  dexie: {
    documents: number;
    chunks: number;
    messages: number;
    images: number;
    totalMB: number;
    usedPercent: number;
    remainingMB: number;
  };
  combined: {
    totalDocuments: number;
    totalMessages: number;
    totalImages: number;
    totalSizeMB: number;
    storageHealth: 'good' | 'warning' | 'critical';
  };
}

export interface VectorMonitoringState {
  totalVectors: number;
  totalDocuments: number;
  averageVectorsPerDoc: number;
  sampleVectorsLoaded: boolean;
  lastQueryLatency: number | null;
  queryHistory: Array<{ timestamp: number; latencyMs: number; resultsCount: number }>;
  dimensionality: number;
}

export interface PipelineMonitoringState {
  isRunning: boolean;
  pending: number;
  processing: number;
  completed: number;
  errors: number;
  lastError: string | null;
  throughput: number; // docs per minute
  estimatedTimeRemaining: number | null; // seconds
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'offline';
  rxdbConnected: boolean;
  dexieConnected: boolean;
  indexedDBAvailable: boolean;
  leaderTabActive: boolean;
  lastHealthCheck: number;
  issues: string[];
}

export interface RealTimeMetrics {
  timestamp: number;
  storage: UnifiedStorageStats;
  vectors: VectorMonitoringState;
  pipeline: PipelineMonitoringState;
  health: DatabaseHealth;
}

// ============================================================================
// Observable Factories
// ============================================================================

// Destroy signal for cleanup
const destroy$ = new Subject<void>();

/**
 * Create an observable for storage stats with proper RxJS patterns
 * Uses switchMap to cancel pending requests on new emissions
 */
export function createStorageStatsObservable(
  refreshInterval = 5000
): Observable<UnifiedStorageStats> {
  return interval(refreshInterval).pipe(
    startWith(0),
    switchMap(() => from(fetchUnifiedStorageStats())),
    distinctUntilChanged((prev, curr) => 
      JSON.stringify(prev) === JSON.stringify(curr)
    ),
    catchError(err => {
      console.error('[UnifiedMonitoring] Storage stats error:', err);
      return of(getDefaultStorageStats());
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntil(destroy$),
  );
}

/**
 * Create an observable for vector stats with debouncing
 */
export function createVectorStatsObservable(
  refreshInterval = 10000
): Observable<VectorMonitoringState> {
  const queryHistory$ = new BehaviorSubject<VectorMonitoringState['queryHistory']>([]);

  return interval(refreshInterval).pipe(
    startWith(0),
    switchMap(() => from(fetchVectorStats())),
    map(stats => ({
      ...stats,
      queryHistory: queryHistory$.value.slice(-20), // Keep last 20 queries
    })),
    distinctUntilChanged((prev, curr) =>
      prev.totalVectors === curr.totalVectors &&
      prev.totalDocuments === curr.totalDocuments
    ),
    catchError(err => {
      console.error('[UnifiedMonitoring] Vector stats error:', err);
      return of(getDefaultVectorStats());
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntil(destroy$),
  );
}

/**
 * Create an observable for pipeline status with live updates
 * Combines interval polling with event-driven updates
 */
export function createPipelineObservable(): Observable<PipelineMonitoringState> {
  const pipelineUpdates$ = new Subject<PipelineMonitoringState>();
  
  // Subscribe to pipeline progress events
  const unsubscribe = onPipelineProgress((state) => {
    const throughput = calculateThroughput(state.completedCount);
    const estimatedTime = state.pendingDocIds.size > 0 && throughput > 0
      ? (state.pendingDocIds.size / throughput) * 60
      : null;

    pipelineUpdates$.next({
      isRunning: state.isRunning,
      pending: state.pendingDocIds.size,
      processing: state.processingDocIds.size,
      completed: state.completedCount,
      errors: state.errorCount,
      lastError: state.lastError || null,
      throughput,
      estimatedTimeRemaining: estimatedTime,
    });
  });

  // Cleanup on destroy
  destroy$.subscribe(() => unsubscribe());

  return merge(
    // Initial state
    of(getDefaultPipelineState()),
    // Live updates
    pipelineUpdates$,
  ).pipe(
    debounceTime(100), // Throttle rapid updates
    distinctUntilChanged((prev, curr) =>
      prev.pending === curr.pending &&
      prev.processing === curr.processing &&
      prev.completed === curr.completed
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntil(destroy$),
  );
}

/**
 * Create an observable for database health checks
 */
export function createHealthObservable(
  checkInterval = 15000
): Observable<DatabaseHealth> {
  return interval(checkInterval).pipe(
    startWith(0),
    switchMap(() => from(checkDatabaseHealth())),
    distinctUntilChanged((prev, curr) =>
      prev.status === curr.status &&
      prev.rxdbConnected === curr.rxdbConnected &&
      prev.dexieConnected === curr.dexieConnected
    ),
    catchError(() => of({
      status: 'offline' as const,
      rxdbConnected: false,
      dexieConnected: false,
      indexedDBAvailable: false,
      leaderTabActive: false,
      lastHealthCheck: Date.now(),
      issues: ['Health check failed'],
    })),
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntil(destroy$),
  );
}

/**
 * Combined real-time metrics observable
 * Uses combineLatest to merge all streams
 */
export function createRealTimeMetricsObservable(
  config: {
    storageInterval?: number;
    vectorInterval?: number;
    healthInterval?: number;
  } = {}
): Observable<RealTimeMetrics> {
  const {
    storageInterval = 5000,
    vectorInterval = 10000,
    healthInterval = 15000,
  } = config;

  return combineLatest([
    createStorageStatsObservable(storageInterval),
    createVectorStatsObservable(vectorInterval),
    createPipelineObservable(),
    createHealthObservable(healthInterval),
  ]).pipe(
    map(([storage, vectors, pipeline, health]) => ({
      timestamp: Date.now(),
      storage,
      vectors,
      pipeline,
      health,
    })),
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntil(destroy$),
  );
}

// ============================================================================
// Vector Search Analytics
// ============================================================================

export interface VectorSearchResult {
  queryVector: number[];
  results: Array<{
    documentId: string;
    similarity: number;
    content: string;
  }>;
  latencyMs: number;
  docsScanned: number;
  timestamp: number;
}

const searchResults$ = new BehaviorSubject<VectorSearchResult[]>([]);

/**
 * Track vector search performance
 */
export function trackVectorSearch(result: VectorSearchResult): void {
  const current = searchResults$.value;
  // Keep last 50 searches
  searchResults$.next([result, ...current].slice(0, 50));
}

/**
 * Observable for vector search history
 */
export function getSearchHistoryObservable(): Observable<VectorSearchResult[]> {
  return searchResults$.asObservable().pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}

/**
 * Observable for search performance metrics
 */
export function getSearchPerformanceObservable(): Observable<{
  averageLatency: number;
  p95Latency: number;
  totalSearches: number;
  searchesPerMinute: number;
}> {
  return searchResults$.pipe(
    map(results => {
      if (results.length === 0) {
        return { averageLatency: 0, p95Latency: 0, totalSearches: 0, searchesPerMinute: 0 };
      }

      const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index] ?? latencies[latencies.length - 1] ?? 0;

      // Calculate searches per minute
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentSearches = results.filter(r => r.timestamp > oneMinuteAgo);

      return {
        averageLatency: Math.round(avgLatency),
        p95Latency: Math.round(p95Latency),
        totalSearches: results.length,
        searchesPerMinute: recentSearches.length,
      };
    }),
    distinctUntilChanged((prev, curr) =>
      prev.averageLatency === curr.averageLatency &&
      prev.totalSearches === curr.totalSearches
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fetchUnifiedStorageStats(): Promise<UnifiedStorageStats> {
  try {
    // Fetch RxDB stats
    const rxdbStats = await getStorageStats();
    const vectorStats = await getVectorStats();

    // Check IndexedDB usage
    let indexedDBUsage = { quota: 0, usage: 0 };
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      indexedDBUsage = { quota: estimate.quota || 0, usage: estimate.usage || 0 };
    }

    const totalSizeMB = rxdbStats.totalMB + (indexedDBUsage.usage / (1024 * 1024));
    const usedPercent = indexedDBUsage.quota > 0
      ? (indexedDBUsage.usage / indexedDBUsage.quota) * 100
      : 0;

    // Determine storage health
    let storageHealth: 'good' | 'warning' | 'critical' = 'good';
    if (usedPercent > 90) {
      storageHealth = 'critical';
    } else if (usedPercent > 70) {
      storageHealth = 'warning';
    }

    return {
      rxdb: {
        documents: rxdbStats.documents,
        chunks: rxdbStats.chunks,
        messages: rxdbStats.messages,
        images: rxdbStats.images,
        vectors: vectorStats.totalVectors,
        totalMB: rxdbStats.totalMB,
        isLeader: true, // TODO: Check actual leader status
      },
      dexie: {
        documents: 0, // Will be populated from Dexie if available
        chunks: 0,
        messages: 0,
        images: 0,
        totalMB: indexedDBUsage.usage / (1024 * 1024),
        usedPercent,
        remainingMB: (indexedDBUsage.quota - indexedDBUsage.usage) / (1024 * 1024),
      },
      combined: {
        totalDocuments: rxdbStats.documents,
        totalMessages: rxdbStats.messages,
        totalImages: rxdbStats.images,
        totalSizeMB,
        storageHealth,
      },
    };
  } catch (err) {
    console.error('[UnifiedMonitoring] Failed to fetch storage stats:', err);
    return getDefaultStorageStats();
  }
}

async function fetchVectorStats(): Promise<VectorMonitoringState> {
  try {
    const stats = await getVectorStats();
    return {
      totalVectors: stats.totalVectors,
      totalDocuments: stats.totalDocuments,
      averageVectorsPerDoc: stats.averageVectorsPerDoc,
      sampleVectorsLoaded: true,
      lastQueryLatency: null,
      queryHistory: [],
      dimensionality: 384, // E5-small-v2
    };
  } catch {
    return getDefaultVectorStats();
  }
}

async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const issues: string[] = [];
  let rxdbConnected = false;
  let dexieConnected = false;
  let indexedDBAvailable = false;
  let leaderTabActive = false;

  try {
    // Check IndexedDB availability
    if (typeof indexedDB !== 'undefined') {
      indexedDBAvailable = true;
    } else {
      issues.push('IndexedDB not available');
    }

    // Check RxDB connection
    try {
      const db = await getDatabase();
      rxdbConnected = db !== null;
      leaderTabActive = true; // Leader election via RxDB
    } catch {
      issues.push('RxDB connection failed');
    }

    // Check Dexie connection (optional)
    try {
      // Dynamic import to avoid SSR issues
      const { db } = await import('@/lib/db');
      if (db.isOpen()) {
        dexieConnected = true;
      }
    } catch {
      // Dexie not available or not configured
    }

    // Determine overall status
    let status: DatabaseHealth['status'] = 'healthy';
    if (!rxdbConnected && !dexieConnected) {
      status = 'offline';
    } else if (issues.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      rxdbConnected,
      dexieConnected,
      indexedDBAvailable,
      leaderTabActive,
      lastHealthCheck: Date.now(),
      issues,
    };
  } catch (err) {
    return {
      status: 'offline',
      rxdbConnected: false,
      dexieConnected: false,
      indexedDBAvailable: false,
      leaderTabActive: false,
      lastHealthCheck: Date.now(),
      issues: ['Health check failed: ' + String(err)],
    };
  }
}

// Throughput calculation state
let completedHistory: Array<{ timestamp: number; count: number }> = [];

function calculateThroughput(currentCompleted: number): number {
  const now = Date.now();
  completedHistory.push({ timestamp: now, count: currentCompleted });
  
  // Keep only last 60 seconds of history
  completedHistory = completedHistory.filter(h => now - h.timestamp < 60000);
  
  if (completedHistory.length < 2) return 0;
  
  const first = completedHistory[0];
  const last = completedHistory[completedHistory.length - 1];
  
  if (!first || !last) return 0;
  
  const timeSpanMinutes = (last.timestamp - first.timestamp) / 60000;
  
  if (timeSpanMinutes === 0) return 0;
  
  return Math.round((last.count - first.count) / timeSpanMinutes);
}

// ============================================================================
// Default State Factories
// ============================================================================

function getDefaultStorageStats(): UnifiedStorageStats {
  return {
    rxdb: { documents: 0, chunks: 0, messages: 0, images: 0, vectors: 0, totalMB: 0, isLeader: false },
    dexie: { documents: 0, chunks: 0, messages: 0, images: 0, totalMB: 0, usedPercent: 0, remainingMB: 100 },
    combined: { totalDocuments: 0, totalMessages: 0, totalImages: 0, totalSizeMB: 0, storageHealth: 'good' },
  };
}

function getDefaultVectorStats(): VectorMonitoringState {
  return {
    totalVectors: 0,
    totalDocuments: 0,
    averageVectorsPerDoc: 0,
    sampleVectorsLoaded: false,
    lastQueryLatency: null,
    queryHistory: [],
    dimensionality: 384,
  };
}

function getDefaultPipelineState(): PipelineMonitoringState {
  const state = getPipelineStats();
  return {
    isRunning: state.isRunning,
    pending: state.pending,
    processing: state.processing,
    completed: state.completed,
    errors: state.errors,
    lastError: null,
    throughput: 0,
    estimatedTimeRemaining: null,
  };
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Destroy all monitoring observables
 * Call this when the app unmounts or monitoring is no longer needed
 */
export function destroyMonitoring(): void {
  destroy$.next();
  completedHistory = [];
  searchResults$.next([]);
}

// ============================================================================
// React Hook Helper
// ============================================================================

/**
 * Create subscription helper for React hooks
 * Ensures proper cleanup on unmount
 */
export function subscribeWithCleanup<T>(
  observable$: Observable<T>,
  onValue: (value: T) => void,
  onError?: (error: unknown) => void
): () => void {
  const subscription = observable$.subscribe({
    next: onValue,
    error: onError || ((err) => console.error('[UnifiedMonitoring] Error:', err)),
  });

  return () => subscription.unsubscribe();
}
