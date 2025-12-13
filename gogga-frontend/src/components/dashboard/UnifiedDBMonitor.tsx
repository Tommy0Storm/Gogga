/**
 * GOGGA Unified Database Monitor
 * 
 * Real-time monitoring panel for both RxDB and Dexie databases.
 * Uses RxJS observables for efficient reactive updates.
 * 
 * Features:
 * - Combined storage statistics
 * - Vector database health
 * - Embedding pipeline status
 * - Search performance analytics
 */

'use client';

import React, { useState } from 'react';
import {
  Database,
  Activity,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardDrive,
  Network,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Box,
  Brain,
  Settings,
} from 'lucide-react';

import {
  useUnifiedStorage,
  useVectorMonitoring,
  usePipelineMonitoring,
  useDatabaseHealth,
  useRealTimeMetrics,
} from '@/lib/rxdb/monitoringHooks';

// ============================================================================
// Types
// ============================================================================

interface UnifiedDBMonitorProps {
  className?: string;
  compact?: boolean;
  showDetails?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

const StatusBadge: React.FC<{
  status: 'healthy' | 'degraded' | 'offline' | 'good' | 'warning' | 'critical';
}> = ({ status }) => {
  const config = {
    healthy: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
    good: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
    degraded: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
    warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
    offline: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
    critical: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
  };

  const { bg, text, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  highlight?: boolean;
}> = ({ label, value, sublabel, icon, trend, highlight }) => (
  <div className={`
    p-3 rounded-lg border transition-all duration-200
    ${highlight 
      ? 'border-indigo-200 bg-indigo-50/50' 
      : 'border-primary-200 bg-white hover:border-primary-300'
    }
  `}>
    <div className="flex items-start justify-between mb-1">
      <span className="text-xs text-primary-500">{label}</span>
      <div className="text-primary-400">{icon}</div>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-xl font-bold text-primary-900">{value}</span>
      {sublabel && (
        <span className="text-xs text-primary-400">{sublabel}</span>
      )}
    </div>
    {trend && (
      <div className={`text-xs mt-1 ${
        trend === 'up' ? 'text-green-600' :
        trend === 'down' ? 'text-red-600' :
        'text-primary-400'
      }`}>
        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
      </div>
    )}
  </div>
);

const ProgressBar: React.FC<{
  value: number;
  max: number;
  label?: string;
  colorScheme?: 'default' | 'success' | 'warning' | 'danger';
}> = ({ value, max, label, colorScheme = 'default' }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  const colors = {
    default: 'bg-indigo-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-primary-500">{label}</span>
          <span className="text-primary-700 font-medium">{percentage.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors[colorScheme]}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Section Components
// ============================================================================

const StorageSection: React.FC<{ className?: string }> = ({ className }) => {
  const { stats, isLoading, refresh } = useUnifiedStorage(5000);
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !stats) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-24 bg-primary-100 rounded-lg" />
      </div>
    );
  }

  const storageColorScheme = 
    stats.combined.storageHealth === 'critical' ? 'danger' :
    stats.combined.storageHealth === 'warning' ? 'warning' : 'default';

  return (
    <div className={`bg-white rounded-xl border border-primary-200 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-primary-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Database className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-primary-900">Storage</h3>
            <p className="text-xs text-primary-500">RxDB + IndexedDB combined</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={stats.combined.storageHealth} />
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-primary-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-primary-400" />
          )}
        </div>
      </button>

      {/* Summary (always visible) */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            label="Documents"
            value={stats.combined.totalDocuments}
            icon={<Box className="w-4 h-4" />}
          />
          <MetricCard
            label="Messages"
            value={stats.combined.totalMessages}
            icon={<Activity className="w-4 h-4" />}
          />
          <MetricCard
            label="Vectors"
            value={stats.rxdb.vectors}
            icon={<Layers className="w-4 h-4" />}
          />
          <MetricCard
            label="Total Size"
            value={stats.combined.totalSizeMB.toFixed(1)}
            sublabel="MB"
            icon={<HardDrive className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-primary-100 space-y-4">
          {/* Storage usage bar */}
          <ProgressBar
            value={stats.dexie.usedPercent}
            max={100}
            label="IndexedDB Usage"
            colorScheme={storageColorScheme}
          />

          {/* RxDB vs Dexie breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-primary-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                <span className="text-sm font-medium text-primary-700">RxDB</span>
                {stats.rxdb.isLeader && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    Leader
                  </span>
                )}
              </div>
              <div className="text-xs text-primary-500 space-y-1">
                <div className="flex justify-between">
                  <span>Documents</span>
                  <span className="font-medium text-primary-700">{stats.rxdb.documents}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chunks</span>
                  <span className="font-medium text-primary-700">{stats.rxdb.chunks}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size</span>
                  <span className="font-medium text-primary-700">{stats.rxdb.totalMB.toFixed(1)} MB</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-primary-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-sm font-medium text-primary-700">IndexedDB</span>
              </div>
              <div className="text-xs text-primary-500 space-y-1">
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className="font-medium text-primary-700">{stats.dexie.totalMB.toFixed(1)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining</span>
                  <span className="font-medium text-primary-700">{stats.dexie.remainingMB.toFixed(0)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Utilization</span>
                  <span className="font-medium text-primary-700">{stats.dexie.usedPercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VectorSection: React.FC<{ className?: string }> = ({ className }) => {
  const { state, isLoading, performance, searchHistory } = useVectorMonitoring(10000);
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !state) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-24 bg-primary-100 rounded-lg" />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-primary-200 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-primary-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Layers className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-primary-900">Vector Database</h3>
            <p className="text-xs text-primary-500">E5-small-v2 embeddings ({state.dimensionality}D)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {state.sampleVectorsLoaded ? (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ready</span>
          ) : (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Initializing</span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-primary-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-primary-400" />
          )}
        </div>
      </button>

      {/* Summary */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            label="Vectors"
            value={state.totalVectors}
            icon={<Layers className="w-4 h-4" />}
          />
          <MetricCard
            label="Documents"
            value={state.totalDocuments}
            icon={<Box className="w-4 h-4" />}
          />
          <MetricCard
            label="Avg/Doc"
            value={state.averageVectorsPerDoc.toFixed(1)}
            icon={<Activity className="w-4 h-4" />}
          />
          <MetricCard
            label="Avg Latency"
            value={performance.averageLatency}
            sublabel="ms"
            icon={<Clock className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-primary-100 space-y-4">
          {/* Search Performance */}
          <div className="p-3 bg-primary-50 rounded-lg">
            <h4 className="text-sm font-medium text-primary-700 mb-2">Search Performance</h4>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-primary-500">P95 Latency</span>
                <p className="font-bold text-primary-900">{performance.p95Latency}ms</p>
              </div>
              <div>
                <span className="text-primary-500">Total Searches</span>
                <p className="font-bold text-primary-900">{performance.totalSearches}</p>
              </div>
              <div>
                <span className="text-primary-500">Searches/min</span>
                <p className="font-bold text-primary-900">{performance.searchesPerMinute}</p>
              </div>
            </div>
          </div>

          {/* Recent searches */}
          {searchHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-primary-700 mb-2">Recent Searches</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {searchHistory.slice(0, 5).map((search, i) => (
                  <div key={i} className="flex justify-between text-xs p-2 bg-primary-50 rounded">
                    <span className="text-primary-600 truncate flex-1">{search.results.length} results</span>
                    <span className="text-primary-400">{search.latencyMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PipelineSection: React.FC<{ className?: string }> = ({ className }) => {
  const { state, isRunning, progress, eta } = usePipelineMonitoring();

  return (
    <div className={`bg-white rounded-xl border border-primary-200 overflow-hidden ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isRunning ? 'bg-green-100' : 'bg-primary-100'}`}>
              <Zap className={`w-5 h-5 ${isRunning ? 'text-green-600 animate-pulse' : 'text-primary-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-primary-900">Embedding Pipeline</h3>
              <p className="text-xs text-primary-500">
                {isRunning ? (eta ? `ETA: ${eta}` : 'Processing...') : 'Idle'}
              </p>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isRunning 
              ? 'bg-green-100 text-green-700' 
              : 'bg-primary-100 text-primary-600'
          }`}>
            {isRunning ? 'Active' : 'Idle'}
          </span>
        </div>

        {/* Progress bar */}
        <ProgressBar
          value={progress}
          max={100}
          colorScheme={isRunning ? 'success' : 'default'}
        />

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="text-center p-2 bg-primary-50 rounded">
            <p className="text-lg font-bold text-primary-900">{state.pending}</p>
            <p className="text-xs text-primary-500">Pending</p>
          </div>
          <div className="text-center p-2 bg-primary-50 rounded">
            <p className="text-lg font-bold text-primary-900">{state.processing}</p>
            <p className="text-xs text-primary-500">Processing</p>
          </div>
          <div className="text-center p-2 bg-primary-50 rounded">
            <p className="text-lg font-bold text-green-600">{state.completed}</p>
            <p className="text-xs text-primary-500">Completed</p>
          </div>
          <div className="text-center p-2 bg-primary-50 rounded">
            <p className="text-lg font-bold text-red-600">{state.errors}</p>
            <p className="text-xs text-primary-500">Errors</p>
          </div>
        </div>

        {/* Throughput */}
        {state.throughput > 0 && (
          <div className="mt-3 text-xs text-primary-500 text-center">
            Throughput: <span className="font-medium text-primary-700">{state.throughput} docs/min</span>
          </div>
        )}

        {/* Error message */}
        {state.lastError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {state.lastError}
          </div>
        )}
      </div>
    </div>
  );
};

const HealthSection: React.FC<{ className?: string }> = ({ className }) => {
  const { health, isHealthy, issues, lastCheck } = useDatabaseHealth(15000);

  return (
    <div className={`bg-white rounded-xl border border-primary-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isHealthy ? 'bg-green-100' : 'bg-yellow-100'}`}>
            <Activity className={`w-5 h-5 ${isHealthy ? 'text-green-600' : 'text-yellow-600'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-primary-900">System Health</h3>
            <p className="text-xs text-primary-500">
              {lastCheck ? `Checked ${new Date(lastCheck).toLocaleTimeString()}` : 'Checking...'}
            </p>
          </div>
        </div>
        {health && <StatusBadge status={health.status} />}
      </div>

      {health && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${health.rxdbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-primary-600">RxDB</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${health.dexieConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-primary-600">Dexie</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${health.indexedDBAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-primary-600">IndexedDB</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${health.leaderTabActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-primary-600">Leader Tab</span>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-3 pt-3 border-t border-primary-100">
          <p className="text-xs text-primary-500 mb-1">Issues:</p>
          <ul className="text-xs text-yellow-700 space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const UnifiedDBMonitor: React.FC<UnifiedDBMonitorProps> = ({
  className = '',
  compact = false,
  showDetails = true,
}) => {
  if (compact) {
    // Compact view - single row summary
    return (
      <div className={`flex items-center gap-4 p-3 bg-white rounded-lg border border-primary-200 ${className}`}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-primary-700">DB Monitor</span>
        </div>
        <HealthSection className="flex-1 !p-0 !border-0" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-900 rounded-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary-900">Database Monitor</h2>
            <p className="text-sm text-primary-500">RxDB + Dexie unified monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-primary-500">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Live updates
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <StorageSection />
        <VectorSection />
        <div className="grid grid-cols-2 gap-4">
          <PipelineSection />
          <HealthSection />
        </div>
      </div>
    </div>
  );
};

export default UnifiedDBMonitor;
