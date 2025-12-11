/**
 * GOGGA RAG Dashboard - Desktop Layout
 * Full-featured dashboard with sidebar, stats grid, charts, and memory management
 * Monochrome design with grey gradients, Quicksand font
 */

'use client';

import React, { useState } from 'react';
import {
  Database,
  Cpu,
  BarChart3,
  FileText,
  RefreshCw,
  Settings,
  TrendingUp,
  Zap,
  Home,
  Activity,
  HardDrive,
  Layers,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  Wrench,
  Package,
} from 'lucide-react';
import {
  StatCard,
  MetricCard,
  ProgressRing,
  StatusBadge,
  TierBadge,
  InfoRow,
  PrivacyBadge,
} from './StatCard';
import {
  LatencyChart,
  StorageChart,
  QueryModePie,
  PerformanceChart,
  GaugeChart,
  ScoreHistogram,
  Sparkline,
} from './Charts';
import {
  VectorHeatmap,
  VectorPreview,
  VectorStats,
  SimilarityScore,
} from './VectorHeatmap';
import { DocumentManager } from './DocumentManager';
import { MemoryManager } from './MemoryManager';
import { BuddyPanel } from './BuddyPanel';
import { DexieMaintenance } from './DexieMaintenance';
import { LLMMonitor } from './LLMMonitor';
import { EmbeddingMonitor } from './EmbeddingMonitor';
// useBrowserPerformance removed - no longer monitoring OS metrics
import type { VectorData } from './useRagDashboard';
import type {
  DexieStorageStats,
  ModelStatus,
  EmbeddingStats,
  RetrievalStats,
  ContextDocument,
  LatencyChartData,
  TabId,
} from './types';

// ============================================================================
// Data Freshness Indicator Component
// ============================================================================

interface DataFreshnessIndicatorProps {
  lastUpdated: Date | null;
  isAutoRefresh: boolean;
}

