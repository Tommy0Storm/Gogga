/**
 * GOGGA RxDB Dashboard Components
 * React components powered by RxDB observables
 * Features real-time updates, insights, and analytics
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Brain,
  Clock,
  Database,
  FileText,
  Layers,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Network,
} from 'lucide-react';

// Import RxDB functions
import {
  getStorageStats,
  getVectorStats,
  getPipelineStats,
  onPipelineProgress,
  getConversationInsights,
  getDailyTokenUsage,
  getTopicDistribution,
  getDocumentClusters,
  getOfflineQueueStatus,
  isMigrationNeeded,
  getMigrationState,
  runMigration,
} from './index';

// ============================================================================
// Types
// ============================================================================

interface StorageStatsData {
  documents: number;
  chunks: number;
  messages: number;
  images: number;
  vectors: number;
  totalMB: number;
}

interface VectorStatsData {
  totalVectors: number;
  totalDocuments: number;
  averageVectorsPerDoc: number;
}

interface PipelineStatsData {
  isRunning: boolean;
  pending: number;
  processing: number;
  completed: number;
  errors: number;
  lastError?: string;
}

interface ConversationInsightsData {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCostZar: number;
  averageMessagesPerSession: number;
  mostActiveDay: string;
  topTier: string;
}

interface TokenUsageData {
  date: string;
  input: number;
  output: number;
  total: number;
}

interface TopicData {
  topic: string;
  count: number;
}

interface ClusterData {
  id: string;
  name: string;
  documentIds: string[];
  averageSimilarity: number;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for storage statistics with auto-refresh
 */
export function useStorageStats(refreshInterval = 30000) {
  const [stats, setStats] = useState<StorageStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getStorageStats();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load storage stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  return { stats, loading, error, refresh };
}

/**
 * Hook for vector statistics
 */
export function useVectorStats() {
  const [stats, setStats] = useState<VectorStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVectorStats().then(data => {
      setStats({
        totalVectors: data.totalVectors,
        totalDocuments: data.totalDocuments,
        averageVectorsPerDoc: data.averageVectorsPerDoc,
      });
      setLoading(false);
    });
  }, []);

  return { stats, loading };
}

/**
 * Hook for embedding pipeline status with live updates
 */
export function usePipelineStatus() {
  const [status, setStatus] = useState<PipelineStatsData>(getPipelineStats());

  useEffect(() => {
    // Subscribe to pipeline progress updates
    const unsubscribe = onPipelineProgress((state: {
      isRunning: boolean;
      pendingDocIds: Set<string>;
      processingDocIds: Set<string>;
      completedCount: number;
      errorCount: number;
      lastError?: string;
    }) => {
      const newStatus: PipelineStatsData = {
        isRunning: state.isRunning,
        pending: state.pendingDocIds.size,
        processing: state.processingDocIds.size,
        completed: state.completedCount,
        errors: state.errorCount,
      };
      
      if (state.lastError) {
        newStatus.lastError = state.lastError;
      }
      
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  return status;
}

/**
 * Hook for conversation insights
 */
export function useConversationInsights() {
  const [insights, setInsights] = useState<ConversationInsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConversationInsights().then(data => {
      setInsights(data);
      setLoading(false);
    });
  }, []);

  return { insights, loading };
}

/**
 * Hook for daily token usage chart data
 */
export function useTokenUsageChart(days = 7) {
  const [data, setData] = useState<TokenUsageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDailyTokenUsage(days).then(usage => {
      setData(usage);
      setLoading(false);
    });
  }, [days]);

  return { data, loading };
}

/**
 * Hook for topic distribution
 */
export function useTopicDistribution() {
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTopicDistribution().then(data => {
      setTopics(data);
      setLoading(false);
    });
  }, []);

  return { topics, loading };
}

/**
 * Hook for document clusters
 */
export function useDocumentClusters() {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocumentClusters().then(data => {
      setClusters(data);
      setLoading(false);
    });
  }, []);

  return { clusters, loading };
}

