/**
 * GOGGA Embedding Monitor Panel
 * Real-time monitoring of the VCB-AI Micro ONNX embedding model
 * 
 * Features:
 * - Model load status and backend detection (WebGPU/WASM)
 * - Memory and performance metrics
 * - Embedding generation history
 * - Processing statistics
 * - Export/download logs
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Client-side mount check to prevent SSR dimension errors
function useIsMounted(): boolean {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  return isMounted;
}
import {
  Cpu,
  Zap,
  Clock,
  Database,
  Activity,
  RefreshCw,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Layers,
  HardDrive,
  BarChart3,
  TrendingUp,
  History,
  Package,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getRecentMetrics, type Metric } from '@/lib/ragMetrics';
import { ragManager } from '@/lib/ragManager';

// ============================================================================
// Types
// ============================================================================

interface EmbeddingOperation {
  id: string;
  timestamp: Date;
  docId?: string;
  docName?: string;
  chunkCount: number;
  latencyMs: number;
  dimension: number;
  success: boolean;
  errorMessage?: string;
}

interface ModelInfo {
  name: string;
  id: string;
  dimension: number;
  backend: 'webgpu' | 'wasm' | 'loading' | 'error';
  loaded: boolean;
  loadTimeMs?: number;
  modelSizeMB: number;
  quantization: string;
}

interface EmbeddingStats {
  totalOperations: number;
  totalChunks: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  successRate: number;
  cacheHitRate: number;
  memoryUsageMB: number;
}

interface ProcessingHistory {
  time: string;
  chunks: number;
  latencyMs: number;
}

// ============================================================================
// Client-Only Wrapper for ResponsiveContainer
// ============================================================================

interface ClientResponsiveContainerProps {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  children: React.ReactElement;
}

const ClientResponsiveContainer: React.FC<ClientResponsiveContainerProps> = ({
  width = '100%',
  height = '100%',
  children,
}) => {
  const isMounted = useIsMounted();
  
  if (!isMounted) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg animate-pulse"
        style={{ 
          width: typeof width === 'number' ? `${width}px` : width, 
          height: typeof height === 'number' ? `${height}px` : height 
        }}
      >
        <span className="text-xs text-gray-400">Loading...</span>
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width={width} height={height}>
      {children}
    </ResponsiveContainer>
  );
};

// ============================================================================
// Constants
// ============================================================================

const MODEL_INFO: ModelInfo = {
  name: 'VCB-AI Micro',
  id: 'vcb-ai/micro-v1',
  dimension: 384,
  backend: 'wasm',
  loaded: false,
  modelSizeMB: 140,
  quantization: 'q8 (8-bit)',
};

const CHART_COLORS = {
  primary: '#171717',
  secondary: '#525252',
  tertiary: '#a3a3a3',
  success: '#16a34a',
  warning: '#ca8a04',
  error: '#dc2626',
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatLatency(ms: number): string {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

interface StatBoxProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'error';
}

const StatBox: React.FC<StatBoxProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'default',
}) => {
  const colorClasses = {
    default: 'text-primary-900',
    success: 'text-sa-green',
    warning: 'text-sa-gold',
    error: 'text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
          {icon}
        </div>
        <span className="text-sm font-medium text-primary-600">{title}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      {subtitle && (
        <p className="text-xs text-primary-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
};

interface BackendBadgeProps {
  backend: ModelInfo['backend'];
}

const BackendBadge: React.FC<BackendBadgeProps> = ({ backend }) => {
  const configs = {
    webgpu: {
      label: 'WebGPU',
      icon: <Zap className="w-3 h-3" />,
      className: 'bg-sa-green/10 text-sa-green border-sa-green/30',
    },
    wasm: {
      label: 'WASM',
      icon: <Cpu className="w-3 h-3" />,
      className: 'bg-primary-100 text-primary-700 border-primary-300',
    },
    loading: {
      label: 'Loading...',
      icon: <RefreshCw className="w-3 h-3 animate-spin" />,
      className: 'bg-sa-gold/10 text-sa-gold border-sa-gold/30',
    },
    error: {
      label: 'Error',
      icon: <XCircle className="w-3 h-3" />,
      className: 'bg-red-100 text-red-700 border-red-300',
    },
  };

  const config = configs[backend];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full border ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

interface StatusIndicatorProps {
  loaded: boolean;
  backend: ModelInfo['backend'];
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ loaded, backend }) => {
  if (backend === 'loading') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-sa-gold animate-pulse" />
        <span className="text-sm text-sa-gold font-medium">Initializing...</span>
      </div>
    );
  }

  if (backend === 'error') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-600" />
        <span className="text-sm text-red-600 font-medium">Failed to Load</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${loaded ? 'bg-sa-green' : 'bg-primary-400'}`} />
      <span className={`text-sm font-medium ${loaded ? 'text-sa-green' : 'text-primary-500'}`}>
        {loaded ? 'Ready' : 'Not Loaded'}
      </span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const EmbeddingMonitor: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfo>(MODEL_INFO);
  const [stats, setStats] = useState<EmbeddingStats>({
    totalOperations: 0,
    totalChunks: 0,
    avgLatencyMs: 0,
    minLatencyMs: 0,
    maxLatencyMs: 0,
    successRate: 100,
    cacheHitRate: 0,
    memoryUsageMB: 0,
  });
  const [operations, setOperations] = useState<EmbeddingOperation[]>([]);
  const [processingHistory, setProcessingHistory] = useState<ProcessingHistory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchModelStatus = useCallback(async () => {
    let backend: ModelInfo['backend'] = 'wasm';
    let loaded = false;
    let loadTimeMs: number | undefined;

    if (typeof window !== 'undefined') {
      try {
        // Check RagManager state
        const ragReady = ragManager.isReady();
        const hasEmbeddings = ragManager.hasEmbeddings();

        // Check metrics for embedding activity
        const embeddingMetrics = getRecentMetrics({
          type: 'embedding_generated',
        });

        if (ragReady || hasEmbeddings || embeddingMetrics.length > 0) {
          loaded = true;
          if (embeddingMetrics.length > 0) {
            loadTimeMs = embeddingMetrics[0]?.value?.latencyMs;
          }
        }

        // Check WebGPU availability
        if ('gpu' in navigator && (navigator as any).gpu) {
          try {
            const adapter = await (navigator as any).gpu.requestAdapter();
            if (adapter) {
              backend = 'webgpu';
            }
          } catch {
            backend = 'wasm';
          }
        }
      } catch (error) {
        console.error('[EmbeddingMonitor] Status check failed:', error);
        backend = 'error';
      }
    }

    setModelInfo((prev) => ({
      ...prev,
      backend,
      loaded,
      loadTimeMs,
    }));
  }, []);

  const fetchStats = useCallback(() => {
    const allMetrics = getRecentMetrics({ type: 'embedding_generated' });
    const validMetrics = allMetrics.filter(
      (m) => m.docId !== undefined && m.value?.chunkCount > 0
    );
    const cacheHits = getRecentMetrics({ type: 'cache_hit' }).length;
    const cacheMisses = getRecentMetrics({ type: 'cache_miss' }).length;
    const errors = getRecentMetrics({ type: 'error' }).filter(
      (m) => m.value?.operation === 'embedding_generation'
    ).length;

    if (validMetrics.length === 0) {
      setStats({
        totalOperations: 0,
        totalChunks: 0,
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        successRate: 100,
        cacheHitRate: 0,
        memoryUsageMB: 0,
      });
      return;
    }

    const latencies = validMetrics
      .map((m) => m.value?.latencyMs ?? 0)
      .filter((l) => l > 0);
    const totalChunks = validMetrics.reduce(
      (sum, m) => sum + (m.value?.chunkCount ?? 0),
      0
    );

    // Estimate memory usage (rough: 384 dimensions * 4 bytes * chunks + overhead)
    const vectorMemory = totalChunks * 384 * 4;
    const overheadMemory = totalChunks * 100; // Metadata overhead per chunk
    const memoryUsageMB = (vectorMemory + overheadMemory) / (1024 * 1024);

    setStats({
      totalOperations: validMetrics.length,
      totalChunks,
      avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      successRate: validMetrics.length > 0 ? ((validMetrics.length - errors) / validMetrics.length) * 100 : 100,
      cacheHitRate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0,
      memoryUsageMB,
    });
  }, []);

  const fetchOperations = useCallback(() => {
    const allMetrics = getRecentMetrics({ type: 'embedding_generated' });
    const validMetrics = allMetrics
      .filter((m) => m.docId !== undefined && m.value?.chunkCount > 0)
      .slice(0, 20); // Last 20 operations

    const ops: EmbeddingOperation[] = validMetrics.map((m, index) => ({
      id: `op-${m.timestamp}-${index}`,
      timestamp: new Date(m.timestamp),
      docId: m.docId,
      docName: m.value?.docName || `Document ${m.docId}`,
      chunkCount: m.value?.chunkCount ?? 0,
      latencyMs: m.value?.latencyMs ?? 0,
      dimension: 384,
      success: true,
      errorMessage: undefined,
    }));

    // Add any errors
    const errorMetrics = getRecentMetrics({ type: 'error' }).filter(
      (m) => m.value?.operation === 'embedding_generation'
    );

    errorMetrics.forEach((m, index) => {
      ops.push({
        id: `error-${m.timestamp}-${index}`,
        timestamp: new Date(m.timestamp),
        docId: m.docId,
        docName: m.value?.docName || 'Unknown',
        chunkCount: 0,
        latencyMs: 0,
        dimension: 384,
        success: false,
        errorMessage: m.value?.message || 'Unknown error',
      });
    });

    // Sort by timestamp descending
    ops.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setOperations(ops.slice(0, 20));
  }, []);

  const fetchProcessingHistory = useCallback(() => {
    const allMetrics = getRecentMetrics({ type: 'embedding_generated' });
    const validMetrics = allMetrics.filter(
      (m) => m.docId !== undefined && m.value?.chunkCount > 0
    );

    // Group by 5-minute intervals
    const grouped = new Map<string, { chunks: number; latency: number; count: number }>();

    validMetrics.forEach((m) => {
      const time = new Date(m.timestamp);
      time.setMinutes(Math.floor(time.getMinutes() / 5) * 5);
      time.setSeconds(0);
      time.setMilliseconds(0);
      const key = time.toISOString();

      const existing = grouped.get(key) || { chunks: 0, latency: 0, count: 0 };
      grouped.set(key, {
        chunks: existing.chunks + (m.value?.chunkCount ?? 0),
        latency: existing.latency + (m.value?.latencyMs ?? 0),
        count: existing.count + 1,
      });
    });

    const history: ProcessingHistory[] = Array.from(grouped.entries())
      .map(([time, data]) => ({
        time: new Date(time).toLocaleTimeString('en-ZA', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        chunks: data.chunks,
        latencyMs: data.count > 0 ? data.latency / data.count : 0,
      }))
      .slice(-12); // Last hour (12 x 5-minute intervals)

    setProcessingHistory(history);
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchModelStatus();
      fetchStats();
      fetchOperations();
      fetchProcessingHistory();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchModelStatus, fetchStats, fetchOperations, fetchProcessingHistory]);

  // ============================================================================
  // Export Functions
  // ============================================================================

  const exportLogsJSON = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      modelInfo,
      stats,
      operations,
      processingHistory,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gogga-embedding-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [modelInfo, stats, operations, processingHistory]);

  const exportLogsCSV = useCallback(() => {
    const headers = ['Timestamp', 'Document', 'Chunks', 'Latency (ms)', 'Status'];
    const rows = operations.map((op) => [
      op.timestamp.toISOString(),
      op.docName || '',
      op.chunkCount.toString(),
      op.latencyMs.toFixed(0),
      op.success ? 'Success' : 'Failed',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gogga-embedding-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [operations]);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [refreshAll]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-900 rounded-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary-900">VCB-AI Micro Monitor</h2>
            <p className="text-sm text-primary-500">ONNX Embedding Model (140MB)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportLogsCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportLogsJSON}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
          <button
            onClick={refreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Model Status Card */}
      <div className="bg-white rounded-xl border border-primary-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary-900">Model Status</h3>
          <StatusIndicator loaded={modelInfo.loaded} backend={modelInfo.backend} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-primary-500 mb-1">Model Name</p>
            <p className="font-medium text-primary-900">{modelInfo.name}</p>
          </div>
          <div>
            <p className="text-xs text-primary-500 mb-1">Backend</p>
            <BackendBadge backend={modelInfo.backend} />
          </div>
          <div>
            <p className="text-xs text-primary-500 mb-1">Vector Dimension</p>
            <p className="font-medium text-primary-900">{modelInfo.dimension}D</p>
          </div>
          <div>
            <p className="text-xs text-primary-500 mb-1">Quantization</p>
            <p className="font-medium text-primary-900">{modelInfo.quantization}</p>
          </div>
        </div>
        {modelInfo.loadTimeMs && (
          <div className="mt-4 pt-4 border-t border-primary-100">
            <p className="text-xs text-primary-500">
              <CheckCircle2 className="w-3 h-3 inline mr-1 text-sa-green" />
              Model loaded in {formatLatency(modelInfo.loadTimeMs)}
            </p>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          title="Total Operations"
          value={stats.totalOperations}
          subtitle="Document embeddings"
          icon={<Activity className="w-5 h-5" />}
        />
        <StatBox
          title="Total Chunks"
          value={stats.totalChunks.toLocaleString()}
          subtitle="384-dim vectors"
          icon={<Layers className="w-5 h-5" />}
        />
        <StatBox
          title="Avg Latency"
          value={formatLatency(stats.avgLatencyMs)}
          subtitle={`Min: ${formatLatency(stats.minLatencyMs)} / Max: ${formatLatency(stats.maxLatencyMs)}`}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatBox
          title="Memory Usage"
          value={`${stats.memoryUsageMB.toFixed(1)} MB`}
          subtitle="Estimated vector storage"
          icon={<HardDrive className="w-5 h-5" />}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatBox
          title="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          subtitle="Embedding operations"
          icon={<CheckCircle2 className="w-5 h-5" />}
          color={stats.successRate >= 95 ? 'success' : stats.successRate >= 80 ? 'warning' : 'error'}
        />
        <StatBox
          title="Cache Hit Rate"
          value={`${stats.cacheHitRate.toFixed(1)}%`}
          subtitle="Cached embeddings reused"
          icon={<Database className="w-5 h-5" />}
          color={stats.cacheHitRate >= 50 ? 'success' : 'default'}
        />
      </div>

      {/* Processing History Chart */}
      {processingHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-200 p-6">
          <h3 className="text-lg font-semibold text-primary-900 mb-4">Processing History</h3>
          <div className="h-64">
            <ClientResponsiveContainer width="100%" height="100%">
              <AreaChart data={processingHistory}>
                <defs>
                  <linearGradient id="colorChunks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#171717" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#171717" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#737373', fontSize: 12 }}
                  axisLine={{ stroke: '#d4d4d4' }}
                />
                <YAxis
                  tick={{ fill: '#737373', fontSize: 12 }}
                  axisLine={{ stroke: '#d4d4d4' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value?: number, name?: string) => [
                    name === 'chunks' ? (value ?? 0) : `${(value ?? 0).toFixed(0)} ms`,
                    name === 'chunks' ? 'Chunks' : 'Avg Latency',
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="chunks"
                  name="Chunks"
                  stroke="#171717"
                  fillOpacity={1}
                  fill="url(#colorChunks)"
                />
                <Area
                  type="monotone"
                  dataKey="latencyMs"
                  name="Avg Latency (ms)"
                  stroke="#737373"
                  fillOpacity={0.3}
                  fill="#a3a3a3"
                />
              </AreaChart>
            </ClientResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Operations */}
      <div className="bg-white rounded-xl border border-primary-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary-900">Recent Operations</h3>
          <div className="flex items-center gap-2 text-sm text-primary-500">
            <History className="w-4 h-4" />
            Last 20 operations
          </div>
        </div>

        {operations.length === 0 ? (
          <div className="text-center py-8 text-primary-500">
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No embedding operations recorded yet</p>
            <p className="text-sm mt-1">Upload documents to generate embeddings</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-primary-500">Time</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-primary-500">Document</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-primary-500">Chunks</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-primary-500">Latency</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-primary-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => (
                  <tr
                    key={op.id}
                    className="border-b border-primary-50 hover:bg-primary-50 transition-colors"
                  >
                    <td className="py-2 px-3 text-sm text-primary-600">
                      {formatTimestamp(op.timestamp)}
                    </td>
                    <td className="py-2 px-3 text-sm text-primary-900 font-medium truncate max-w-[200px]">
                      {op.docName}
                    </td>
                    <td className="py-2 px-3 text-sm text-primary-600 text-right">
                      {op.chunkCount}
                    </td>
                    <td className="py-2 px-3 text-sm text-primary-600 text-right">
                      {formatLatency(op.latencyMs)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {op.success ? (
                        <CheckCircle2 className="w-4 h-4 text-sa-green inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Technical Info */}
      <div className="bg-primary-50 rounded-xl border border-primary-200 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-primary-600">
            <p className="font-medium mb-1">VCB-AI Micro Embedding Model</p>
            <ul className="text-xs space-y-1 text-primary-500">
              <li>• Based on E5-small-v2 architecture (intfloat/e5-small-v2)</li>
              <li>• Optimized 8-bit quantization for browser execution</li>
              <li>• {modelInfo.backend === 'webgpu' ? 'WebGPU accelerated' : 'WASM fallback'} inference</li>
              <li>• Generates 384-dimensional vectors for semantic similarity</li>
              <li>• Used by JIVE & JIGGA tiers for RAG document search</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddingMonitor;