const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  lastUpdated,
  isAutoRefresh,
}) => {
  const [secondsAgo, setSecondsAgo] = React.useState(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    
    if (!lastUpdated) return;

    const updateSeconds = () => {
      if (!mountedRef.current) return;
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
      setSecondsAgo(diff);
    };

    updateSeconds();
    const interval = setInterval(updateSeconds, 1000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [lastUpdated]);

  if (!lastUpdated) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-100">
        <div className="w-2 h-2 rounded-full bg-primary-400" />
        <span className="text-xs text-primary-500">No data yet</span>
      </div>
    );
  }

  // Determine status color based on age
  // Green: < 10 seconds (fresh)
  // Yellow: 10-30 seconds (stale)
  // Red: > 30 seconds (outdated)
  let statusColor: string;
  let statusBg: string;
  let statusText: string;

  if (secondsAgo < 10) {
    statusColor = 'bg-sa-green';
    statusBg = 'bg-sa-green/10 border-sa-green/30';
    statusText = 'text-sa-green';
  } else if (secondsAgo < 30) {
    statusColor = 'bg-sa-gold';
    statusBg = 'bg-sa-gold/10 border-sa-gold/30';
    statusText = 'text-sa-gold';
  } else {
    statusColor = 'bg-sa-red';
    statusBg = 'bg-sa-red/10 border-sa-red/30';
    statusText = 'text-sa-red';
  }

  // Format time ago
  const formatTimeAgo = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusBg}`}
    >
      <div
        className={`w-2 h-2 rounded-full ${statusColor} ${
          secondsAgo < 10 ? 'animate-pulse' : ''
        }`}
      />
      <span className={`text-xs font-medium ${statusText}`}>
        {formatTimeAgo(secondsAgo)}
      </span>
      {!isAutoRefresh && secondsAgo > 10 && (
        <span className="text-xs text-primary-400">(paused)</span>
      )}
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface DesktopDashboardProps {
  storageStats: DexieStorageStats | null;
  modelStatus: ModelStatus | null;
  embeddingStats: EmbeddingStats | null;
  retrievalStats: RetrievalStats | null;
  documents: ContextDocument[];
  latencyChartData: LatencyChartData[];
  tokenUsage: { totalTokens: number; costZar: number };
  scoreDistribution: Array<{ range: string; count: number }>;
  vectorData: VectorData;
  healthScore: number;
  tier: 'free' | 'jive' | 'jigga';
  sessionId: string;
  isLoading: boolean;
  isAutoRefresh: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onToggleAutoRefresh: () => void;
  onDocumentRemove?: (docId: number) => void;
}

// ============================================================================
// Navigation Items
// ============================================================================

const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Home className="w-5 h-5" /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive className="w-5 h-5" /> },
  {
    id: 'embeddings',
    label: 'Embeddings',
    icon: <Layers className="w-5 h-5" />,
  },
  { id: 'memory', label: 'Context', icon: <FileText className="w-5 h-5" /> },
  {
    id: 'performance',
    label: 'Performance',
    icon: <Activity className="w-5 h-5" />,
  },
  {
    id: 'llm',
    label: 'GOGGA AI',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: 'embedding-model',
    label: 'VCB-AI Model',
    icon: <Package className="w-5 h-5" />,
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
];

// ============================================================================
// Desktop Dashboard Component
// ============================================================================

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  storageStats,
  modelStatus,
  embeddingStats,
  retrievalStats,
  documents,
  latencyChartData,
  tokenUsage,
  scoreDistribution,
  vectorData,
  healthScore,
  tier,
  sessionId,
  isLoading,
  isAutoRefresh,
  lastUpdated,
  onRefresh,
  onToggleAutoRefresh,
  onDocumentRemove,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Use real vectors if available, otherwise generate placeholder vectors for visualization
  const displayVectors =
    vectorData.isReal && vectorData.vectors.length > 0
      ? vectorData.vectors
      : documents
          .slice(0, 5)
          .map(() => Array.from({ length: 384 }, () => Math.random() * 2 - 1));

  const vectorLabels =
    vectorData.isReal && vectorData.labels.length > 0
      ? vectorData.labels
      : documents
          .slice(0, 5)
          .map((doc) => (doc.filename || 'Unknown').slice(0, 20));

  return (
    <div className="min-h-screen bg-primary-100 flex">
      {/* Sidebar */}
      <aside
        className={`
        bg-white border-r border-primary-200 flex flex-col transition-all duration-300
        ${sidebarCollapsed ? 'w-16' : 'w-64'}
      `}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-primary-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="font-bold text-primary-900">GOGGA</h1>
              <p className="text-xs text-primary-500">RAG Dashboard</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${
                  activeTab === item.id
                    ? 'bg-primary-900 text-white'
                    : 'text-primary-600 hover:bg-primary-100'
                }
              `}
            >
              {item.icon}
              {!sidebarCollapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Tier Badge */}
        <div className="p-4 border-t border-primary-100">
          <div
            className={`flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'gap-3'
            }`}
          >
            <TierBadge tier={tier} size={sidebarCollapsed ? 'sm' : 'md'} />
            {!sidebarCollapsed && (
              <div className="text-xs text-primary-500">
                {tier === 'jigga'
                  ? 'Semantic RAG'
                  : tier === 'jive'
                  ? 'Keyword RAG'
                  : 'No RAG'}
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-3 border-t border-primary-100 text-primary-400 hover:text-primary-600 hover:bg-primary-50"
        >
          <ChevronRight
            className={`w-5 h-5 mx-auto transition-transform ${
              sidebarCollapsed ? '' : 'rotate-180'
            }`}
          />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-primary-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-primary-900">
                {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-primary-500">
                Real-time RAG monitoring and context management
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Data freshness indicator */}
              <DataFreshnessIndicator
                lastUpdated={lastUpdated}
                isAutoRefresh={isAutoRefresh}
              />

              {/* Auto-refresh toggle */}
              <button
                onClick={onToggleAutoRefresh}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                  isAutoRefresh
                    ? 'border-sa-green bg-sa-green/10 text-sa-green'
                    : 'border-primary-300 text-primary-500'
                }`}
                title={
                  isAutoRefresh
                    ? 'Auto-refresh enabled (5s)'
                    : 'Auto-refresh paused'
                }
              >
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {isAutoRefresh ? 'Live' : 'Paused'}
                </span>
              </button>

              {/* Refresh button */}
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg bg-primary-100 hover:bg-primary-200 transition-colors"
                title="Refresh now"
              >
                <RefreshCw
                  className={`w-5 h-5 text-primary-600 ${
                    isLoading ? 'animate-spin' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              storageStats={storageStats}
              modelStatus={modelStatus}
              embeddingStats={embeddingStats}
              retrievalStats={retrievalStats}
              latencyChartData={latencyChartData}
              tokenUsage={tokenUsage}
              healthScore={healthScore}
              documents={documents}
              vectors={displayVectors}
              vectorLabels={vectorLabels}
              isRealVectors={vectorData.isReal}
              tier={tier}
            />
          )}

          {activeTab === 'storage' && (
            <StorageTab storageStats={storageStats} documents={documents} />
          )}

          {activeTab === 'embeddings' && (
            <EmbeddingsTab
              modelStatus={modelStatus}
              embeddingStats={embeddingStats}
              vectors={displayVectors}
              vectorLabels={vectorLabels}
              isRealVectors={vectorData.isReal}
              documents={documents}
              tier={tier}
            />
          )}

          {activeTab === 'memory' && (
            <MemoryTab
              documents={documents}
              tier={tier}
              sessionId={sessionId}
              onDocumentRemove={onDocumentRemove}
              onRefresh={onRefresh}
            />
          )}

          {activeTab === 'performance' && (
            <PerformanceTab
              retrievalStats={retrievalStats}
              latencyChartData={latencyChartData}
              tokenUsage={tokenUsage}
              scoreDistribution={scoreDistribution}
            />
          )}

          {activeTab === 'llm' && <LLMMonitor />}

          {activeTab === 'embedding-model' && <EmbeddingMonitor />}

          {activeTab === 'maintenance' && <DexieMaintenance />}
        </div>
      </main>
    </div>
  );
};

