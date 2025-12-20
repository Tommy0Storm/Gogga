/**
 * GOGGA RAG Dashboard - Mobile Layout
 * Responsive mobile-first design with collapsible sections
 * Monochrome with grey gradients, Quicksand font
 */

'use client';

import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Database, 
  Cpu, 
  BarChart3, 
  FileText,
  RefreshCw,
  Settings,
  TrendingUp,
  Zap,
  Brain,
} from 'lucide-react';
import { StatCard, MetricCard, ProgressRing, StatusBadge, TierBadge } from './StatCard';
import { LatencyChart, QueryModePie, GaugeChart, Sparkline } from './Charts';
import { VectorPreview } from './VectorHeatmap';
import { DocumentManager, QuickDocList } from './DocumentManager';
import { MemoryManager } from './MemoryManager';
import type { 
  DexieStorageStats, 
  ModelStatus, 
  EmbeddingStats, 
  RetrievalStats,
  ContextDocument,
  LatencyChartData,
} from './types';

// ============================================================================
// Props
// ============================================================================

interface MobileDashboardProps {
  storageStats: DexieStorageStats | null;
  modelStatus: ModelStatus | null;
  embeddingStats: EmbeddingStats | null;
  retrievalStats: RetrievalStats | null;
  documents: ContextDocument[];
  latencyChartData: LatencyChartData[];
  healthScore: number;
  tier: 'free' | 'jive' | 'jigga';
  sessionId: string;
  isLoading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onDocumentRemove?: (docId: string) => void;
}

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-primary-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-primary-500">{icon}</div>
          <span className="font-semibold text-primary-800">{title}</span>
          {badge}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-primary-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-primary-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-primary-100 pt-3">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Data Freshness Indicator Component (Mobile)
// ============================================================================

interface DataFreshnessIndicatorProps {
  lastUpdated: Date | null;
}

const MobileFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({ lastUpdated }) => {
  const [secondsAgo, setSecondsAgo] = React.useState(0);
  
  React.useEffect(() => {
    if (!lastUpdated) return;
    
    const updateSeconds = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
      setSecondsAgo(diff);
    };
    
    updateSeconds();
    const interval = setInterval(updateSeconds, 1000);
    
    return () => clearInterval(interval);
  }, [lastUpdated]);
  
  if (!lastUpdated) {
    return <span className="text-xs text-primary-400">No data</span>;
  }
  
  // Green: < 10s, Yellow: 10-30s, Red: > 30s
  let dotColor: string;
  let textColor: string;
  
  if (secondsAgo < 10) {
    dotColor = 'bg-sa-green';
    textColor = 'text-sa-green';
  } else if (secondsAgo < 30) {
    dotColor = 'bg-sa-gold';
    textColor = 'text-sa-gold';
  } else {
    dotColor = 'bg-sa-red';
    textColor = 'text-sa-red';
  }
  
  const formatTimeAgo = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };
  
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor} ${secondsAgo < 10 ? 'animate-pulse' : ''}`} />
      <span className={`text-xs font-medium ${textColor}`}>
        {formatTimeAgo(secondsAgo)} ago
      </span>
    </div>
  );
};

// ============================================================================
// Mobile Dashboard Component
// ============================================================================

export const MobileDashboard: React.FC<MobileDashboardProps> = ({
  storageStats,
  modelStatus,
  embeddingStats,
  retrievalStats,
  documents,
  latencyChartData,
  healthScore,
  tier,
  sessionId,
  isLoading,
  lastUpdated,
  onRefresh,
  onDocumentRemove,
}) => {
  return (
    <div className="min-h-screen bg-primary-100 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-primary-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-primary-900">RAG Dashboard</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <TierBadge tier={tier} size="sm" />
              <MobileFreshnessIndicator lastUpdated={lastUpdated} />
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-primary-100 hover:bg-primary-200 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-primary-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Quick Stats Row */}
      <div className="px-4 py-4 bg-white border-b border-primary-200">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-900">
              {storageStats?.documents ?? 0}
            </p>
            <p className="text-xs text-primary-500">Documents</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-900">
              {retrievalStats?.totalQueries ?? 0}
            </p>
            <p className="text-xs text-primary-500">Queries</p>
          </div>
          <div className="text-center">
            <GaugeChart value={healthScore} size={80} label="Health" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-3">
        {/* Model Status Section */}
        <CollapsibleSection
          title="Embedding Model"
          icon={<Cpu className="w-5 h-5" />}
          defaultOpen={true}
          badge={
            <StatusBadge 
              status={modelStatus?.loaded ? 'online' : modelStatus?.backend === 'loading' ? 'loading' : 'offline'} 
              size="sm"
            />
          }
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">Model</span>
              <span className="text-sm font-bold text-primary-800">{modelStatus?.name ?? 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">Backend</span>
              <span className={`text-sm font-bold ${
                modelStatus?.backend === 'webgpu' ? 'text-sa-green' : 'text-primary-800'
              }`}>
                {modelStatus?.backend?.toUpperCase() ?? 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">Dimension</span>
              <span className="text-sm font-bold text-primary-800">{modelStatus?.dimension ?? 384}</span>
            </div>
            {embeddingStats && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-500">Avg Latency</span>
                <span className="text-sm font-bold text-primary-800">
                  {embeddingStats.avgLatencyMs.toFixed(0)}ms
                </span>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Storage Section */}
        <CollapsibleSection
          title="Storage"
          icon={<Database className="w-5 h-5" />}
          badge={
            <span className="text-xs text-primary-500">
              {storageStats?.totalSizeMB?.toFixed(1) ?? 0} MB
            </span>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <ProgressRing
                value={storageStats?.usedPercent ?? 0}
                max={100}
                size={100}
                label="Used"
                sublabel={`${storageStats?.totalSizeMB?.toFixed(1) ?? 0} / 100 MB`}
                color={storageStats?.usedPercent && storageStats.usedPercent > 80 ? 'red' : 'grey'}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-primary-50 rounded-lg p-3">
                <p className="text-lg font-bold text-primary-800">{storageStats?.documents ?? 0}</p>
                <p className="text-xs text-primary-500">Documents</p>
              </div>
              <div className="bg-primary-50 rounded-lg p-3">
                <p className="text-lg font-bold text-primary-800">{storageStats?.chunks ?? 0}</p>
                <p className="text-xs text-primary-500">Chunks</p>
              </div>
              <div className="bg-primary-50 rounded-lg p-3">
                <p className="text-lg font-bold text-primary-800">{storageStats?.messages ?? 0}</p>
                <p className="text-xs text-primary-500">Messages</p>
              </div>
              <div className="bg-primary-50 rounded-lg p-3">
                <p className="text-lg font-bold text-primary-800">{storageStats?.images ?? 0}</p>
                <p className="text-xs text-primary-500">Images</p>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Performance Section */}
        <CollapsibleSection
          title="Performance"
          icon={<BarChart3 className="w-5 h-5" />}
          badge={
            <span className="text-xs text-primary-500">
              {retrievalStats?.avgLatencyMs?.toFixed(0) ?? 0}ms avg
            </span>
          }
        >
          <div className="space-y-4">
            <QueryModePie 
              semantic={retrievalStats?.semanticQueries ?? 0}
              keyword={retrievalStats?.keywordQueries ?? 0}
              size={150}
            />
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                title="Semantic"
                metrics={[
                  { label: 'Queries', value: retrievalStats?.semanticQueries ?? 0 },
                  { label: 'Avg Score', value: (retrievalStats?.avgScore ?? 0).toFixed(2) },
                ]}
              />
              <MetricCard
                title="Keyword"
                metrics={[
                  { label: 'Queries', value: retrievalStats?.keywordQueries ?? 0 },
                  { label: 'Cache Hits', value: retrievalStats?.cacheHits ?? 0 },
                ]}
              />
            </div>
            {latencyChartData.length > 0 && (
              <LatencyChart data={latencyChartData} height={200} showLegend={false} />
            )}
          </div>
        </CollapsibleSection>

        {/* Long-Term Memory Section */}
        <CollapsibleSection
          title="Long-Term Memory"
          icon={<Brain className="w-5 h-5" />}
          defaultOpen={false}
          badge={
            tier === 'jigga' ? (
              <span className="text-xs text-primary-500">
                Persistent context
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-medium">
                JIGGA
              </span>
            )
          }
        >
          <MemoryManager 
            tier={tier} 
            onRefresh={onRefresh} 
            onUpgrade={() => window.open('/pricing', '_blank')}
            compact={true} 
          />
        </CollapsibleSection>

        {/* Session Documents Section */}
        <CollapsibleSection
          title="Session Documents"
          icon={<FileText className="w-5 h-5" />}
          defaultOpen={tier !== 'free'}
          badge={
            <span className="text-xs text-primary-500">
              {documents.length} docs
            </span>
          }
        >
          <DocumentManager
            documents={documents}
            tier={tier}
            sessionId={sessionId}
            onDocumentRemove={onDocumentRemove}
            onRefresh={onRefresh}
            compact={true}
          />
        </CollapsibleSection>

        {/* Errors Section (if any) */}
        {retrievalStats && retrievalStats.errorCount > 0 && (
          <CollapsibleSection
            title="Errors"
            icon={<Zap className="w-5 h-5 text-sa-red" />}
            badge={
              <span className="text-xs text-sa-red font-bold">
                {retrievalStats.errorCount}
              </span>
            }
          >
            <div className="bg-sa-red/10 rounded-lg p-3">
              <p className="text-sm text-sa-red">
                {retrievalStats.errorCount} error(s) occurred during retrieval operations.
              </p>
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-primary-200 px-4 py-2 flex items-center justify-around">
        <button className="flex flex-col items-center gap-1 text-primary-600">
          <BarChart3 className="w-5 h-5" />
          <span className="text-xs">Stats</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-primary-400">
          <FileText className="w-5 h-5" />
          <span className="text-xs">Memory</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-primary-400">
          <TrendingUp className="w-5 h-5" />
          <span className="text-xs">Metrics</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-primary-400">
          <Settings className="w-5 h-5" />
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default MobileDashboard;
