/**
 * GOGGA RAG Dashboard - Type Definitions
 * Enterprise-grade monitoring for local RAG, embeddings, and context memory
 * 
 * Architecture:
 * - Real-time metrics from ragMetrics
 * - Dexie storage statistics
 * - Embedding engine status
 * - Context memory management
 */

// ============================================================================
// Model & Embedding Types
// ============================================================================

export interface ModelStatus {
  name: string;
  id: string;
  dimension: number;
  backend: 'webgpu' | 'webgl' | 'wasm' | 'loading' | 'error';
  loaded: boolean;
  loadTimeMs?: number;
  lastUsed?: Date;
  version?: string;
}

export interface EmbeddingStats {
  totalEmbeddings: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  totalProcessingTimeMs: number;
  cachHitRate: number;
  failureRate: number;
}

export interface VectorInfo {
  id: string;
  docId: string;
  chunkIndex: number;
  dimension: number;
  magnitude: number;
  timestamp: Date;
  preview?: number[]; // First 10 values for visualization
}

// ============================================================================
// Storage & Database Types
// ============================================================================

export interface DexieStorageStats {
  documents: number;
  chunks: number;
  messages: number;
  images: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  usedPercent: number;
  remainingMB: number;
  tables: TableStats[];
}

export interface TableStats {
  name: string;
  count: number;
  estimatedSizeBytes: number;
}

export interface SessionStorageInfo {
  sessionId: string;
  sessionTitle: string;
  documentCount: number;
  sizeBytes: number;
  sizeMB: number;
  createdAt: Date;
}

// ============================================================================
// RAG Retrieval Types
// ============================================================================

export interface RetrievalStats {
  totalQueries: number;
  semanticQueries: number;
  keywordQueries: number;
  avgLatencyMs: number;
  avgScore: number;
  topScore: number;
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
}

export interface RetrievalHistoryItem {
  timestamp: Date;
  mode: 'semantic' | 'keyword';
  query: string;
  latencyMs: number;
  resultsCount: number;
  topScore?: number;
  sessionId?: string;
}

// ============================================================================
// Context Memory Types
// ============================================================================

export interface ContextDocument {
  id: string;
  filename: string;
  content: string;
  chunks: string[];
  chunkCount: number;
  size: number;
  mimeType: string;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
  hasEmbeddings: boolean;
  embeddingStatus: 'none' | 'pending' | 'complete' | 'error';
}

export interface ContextMemoryStats {
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  avgChunksPerDoc: number;
  documentsBySession: Map<string, number>;
  documentsByType: Map<string, number>;
}

// ============================================================================
// Chart Data Types
// ============================================================================

export interface TimeSeriesDataPoint {
  timestamp: number;
  label: string;
  value: number;
}

export interface LatencyChartData {
  name: string;
  semantic: number;
  keyword: number;
  timestamp: number;
}

export interface StorageChartData {
  name: string;
  used: number;
  available: number;
  documents: number;
}

export interface ScoreDistribution {
  range: string;
  count: number;
  percentage: number;
}

// ============================================================================
// Dashboard State Types
// ============================================================================

export interface DashboardFilters {
  sessionId?: string;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d' | 'all';
  metricType?: 'all' | 'retrieval' | 'embedding' | 'error';
  tier?: 'free' | 'jive' | 'jigga' | 'all';
}

export interface DashboardState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshIntervalMs: number;
  isAutoRefresh: boolean;
}

export type ViewMode = 'desktop' | 'mobile';
export type TabId =
  | 'overview'
  | 'storage'
  | 'embeddings'
  | 'memory'
  | 'performance'
  | 'llm'
  | 'embedding-model'
  | 'maintenance';

// ============================================================================
// Component Props Types
// ============================================================================

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  loading?: boolean;
}

export interface MetricCardProps {
  title: string;
  metrics: {
    label: string;
    value: string | number;
    unit?: string;
  }[];
  footer?: React.ReactNode;
}

export interface ProgressRingProps {
  value: number;
  max: number;
  size: number;
  strokeWidth: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export interface VectorHeatmapProps {
  vectors: number[][];
  labels?: string[];
  colorScheme?: 'grey' | 'heat' | 'cool';
}

// ============================================================================
// Action Types
// ============================================================================

export type DashboardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: Partial<DashboardFilters> }
  | { type: 'REFRESH_DATA' }
  | { type: 'TOGGLE_AUTO_REFRESH' }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_ACTIVE_TAB'; payload: TabId };

// ============================================================================
// Tier Configuration
// ============================================================================

export const TIER_CONFIG = {
  free: {
    name: 'FREE',
    color: 'bg-primary-500',
    textColor: 'text-primary-500',
    borderColor: 'border-primary-500',
    maxDocs: 0,
    hasSemanticSearch: false,
    hasAnalytics: false,
  },
  jive: {
    name: 'JIVE',
    color: 'bg-sa-green',
    textColor: 'text-sa-green',
    borderColor: 'border-sa-green',
    maxDocs: 5,
    hasSemanticSearch: false,
    hasAnalytics: false,
  },
  jigga: {
    name: 'JIGGA',
    color: 'bg-sa-gold',
    textColor: 'text-sa-gold',
    borderColor: 'border-sa-gold',
    maxDocs: 10,
    hasSemanticSearch: true,
    hasAnalytics: true,
  },
} as const;

export type TierKey = keyof typeof TIER_CONFIG;

// ============================================================================
// Browser Performance Types
// ============================================================================

export interface BrowserPerformance {
  // Memory (Chrome only)
  jsHeapSizeMB: number;
  jsHeapLimitMB: number;
  jsHeapUsedPercent: number;
  
  // Performance
  fps: number;
  longTaskCount: number;  // Tasks > 50ms blocking main thread
  avgLongTaskMs: number;
  
  // Device info
  deviceMemoryGB: number | null;
  hardwareConcurrency: number;
  
  // Timestamp
  timestamp: number;
}

export interface BrowserPerformanceHistory {
  timestamps: number[];
  fps: number[];
  heapUsedPercent: number[];
  longTaskCounts: number[];
}