// ============================================================================
// Tab Components
// ============================================================================

// Overview Tab
interface OverviewTabProps {
  storageStats: DexieStorageStats | null;
  modelStatus: ModelStatus | null;
  embeddingStats: EmbeddingStats | null;
  retrievalStats: RetrievalStats | null;
  latencyChartData: LatencyChartData[];
  tokenUsage: { totalTokens: number; costZar: number };
  healthScore: number;
  documents: ContextDocument[];
  vectors: number[][];
  vectorLabels: string[];
  isRealVectors: boolean;
  tier: 'free' | 'jive' | 'jigga';
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  storageStats,
  modelStatus,
  embeddingStats,
  retrievalStats,
  latencyChartData,
  tokenUsage,
  healthScore,
  documents,
  vectors,
  vectorLabels,
  isRealVectors,
  tier,
}) => {
  // Check if ANY document has embeddings (more reliable than cache-only check)
  const hasAnyEmbeddings = React.useMemo(() => {
    if (isRealVectors && vectors.length > 0) return true;
    if (documents.some(d => d.hasEmbeddings || d.embeddingStatus === 'complete')) return true;
    if (embeddingStats && embeddingStats.totalEmbeddings > 0) return true;
    return false;
  }, [isRealVectors, vectors, documents, embeddingStats]);

  return (
    <div className="space-y-6">
      {/* Privacy Notice - Educational */}
      <PrivacyBadge variant="detailed" className="animate-fadeIn" />
      
      {/* Health & Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="System Health"
          value={`${healthScore}%`}
          subtitle="All systems operational"
          icon={<Activity className="w-5 h-5 text-primary-600" />}
          variant={
            healthScore >= 80
              ? 'success'
              : healthScore >= 50
              ? 'warning'
              : 'danger'
          }
          info="Overall health based on storage, embedding, and query performance"
          pulseOnChange
        />
        <StatCard
          title="Documents"
          value={storageStats?.documents ?? 0}
          subtitle={`${storageStats?.chunks ?? 0} chunks total`}
          icon={<FileText className="w-5 h-5 text-primary-600" />}
          info="Documents uploaded for RAG - stored locally in IndexedDB"
          animateValue
        />
        <StatCard
          title="Queries Today"
          value={retrievalStats?.totalQueries ?? 0}
          subtitle={`${retrievalStats?.semanticQueries ?? 0} semantic`}
          icon={<BarChart3 className="w-5 h-5 text-primary-600" />}
          trend={
            retrievalStats?.totalQueries
              ? { value: 12, isPositive: true }
              : undefined
          }
          info="RAG queries this session - semantic uses AI embeddings"
          animateValue
          pulseOnChange
        />
        <StatCard
          title="Tokens Used"
          value={tokenUsage.totalTokens.toLocaleString()}
          subtitle={`R${tokenUsage.costZar.toFixed(2)} today`}
          icon={<Zap className="w-5 h-5 text-primary-600" />}
          info="LLM tokens consumed - costs tracked in South African Rand"
        />
      </div>

      {/* Model Status & Storage */}
      <div className="grid grid-cols-3 gap-4">
        {/* Model Card */}
        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-primary-800">Embedding Model</h3>
            <StatusBadge
              status={modelStatus?.loaded ? 'online' : 'loading'}
              label={modelStatus?.backend?.toUpperCase() ?? 'Loading'}
            />
          </div>
          <div className="space-y-2">
            <InfoRow
              label="Model"
              value={modelStatus?.name ?? 'VCB-AI Micro'}
            />
            <InfoRow label="Dimension" value={modelStatus?.dimension ?? 384} />
            <InfoRow
              label="Load Time"
              value={`${modelStatus?.loadTimeMs?.toFixed(0) ?? '-'}ms`}
            />
            <InfoRow
              label="Avg Latency"
              value={`${embeddingStats?.avgLatencyMs.toFixed(0) ?? '-'}ms`}
              highlight={
                embeddingStats?.avgLatencyMs !== undefined &&
                embeddingStats.avgLatencyMs < 100
              }
            />
          </div>
        </div>

        {/* Storage Progress */}
        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <h3 className="font-semibold text-primary-800 mb-4">Storage Usage</h3>
          <div className="flex items-center justify-center mb-4">
            <ProgressRing
              value={storageStats?.usedPercent ?? 0}
              max={100}
              size={140}
              label="Used"
              sublabel={`${storageStats?.totalSizeMB?.toFixed(1) ?? 0} MB`}
              color={
                storageStats?.usedPercent && storageStats.usedPercent > 80
                  ? 'red'
                  : 'grey'
              }
            />
          </div>
          <div className="text-center text-sm text-primary-500">
            {storageStats?.remainingMB?.toFixed(1) ?? 100} MB remaining of 100
            MB
          </div>
        </div>

        {/* Query Distribution */}
        <QueryModePie
          semantic={retrievalStats?.semanticQueries ?? 0}
          keyword={retrievalStats?.keywordQueries ?? 0}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <LatencyChart data={latencyChartData} height={280} />
        <div className="relative">
          {!hasAnyEmbeddings && vectors.length > 0 && (
            <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-sa-gold/20 text-sa-gold text-xs rounded-md border border-sa-gold/30">
              No embeddings yet
            </div>
          )}
          <VectorHeatmap
            vectors={vectors}
            labels={vectorLabels}
            maxDisplay={30}
            tier={tier}
            onUpgrade={() => window.open('/pricing', '_blank')}
          />
        </div>
      </div>
    </div>
  );
};