/**
 * Hook for offline queue status
 */
export function useOfflineQueue() {
  const [status, setStatus] = useState<{ pending: number; failed: number; oldest?: string }>({
    pending: 0,
    failed: 0,
  });

  useEffect(() => {
    getOfflineQueueStatus().then(setStatus);
  }, []);

  return status;
}

/**
 * Hook for migration status
 */
export function useMigrationStatus() {
  const [needed, setNeeded] = useState(false);
  const [state, setState] = useState(getMigrationState());
  const [running, setRunning] = useState(false);

  useEffect(() => {
    isMigrationNeeded().then(setNeeded);
  }, []);

  const startMigration = useCallback(async () => {
    setRunning(true);
    const result = await runMigration((table, count) => {
      console.log(`Migrated ${table}: ${count} records`);
    });
    setState(result);
    setRunning(false);
    setNeeded(false);
  }, []);

  return { needed, state, running, startMigration };
}

// ============================================================================
// Components
// ============================================================================

/**
 * Storage Statistics Card
 */
export function StorageStatsCard() {
  const { stats, loading, refresh } = useStorageStats();

  if (loading) {
    return (
      <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded w-24"></div>
          <div className="h-4 bg-gray-700 rounded w-20"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">RxDB Storage</h3>
        </div>
        <button
          onClick={refresh}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-gray-300">{stats?.documents ?? 0} docs</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <span className="text-gray-300">{stats?.messages ?? 0} msgs</span>
        </div>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-gray-400" />
          <span className="text-gray-300">{stats?.vectors ?? 0} vectors</span>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" />
          <span className="text-gray-300">{stats?.totalMB.toFixed(1) ?? 0} MB</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Embedding Pipeline Status Card
 */
export function EmbeddingPipelineCard() {
  const status = usePipelineStatus();

  return (
    <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className={`w-5 h-5 ${status.isRunning ? 'text-green-400 animate-pulse' : 'text-gray-400'}`} />
        <h3 className="text-lg font-semibold text-white">Embedding Pipeline</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Status</span>
          <span className={`flex items-center gap-1 ${status.isRunning ? 'text-green-400' : 'text-gray-500'}`}>
            {status.isRunning ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Running
              </>
            ) : (
              'Idle'
            )}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Pending</span>
          <span className="text-yellow-400">{status.pending}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Processing</span>
          <span className="text-blue-400">{status.processing}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Completed</span>
          <span className="text-green-400">{status.completed}</span>
        </div>

        {status.errors > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Errors</span>
            <span className="text-red-400">{status.errors}</span>
          </div>
        )}

        {status.lastError && (
          <div className="mt-2 p-2 bg-red-900/30 rounded-lg">
            <p className="text-xs text-red-300 truncate">{status.lastError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Conversation Insights Card
 */
export function ConversationInsightsCard() {
  const { insights, loading } = useConversationInsights();

  if (loading) {
    return (
      <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-40 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Conversation Insights</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Total Sessions</p>
          <p className="text-2xl font-bold text-white">{insights?.totalSessions ?? 0}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Total Messages</p>
          <p className="text-2xl font-bold text-white">{insights?.totalMessages ?? 0}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Tokens Used</p>
          <p className="text-xl font-bold text-white">
            {((insights?.totalTokens ?? 0) / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Cost (ZAR)</p>
          <p className="text-xl font-bold text-white">
            R{insights?.totalCostZar.toFixed(2) ?? '0.00'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-400">Most Active</span>
        <span className="text-gray-300">{insights?.mostActiveDay || 'N/A'}</span>
      </div>
    </div>
  );
}

/**
 * Topic Distribution Chart
 */
export function TopicDistributionCard() {
  const { topics, loading } = useTopicDistribution();

  if (loading) {
    return (
      <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-36 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-6 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...topics.map(t => t.count), 1);

  return (
    <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">Topic Distribution</h3>
      </div>

      <div className="space-y-2">
        {topics.length === 0 ? (
          <p className="text-gray-400 text-sm">No topics yet</p>
        ) : (
          topics.slice(0, 5).map(topic => (
            <div key={topic.topic} className="flex items-center gap-2">
              <span className="text-gray-300 text-sm w-20 truncate">{topic.topic}</span>
              <div className="flex-1 h-4 bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-cyan-500 to-blue-500"
                  style={{ width: `${(topic.count / maxCount) * 100}%` }}
                ></div>
              </div>
              <span className="text-gray-400 text-xs w-6">{topic.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Document Clusters Card
 */
export function DocumentClustersCard() {
  const { clusters, loading } = useDocumentClusters();

  if (loading) {
    return (
      <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-36 mb-4"></div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Network className="w-5 h-5 text-orange-400" />
        <h3 className="text-lg font-semibold text-white">Document Clusters</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {clusters.length === 0 ? (
          <p className="col-span-2 text-gray-400 text-sm">No clusters yet</p>
        ) : (
          clusters.map((cluster, idx) => (
            <div
              key={cluster.id}
              className="bg-gray-800/50 rounded-lg p-3 border-l-2"
              style={{
                borderColor: ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'][idx % 5],
              }}
            >
              <p className="text-sm font-medium text-white">{cluster.name}</p>
              <p className="text-xs text-gray-400">
                {cluster.documentIds.length} docs • {(cluster.averageSimilarity * 100).toFixed(0)}% similar
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Migration Status Banner
 */
export function MigrationBanner() {
  const { needed, state, running, startMigration } = useMigrationStatus();

  if (!needed && !state.started) {
    return null;
  }

  if (state.completed) {
    return (
      <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-400" />
        <div>
          <p className="text-green-300 font-medium">Migration Complete</p>
          <p className="text-green-400/70 text-sm">
            All data migrated to RxDB successfully
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <div>
            <p className="text-yellow-300 font-medium">Database Migration Available</p>
            <p className="text-yellow-400/70 text-sm">
              Migrate from Dexie to RxDB for better performance
            </p>
          </div>
        </div>
        <button
          onClick={startMigration}
          disabled={running}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {running ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Migrating...
            </>
          ) : (
            'Start Migration'
          )}
        </button>
      </div>

      {running && (
        <div className="mt-4 space-y-1">
          {Object.entries(state.tables).map(([table, info]) => (
            <div key={table} className="flex items-center gap-2 text-sm">
              {info.migrated ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Clock className="w-4 h-4 text-gray-400" />
              )}
              <span className={info.migrated ? 'text-green-300' : 'text-gray-400'}>
                {table}: {info.count} records
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Offline Queue Status Indicator
 */
export function OfflineQueueIndicator() {
  const status = useOfflineQueue();

  if (status.pending === 0 && status.failed === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full">
      {status.pending > 0 && (
        <span className="flex items-center gap-1 text-yellow-400 text-sm">
          <Clock className="w-3 h-3" />
          {status.pending} pending
        </span>
      )}
      {status.failed > 0 && (
        <span className="flex items-center gap-1 text-red-400 text-sm">
          <AlertTriangle className="w-3 h-3" />
          {status.failed} failed
        </span>
      )}
    </div>
  );
}

/**
 * Vector Statistics Card
 */
export function VectorStatsCard() {
  const { stats, loading } = useVectorStats();

  if (loading) {
    return (
      <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded w-24"></div>
          <div className="h-4 bg-gray-700 rounded w-20"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-pink-400" />
        <h3 className="text-lg font-semibold text-white">Vector Index</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Total Vectors</span>
          <span className="text-white font-medium">{stats?.totalVectors ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Documents</span>
          <span className="text-white font-medium">{stats?.totalDocuments ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Avg per Doc</span>
          <span className="text-white font-medium">{stats?.averageVectorsPerDoc.toFixed(1) ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
