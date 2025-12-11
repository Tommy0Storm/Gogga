/**
 * GOGGA RAG Dashboard - Main Entry Component
 * Combines all dashboard features with responsive layout detection
 * 
 * Features:
 * - Automatic desktop/mobile view switching
 * - Real-time metrics via useRagDashboard hook
 * - Dexie storage monitoring
 * - Embedding model status
 * - Context memory management
 * - Performance charts
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRagDashboard } from './useRagDashboard';
import { DesktopDashboard } from './DesktopDashboard';
import { MobileDashboard } from './MobileDashboard';
import type { ViewMode } from './types';

// ============================================================================
// Props
// ============================================================================

interface RAGDashboardProps {
  tier?: 'free' | 'jive' | 'jigga';
  sessionId?: string;
  forceView?: ViewMode;
}

// ============================================================================
// Breakpoint for mobile/desktop detection
// ============================================================================

const MOBILE_BREAKPOINT = 768;

// ============================================================================
// Hook for responsive detection
// ============================================================================

function useViewMode(forceView?: ViewMode): ViewMode {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  useEffect(() => {
    if (forceView) {
      setViewMode(forceView);
      return;
    }

    const checkViewMode = () => {
      setViewMode(window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'desktop');
    };

    checkViewMode();
    window.addEventListener('resize', checkViewMode);
    return () => window.removeEventListener('resize', checkViewMode);
  }, [forceView]);

  return viewMode;
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export const RAGDashboard: React.FC<RAGDashboardProps> = ({
  tier = 'jigga',
  sessionId = 'default-session',
  forceView,
}) => {
  const viewMode = useViewMode(forceView);
  
  const {
    state,
    storageStats,
    modelStatus,
    embeddingStats,
    retrievalStats,
    documents,
    latencyChartData,
    tokenUsage,
    healthScore,
    scoreDistribution,
    vectorData,
    refreshData,
    toggleAutoRefresh,
  } = useRagDashboard();

  // Common props for both views
  const commonProps = {
    storageStats,
    modelStatus,
    embeddingStats,
    retrievalStats,
    documents,
    latencyChartData,
    healthScore,
    tier,
    sessionId,
    isLoading: state.isLoading,
    lastUpdated: state.lastUpdated,
    onRefresh: refreshData,
    onDocumentRemove: (docId: number) => {
      // Will be handled by DocumentManager internally
      refreshData();
    },
  };

  if (viewMode === 'mobile') {
    return <MobileDashboard {...commonProps} />;
  }

  return (
    <DesktopDashboard
      {...commonProps}
      tokenUsage={tokenUsage}
      scoreDistribution={scoreDistribution}
      vectorData={vectorData}
      isAutoRefresh={state.isAutoRefresh}
      onToggleAutoRefresh={toggleAutoRefresh}
    />
  );
};

// ============================================================================
// Exports
// ============================================================================

// Re-export all components for individual use
export { StatCard, MetricCard, ProgressRing, StatusBadge, TierBadge, InfoRow } from './StatCard';
export { LatencyChart, StorageChart, QueryModePie, PerformanceChart, GaugeChart, ScoreHistogram, Sparkline, BrowserLoadChart } from './Charts';
export { VectorHeatmap, VectorPreview, VectorStats, SimilarityScore } from './VectorHeatmap';
export { DocumentManager, DocumentPreview, QuickDocList } from './DocumentManager';
export { MemoryManager } from './MemoryManager';
export { BuddyPanel } from './BuddyPanel';
export { DexieMaintenance } from './DexieMaintenance';
export { LLMMonitor } from './LLMMonitor';
export { EmbeddingMonitor } from './EmbeddingMonitor';
export { MobileDashboard } from './MobileDashboard';
export { DesktopDashboard } from './DesktopDashboard';
export { useRagDashboard, useContextMemory, useBrowserPerformance } from './useRagDashboard';
export * from './types';

export default RAGDashboard;