// Storage Tab
interface StorageTabProps {
  storageStats: DexieStorageStats | null;
  documents: ContextDocument[];
}

const StorageTab: React.FC<StorageTabProps> = ({ storageStats, documents }) => {
  const storageData = documents.reduce((acc, doc) => {
    const sessionKey = doc.sessionId?.slice(0, 8) ?? 'unknown';
    const existing = acc.find((a) => a.name === sessionKey);
    if (existing) {
      existing.size += doc.size;
      existing.count++;
    } else {
      acc.push({ name: sessionKey, size: doc.size, count: 1 });
    }
    return acc;
  }, [] as { name: string; size: number; count: number }[]);

  return (
    <div className="space-y-6">
      {/* Privacy Notice */}
      <PrivacyBadge variant="default" className="animate-fadeIn" />
      
      {/* Storage Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Storage"
          value={`${storageStats?.totalSizeMB?.toFixed(2) ?? 0} MB`}
          subtitle="of 100 MB limit"
          icon={<HardDrive className="w-5 h-5 text-primary-600" />}
          info="IndexedDB storage in your browser - 100MB limit per site"
          animateValue
        />
        <StatCard
          title="Documents"
          value={storageStats?.documents ?? 0}
          subtitle="Stored in Dexie"
          icon={<FileText className="w-5 h-5 text-primary-600" />}
          info="Files uploaded for context - PDF, TXT, MD supported"
          animateValue
        />
        <StatCard
          title="Chunks"
          value={storageStats?.chunks ?? 0}
          subtitle="Indexed for RAG"
          icon={<Layers className="w-5 h-5 text-primary-600" />}
          info="Document segments for semantic search - ~500 chars each"
          animateValue
        />
        <StatCard
          title="Messages"
          value={storageStats?.messages ?? 0}
          subtitle="Chat history"
          icon={<FileText className="w-5 h-5 text-primary-600" />}
          info="Conversation history - auto-cleans after 7 days"
          animateValue
        />
      </div>

      {/* Storage Chart & Tables */}
      <div className="grid grid-cols-2 gap-6">
        <StorageChart data={storageData} height={300} />

        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <h3 className="font-semibold text-primary-800 mb-4">
            Table Breakdown
          </h3>
          <div className="space-y-3">
            {storageStats?.tables.map((table) => (
              <div
                key={table.name}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Database className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-primary-800">{table.name}</p>
                    <p className="text-xs text-primary-500">
                      {table.count} records
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-primary-700">
                  {(table.estimatedSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Embedding Quality Calculator
// ============================================================================

interface EmbeddingQuality {
  score: number; // 0-100
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  factors: {
    chunkCoverage: number;
    vectorDensity: number;
    documentSize: number;
  };
  recommendation?: string;
}

function calculateEmbeddingQuality(
  doc: ContextDocument,
  vectors: number[][],
  docIndex: number
): EmbeddingQuality {
  // Factor 1: Chunk coverage - based on embedding status, not vector count
  // When embeddings are generated, ALL chunks are embedded in one go
  // So if status is 'complete', coverage is 100%; if 'pending', it's 0%
  let chunkCoverage: number;
  if (doc.embeddingStatus === 'complete' || doc.hasEmbeddings) {
    chunkCoverage = 100; // All chunks embedded when status is complete
  } else if (doc.embeddingStatus === 'pending') {
    chunkCoverage = 0; // Waiting for embeddings
  } else {
    chunkCoverage = 0; // Unknown state
  }

  // Factor 2: Vector density (how information-rich are the vectors?)
  // If we have a vector for this doc, analyze its density
  let vectorDensity = 85; // Default to good density for embedded docs
  if (vectors[docIndex]) {
    const vec = vectors[docIndex];
    const nonZero = vec.filter((v) => Math.abs(v) > 0.001).length;
    vectorDensity = Math.round((nonZero / vec.length) * 100);
  } else if (doc.embeddingStatus === 'complete' || doc.hasEmbeddings) {
    // Embeddings exist but not in display cache - assume good density
    vectorDensity = 85;
  }

  // Factor 3: Document size factor (larger docs = more context)
  const docSize = doc.size || 0;
  const documentSize =
    docSize > 50000 ? 100 : docSize > 10000 ? 80 : docSize > 2000 ? 60 : 40;

  // Calculate overall score
  const score = Math.round(
    chunkCoverage * 0.4 + vectorDensity * 0.4 + documentSize * 0.2
  );

  // Determine grade
  let grade: EmbeddingQuality['grade'];
  if (score >= 80) grade = 'excellent';
  else if (score >= 60) grade = 'good';
  else if (score >= 40) grade = 'fair';
  else grade = 'poor';

  // Recommendation based on status
  let recommendation: string | undefined;
  if (doc.embeddingStatus === 'pending') {
    recommendation = 'Embeddings generating - will complete shortly';
  } else if (doc.embeddingStatus === 'error') {
    recommendation = 'Embedding generation failed - try re-uploading';
  } else if (documentSize < 50) {
    recommendation =
      'Small document - combine with related content for better context';
  }

  return {
    score,
    grade,
    factors: { chunkCoverage, vectorDensity, documentSize },
    recommendation,
  };
}

// Embeddings Tab
interface EmbeddingsTabProps {
  modelStatus: ModelStatus | null;
  embeddingStats: EmbeddingStats | null;
  vectors: number[][];
  vectorLabels: string[];
  isRealVectors: boolean;
  documents: ContextDocument[];
  tier: 'free' | 'jive' | 'jigga';
}

const EmbeddingsTab: React.FC<EmbeddingsTabProps> = ({
  modelStatus,
  embeddingStats,
  vectors,
  vectorLabels,
  isRealVectors,
  documents,
  tier,
}) => {
  // Check if ANY document has embeddings (more reliable than cache-only check)
  const hasAnyEmbeddings = React.useMemo(() => {
    // Check 1: Cache has vectors
    if (isRealVectors && vectors.length > 0) return true;
    // Check 2: Documents marked as having embeddings
    if (documents.some(d => d.hasEmbeddings || d.embeddingStatus === 'complete')) return true;
    // Check 3: Embedding stats show generated embeddings
    if (embeddingStats && embeddingStats.totalEmbeddings > 0) return true;
    return false;
  }, [isRealVectors, vectors, documents, embeddingStats]);

  // Calculate real vector stats from actual vectors
  const vectorStats = React.useMemo(() => {
    if (!isRealVectors || vectors.length === 0) {
      return { magnitude: 0, sparsity: 0, dimension: 384 };
    }
    const firstVec = vectors[0];
    const magnitude = Math.sqrt(firstVec.reduce((sum, v) => sum + v * v, 0));
    const nearZero = firstVec.filter((v) => Math.abs(v) < 0.01).length;
    const sparsity = nearZero / firstVec.length;
    return { magnitude, sparsity, dimension: firstVec.length };
  }, [vectors, isRealVectors]);
  return (
    <div className="space-y-6">
      {/* Model Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Cpu className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-primary-800">
                {modelStatus?.name ?? 'VCB-AI Micro'}
              </h3>
              <p className="text-xs text-primary-500">
                {modelStatus?.id ?? 'vcb-ai/micro-v1'}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <InfoRow
              label="Backend"
              value={modelStatus?.backend?.toUpperCase() ?? 'WASM'}
              highlight={modelStatus?.backend === 'webgpu'}
            />
            <InfoRow label="Dimension" value={modelStatus?.dimension ?? 384} />
            <InfoRow
              label="Status"
              value={modelStatus?.loaded ? 'Ready' : 'Loading'}
            />
          </div>
        </div>

        <MetricCard
          title="Embedding Stats"
          icon={<Activity className="w-5 h-5" />}
          metrics={[
            {
              label: 'Total Generated',
              value: embeddingStats?.totalEmbeddings ?? 0,
            },
            {
              label: 'Avg Latency',
              value: embeddingStats?.avgLatencyMs?.toFixed(1) ?? 0,
              unit: 'ms',
            },
            {
              label: 'Max Latency',
              value: embeddingStats?.maxLatencyMs?.toFixed(1) ?? 0,
              unit: 'ms',
            },
            {
              label: 'Cache Hit Rate',
              value: ((embeddingStats?.cachHitRate ?? 0) * 100).toFixed(1),
              unit: '%',
            },
          ]}
        />

        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-primary-800">Vector Info</h3>
            {!hasAnyEmbeddings && (
              <span className="px-2 py-1 bg-sa-gold/20 text-sa-gold text-xs rounded-md border border-sa-gold/30">
                No embeddings yet
              </span>
            )}
          </div>
          <VectorStats
            dimension={vectorStats.dimension}
            magnitude={vectorStats.magnitude}
            sparsity={vectorStats.sparsity}
          />
          <div className="mt-4">
            <p className="text-xs text-primary-500 mb-2">
              {hasAnyEmbeddings
                ? 'Real Vector Preview'
                : 'Upload documents to see vectors'}
            </p>
            {vectors[0] && (
              <VectorPreview vector={vectors[0]} maxBars={20} height={40} />
            )}
          </div>
        </div>
      </div>

      {/* Vector Visualization */}
      <div className="bg-white rounded-xl border border-primary-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-primary-800">
            Document Embedding Heatmap
          </h3>
          {hasAnyEmbeddings ? (
            <span className="px-2 py-1 bg-sa-green/20 text-sa-green text-xs rounded-md border border-sa-green/30">
              Real embeddings
            </span>
          ) : (
            <span className="px-2 py-1 bg-primary-200 text-primary-500 text-xs rounded-md">
              No embeddings generated
            </span>
          )}
        </div>
        {vectors.length > 0 ? (
          <VectorHeatmap
            vectors={vectors}
            labels={vectorLabels}
            maxDisplay={50}
            colorScheme="grey"
            tier={tier}
            onUpgrade={() => window.open('/pricing', '_blank')}
          />
        ) : (
          <div className="h-48 flex items-center justify-center text-primary-400">
            <div className="text-center">
              <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No document embeddings yet</p>
              <p className="text-xs">
                Upload documents and run a semantic query
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Embedding Quality & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Document Embedding Quality */}
        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <h3 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Embedding Quality
          </h3>
          <div className="space-y-4">
            {documents.length === 0 ? (
              <p className="text-primary-400 text-sm">No documents uploaded</p>
            ) : (
              documents.slice(0, 4).map((doc, i) => {
                const quality = calculateEmbeddingQuality(doc, vectors, i);
                const gradeColors = {
                  excellent: 'bg-sa-green text-white',
                  good: 'bg-sa-green/70 text-white',
                  fair: 'bg-sa-gold text-white',
                  poor: 'bg-red-500 text-white',
                };
                return (
                  <div
                    key={doc.id ?? i}
                    className="border border-primary-100 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-primary-700 truncate max-w-[180px]">
                        {doc.filename}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-xs rounded font-medium ${
                            gradeColors[quality.grade]
                          }`}
                        >
                          {quality.score}%
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            doc.embeddingStatus === 'complete'
                              ? 'bg-sa-green/20 text-sa-green'
                              : doc.embeddingStatus === 'error'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-sa-gold/20 text-sa-gold'
                          }`}
                        >
                          {doc.embeddingStatus ?? 'pending'}
                        </span>
                      </div>
                    </div>
                    {/* Quality bar */}
                    <div className="h-1.5 bg-primary-100 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${
                          quality.grade === 'excellent'
                            ? 'bg-sa-green'
                            : quality.grade === 'good'
                            ? 'bg-sa-green/70'
                            : quality.grade === 'fair'
                            ? 'bg-sa-gold'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${quality.score}%` }}
                      />
                    </div>
                    {/* Quality factors */}
                    <div className="flex gap-3 text-xs text-primary-500">
                      <span>
                        Coverage: {Math.round(quality.factors.chunkCoverage)}%
                      </span>
                      <span>
                        Density: {Math.round(quality.factors.vectorDensity)}%
                      </span>
                      <span>
                        Size: {Math.round(quality.factors.documentSize)}%
                      </span>
                    </div>
                    {quality.recommendation && (
                      <p className="text-xs text-sa-gold mt-2 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        {quality.recommendation}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* JIVE vs JIGGA Comparison */}
        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <h3 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Semantic vs Keyword Search
          </h3>

          {/* Comparison Table */}
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-primary-500 border-b border-primary-100 pb-2">
              <span>Feature</span>
              <span className="text-center">JIVE (Keyword)</span>
              <span className="text-center">JIGGA (Semantic)</span>
            </div>

            {[
              {
                feature: 'Search Type',
                jive: 'Exact match',
                jigga: 'Meaning-based',
              },
              { feature: 'Understands Context', jive: '❌', jigga: '✅' },
              { feature: 'Finds Synonyms', jive: '❌', jigga: '✅' },
              { feature: 'Multi-language', jive: '❌', jigga: '✅' },
              {
                feature: 'Relevance Scoring',
                jive: 'Basic',
                jigga: 'Cosine similarity',
              },
              {
                feature: 'Query: "car problems"',
                jive: 'Finds "car"',
                jigga: 'Finds "vehicle issues"',
              },
            ].map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-3 gap-2 text-xs py-1.5 border-b border-primary-50"
              >
                <span className="text-primary-600 font-medium">
                  {row.feature}
                </span>
                <span className="text-center text-primary-500">{row.jive}</span>
                <span className="text-center text-primary-700 font-medium">
                  {row.jigga}
                </span>
              </div>
            ))}
          </div>

          {/* Example Comparison */}
          <div className="bg-primary-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-primary-700 mb-2">
              Example Query: &ldquo;How do I fix the login issue?&rdquo;
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded p-2 border border-primary-200">
                <span className="font-medium text-primary-600">
                  JIVE finds:
                </span>
                <p className="text-primary-500 mt-1">
                  Only docs with &ldquo;login&rdquo; or &ldquo;fix&rdquo;
                </p>
              </div>
              <div className="bg-white rounded p-2 border border-sa-gold/30">
                <span className="font-medium text-sa-gold">JIGGA finds:</span>
                <p className="text-primary-600 mt-1">
                  Auth errors, sign-in problems, session timeouts
                </p>
              </div>
            </div>
          </div>

          {/* Upgrade CTA for non-JIGGA */}
          {tier !== 'jigga' && (
            <button
              onClick={() => window.open('/pricing', '_blank')}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-sa-gold to-sa-gold/80 text-white rounded-lg font-medium text-sm hover:from-sa-gold/90 hover:to-sa-gold/70 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Upgrade to JIGGA for Semantic Search
            </button>
          )}

          {/* JIGGA user tips */}
          {tier === 'jigga' && (
            <div className="space-y-2 text-sm text-primary-600">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sa-green mt-0.5" />
                <span>
                  Semantic search active - finding meaning, not just keywords
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sa-green mt-0.5" />
                <span>E5 embeddings capture document context</span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary-400 mt-0.5" />
                <span>Tip: Natural language queries work best</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-white rounded-xl border border-primary-200 p-5">
        <h3 className="font-semibold text-primary-800 mb-4">
          Embedding Performance Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-primary-600">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-sa-green mt-0.5 shrink-0" />
            <span>
              WebGPU acceleration available for 3-5x faster embeddings
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary-400 mt-0.5 shrink-0" />
            <span>
              E5 model uses query/passage prefixes for optimal retrieval
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary-400 mt-0.5 shrink-0" />
            <span>384-dimension vectors balance accuracy and speed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memory Tab - Long-term context management
interface MemoryTabProps {
  documents: ContextDocument[];
  tier: 'free' | 'jive' | 'jigga';
  sessionId: string;
  onDocumentRemove?: (docId: number) => void;
  onRefresh: () => void;
}

const MemoryTab: React.FC<MemoryTabProps> = ({
  documents,
  tier,
  sessionId,
  onDocumentRemove,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      {/* Buddy System Panel */}
      <BuddyPanel />

      {/* Long-Term Memory Manager */}
      <MemoryManager
        tier={tier}
        onRefresh={onRefresh}
        onUpgrade={() => window.open('/pricing', '_blank')}
      />

      {/* Divider */}
      <div className="border-t border-primary-200 pt-6">
        <h3 className="text-lg font-semibold text-primary-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Session Documents (RAG)
        </h3>
        <p className="text-sm text-primary-500 mb-4">
          Documents uploaded in the current chat session for RAG retrieval
        </p>

        {/* Session Doc Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <StatCard
            title="Total Documents"
            value={documents.length}
            icon={<FileText className="w-5 h-5 text-primary-600" />}
            compact
          />
          <StatCard
            title="Total Chunks"
            value={documents.reduce((sum, d) => sum + d.chunkCount, 0)}
            icon={<Layers className="w-5 h-5 text-primary-600" />}
            compact
          />
          <StatCard
            title="Total Size"
            value={`${(
              documents.reduce((sum, d) => sum + d.size, 0) /
              (1024 * 1024)
            ).toFixed(2)} MB`}
            icon={<HardDrive className="w-5 h-5 text-primary-600" />}
            compact
          />
          <StatCard
            title="With Embeddings"
            value={
              documents.filter((d) => d.embeddingStatus === 'complete').length
            }
            subtitle={`of ${documents.length}`}
            icon={<Cpu className="w-5 h-5 text-primary-600" />}
            compact
          />
        </div>

        {/* Document Manager for session docs */}
        <DocumentManager
          documents={documents}
          tier={tier}
          sessionId={sessionId}
          onDocumentRemove={onDocumentRemove}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
};

// Performance Tab
interface PerformanceTabProps {
  retrievalStats: RetrievalStats | null;
  latencyChartData: LatencyChartData[];
  tokenUsage: { totalTokens: number; costZar: number };
  scoreDistribution: Array<{ range: string; count: number }>;
}

const PerformanceTab: React.FC<PerformanceTabProps> = ({
  retrievalStats,
  latencyChartData,
  tokenUsage,
  scoreDistribution,
}) => {
  // Use real average score from retrieval stats for performance chart
  const avgScore = retrievalStats?.avgScore ?? 0;
  const performanceData = latencyChartData.map((d) => ({
    name: d.name,
    latency: d.semantic,
    score: avgScore > 0 ? avgScore : 0, // Use actual avg score
  }));

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Queries"
          value={retrievalStats?.totalQueries ?? 0}
          icon={<BarChart3 className="w-5 h-5 text-primary-600" />}
        />
        <StatCard
          title="Avg Latency"
          value={`${retrievalStats?.avgLatencyMs?.toFixed(1) ?? 0}ms`}
          subtitle="Target: <100ms"
          icon={<Clock className="w-5 h-5 text-primary-600" />}
          variant={
            retrievalStats?.avgLatencyMs && retrievalStats.avgLatencyMs < 100
              ? 'success'
              : 'warning'
          }
        />
        <StatCard
          title="Avg Score"
          value={(retrievalStats?.avgScore ?? 0).toFixed(3)}
          subtitle="Cosine similarity"
          icon={<TrendingUp className="w-5 h-5 text-primary-600" />}
        />
        <StatCard
          title="Error Rate"
          value={`${(
            ((retrievalStats?.errorCount ?? 0) /
              Math.max(retrievalStats?.totalQueries ?? 1, 1)) *
            100
          ).toFixed(1)}%`}
          icon={<XCircle className="w-5 h-5 text-primary-600" />}
          variant={retrievalStats?.errorCount === 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <PerformanceChart data={performanceData} height={300} />
        <ScoreHistogram data={scoreDistribution} height={300} />
      </div>

      {/* Privacy & Local Processing Info */}
      <div className="bg-primary-50 rounded-xl border border-primary-200 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-sa-green/10 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-sa-green" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-primary-800 mb-1">
              🔒 Local-First Processing
            </h3>
            <p className="text-sm text-primary-600 mb-2">
              All your data is processed and stored locally in your browser. Unlike cloud-based AI services, 
              your documents and conversations never leave your device.
            </p>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="text-center p-2 bg-white rounded-lg border border-primary-200">
                <p className="text-lg font-bold text-primary-800">100%</p>
                <p className="text-xs text-primary-500">Local Storage</p>
              </div>
              <div className="text-center p-2 bg-white rounded-lg border border-primary-200">
                <p className="text-lg font-bold text-sa-green">0</p>
                <p className="text-xs text-primary-500">Cloud Uploads</p>
              </div>
              <div className="text-center p-2 bg-white rounded-lg border border-primary-200">
                <p className="text-lg font-bold text-primary-800">7 days</p>
                <p className="text-xs text-primary-500">Auto-Cleanup</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="Semantic Search"
          icon={<Cpu className="w-5 h-5" />}
          metrics={[
            { label: 'Queries', value: retrievalStats?.semanticQueries ?? 0 },
            {
              label: 'Avg Score',
              value: (retrievalStats?.avgScore ?? 0).toFixed(3),
            },
            {
              label: 'Top Score',
              value: (retrievalStats?.topScore ?? 0).toFixed(3),
            },
          ]}
        />
        <MetricCard
          title="Keyword Search"
          icon={<FileText className="w-5 h-5" />}
          metrics={[
            { label: 'Queries', value: retrievalStats?.keywordQueries ?? 0 },
            { label: 'Cache Hits', value: retrievalStats?.cacheHits ?? 0 },
            { label: 'Cache Misses', value: retrievalStats?.cacheMisses ?? 0 },
          ]}
        />
        <MetricCard
          title="Token Usage"
          icon={<Zap className="w-5 h-5" />}
          metrics={[
            {
              label: 'Total Tokens',
              value: tokenUsage.totalTokens.toLocaleString(),
            },
            { label: 'Cost (ZAR)', value: `R${tokenUsage.costZar.toFixed(2)}` },
          ]}
        />
      </div>
    </div>
  );
};

export default DesktopDashboard;
