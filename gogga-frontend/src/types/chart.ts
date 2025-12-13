/**
 * GOGGA Chart Types
 * 
 * Enhanced ChartData interface for comprehensive chart rendering.
 * Supports multi-series data, stacking, and advanced appearance options.
 */

// =============================================================================
// Chart Type Definitions
// =============================================================================

/**
 * All supported chart types
 */
export type ChartType =
  // Bar variants
  | 'bar'
  | 'stackedBar'
  | 'horizontalBar'
  // Line variants
  | 'line'
  | 'stackedLine'
  | 'smoothLine'
  // Area variants
  | 'area'
  | 'stackedArea'
  | 'multiArea'
  // Circular
  | 'pie'
  | 'donut'
  // Hierarchical & Flow
  | 'treemap'
  | 'sunburst'
  | 'sankey'
  // Special
  | 'scatter'
  | 'radar'
  | 'radialBar'
  | 'composed'
  | 'funnel'
  | 'heatmap'
  | 'gauge'
  | 'waterfall';

/**
 * Compatible chart type groups for type switching
 */
export const CHART_TYPE_GROUPS: Record<string, ChartType[]> = {
  bar: ['bar', 'stackedBar', 'horizontalBar', 'waterfall', 'line', 'area'],
  line: ['line', 'stackedLine', 'smoothLine', 'bar', 'area'],
  area: ['area', 'stackedArea', 'multiArea', 'line', 'bar'],
  pie: ['pie', 'donut', 'sunburst'],
  scatter: ['scatter', 'line'],
  radar: ['radar'],
  radialBar: ['radialBar', 'gauge', 'pie', 'donut'],
  composed: ['composed', 'bar', 'line', 'area'],
  funnel: ['funnel', 'sankey'],
  treemap: ['treemap', 'sunburst'],
  sunburst: ['sunburst', 'treemap', 'pie'],
  sankey: ['sankey', 'funnel'],
  heatmap: ['heatmap'],
  gauge: ['gauge', 'radialBar'],
  waterfall: ['waterfall', 'bar', 'stackedBar'],
};

/**
 * Human-readable chart type labels
 */
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar Chart',
  stackedBar: 'Stacked Bar',
  horizontalBar: 'Horizontal Bar',
  line: 'Line Chart',
  stackedLine: 'Stacked Line',
  smoothLine: 'Smooth Line',
  area: 'Area Chart',
  stackedArea: 'Stacked Area',
  multiArea: 'Multi-Area',
  pie: 'Pie Chart',
  donut: 'Donut Chart',
  scatter: 'Scatter Plot',
  radar: 'Radar Chart',
  radialBar: 'Radial Bar',
  composed: 'Composed Chart',
  funnel: 'Funnel Chart',
  treemap: 'Treemap',
  sunburst: 'Sunburst',
  sankey: 'Sankey Diagram',
  heatmap: 'Heatmap',
  gauge: 'Gauge',
  waterfall: 'Waterfall',
};

// =============================================================================
// Data Point & Series Types
// =============================================================================

/**
 * Single data point in a chart
 */
export interface DataPoint {
  /** Label for the data point (x-axis category) */
  name?: string;
  /** Primary value (y-axis) */
  value?: number;
  /** X coordinate (for scatter plots) */
  x?: number;
  /** Y coordinate (for scatter plots) */
  y?: number;
  /** Additional series values */
  [key: string]: unknown;
}

/**
 * Configuration for a data series
 */
export interface SeriesConfig {
  /** Data key in the data array */
  dataKey: string;
  /** Display name for the series */
  name: string;
  /** Color for the series */
  color?: string;
  /** Whether this series is visible */
  visible?: boolean;
  /** Rendering type (for composed charts) */
  type?: 'bar' | 'line' | 'area';
  /** Stack ID for grouping (same ID = stacked together) */
  stackId?: string;
}

// =============================================================================
// Appearance & Formatting
// =============================================================================

/**
 * Legend position options
 */
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';

/**
 * Axis format types
 */
export type AxisFormat = 'number' | 'currency' | 'percent' | 'date' | 'category';

/**
 * Grid style options
 */
export type GridStyle = 'solid' | 'dashed' | 'dotted' | 'none';

/**
 * Stack mode for bar/line/area charts
 */
export type StackMode = 'vertical' | 'horizontal' | 'none';

// =============================================================================
// Default Color Palettes
// =============================================================================

/**
 * Gogga monochrome palette (primary)
 */
export const MONOCHROME_PALETTE = [
  '#1a1a1a', // Primary black
  '#404040', // Dark grey
  '#737373', // Medium grey
  '#a3a3a3', // Light grey
  '#d4d4d4', // Lighter grey
  '#525252', // Neutral grey
  '#262626', // Near black
  '#171717', // Darkest
];

/**
 * Extended palette with accent colors
 */
export const EXTENDED_PALETTE = [
  '#1a1a1a', // Primary black
  '#404040', // Dark grey
  '#737373', // Medium grey
  '#a3a3a3', // Light grey
  '#2563eb', // Blue accent
  '#16a34a', // Green accent
  '#dc2626', // Red accent
  '#ca8a04', // Gold accent
  '#7c3aed', // Purple accent
  '#0891b2', // Cyan accent
];

/**
 * Status colors for alerts/indicators
 */
export const STATUS_COLORS = {
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  info: '#3b82f6',
  neutral: '#737373',
};

// =============================================================================
// Enhanced ChartData Interface
// =============================================================================

/**
 * Complete chart data structure for rendering
 */
export interface ChartData {
  /** Marker type - always 'chart' */
  type: 'chart';
  
  /** Chart type to render */
  chart_type: ChartType;
  
  /** Main chart title */
  title: string;
  
  /** Optional subtitle/description */
  subtitle?: string;
  
  /** Data array */
  data: DataPoint[];
  
  // Multi-series configuration
  /** Series configurations for multi-series charts */
  series?: SeriesConfig[];
  
  /** Stack mode for applicable charts */
  stackMode?: StackMode;
  
  // Axis configuration
  /** X-axis label */
  x_label?: string;
  
  /** Y-axis label */
  y_label?: string;
  
  /** X-axis format */
  xAxisFormat?: AxisFormat;
  
  /** Y-axis format */
  yAxisFormat?: AxisFormat;
  
  // Appearance
  /** Legend position */
  legendPosition?: LegendPosition;
  
  /** Custom color palette */
  colors?: string[];
  
  /** Whether to show grid */
  showGrid?: boolean;
  
  /** Grid line style */
  gridStyle?: GridStyle;
  
  // Animation
  /** Enable/disable animations */
  animate?: boolean;
  
  /** Animation duration in ms */
  animationDuration?: number;
  
  // Metadata
  /** Timestamp when data was generated */
  timestamp?: string;
  
  /** Data source description */
  source?: string;
}

// =============================================================================
// Export Format Types
// =============================================================================

/**
 * Available export formats
 */
export type ExportFormat = 'png' | 'svg' | 'pdf' | 'csv' | 'json';

/**
 * Export options configuration
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Image quality for PNG (1x, 2x, 4x) */
  quality?: 1 | 2 | 4;
  /** Include data table in export */
  includeDataTable?: boolean;
  /** Custom filename (without extension) */
  filename?: string;
}

// =============================================================================
// CSV Import Types
// =============================================================================

/**
 * Parsed CSV data structure
 */
export interface ParsedCSVData {
  /** Column headers */
  headers: string[];
  /** Data rows */
  rows: Record<string, unknown>[];
  /** Detected column types */
  columnTypes: Record<string, 'string' | 'number' | 'date'>;
  /** Total row count */
  rowCount: number;
  /** File metadata */
  meta?: {
    delimiter: string;
    hasHeaders: boolean;
    filename?: string;
  };
}

/**
 * CSV column mapping for chart generation
 */
export interface CSVColumnMapping {
  /** Column to use for X-axis/names */
  xColumn: string;
  /** Column(s) to use for Y-axis/values */
  yColumns: string[];
  /** Optional grouping column */
  groupColumn?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if data is a valid ChartData object
 */
export function isChartData(data: unknown): data is ChartData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data as ChartData).type === 'chart' &&
    'chart_type' in data &&
    'title' in data &&
    'data' in data
  );
}

/**
 * Check if a chart type supports stacking
 */
export function supportsStacking(chartType: ChartType): boolean {
  return ['bar', 'stackedBar', 'line', 'stackedLine', 'area', 'stackedArea', 'multiArea'].includes(chartType);
}

/**
 * Check if a chart type supports multiple series
 */
export function supportsMultiSeries(chartType: ChartType): boolean {
  return [
    'bar', 'stackedBar', 'horizontalBar',
    'line', 'stackedLine', 'smoothLine',
    'area', 'stackedArea', 'multiArea',
    'scatter', 'radar', 'composed'
  ].includes(chartType);
}

/**
 * Get compatible chart types for switching
 */
export function getCompatibleTypes(chartType: ChartType): ChartType[] {
  // Find the base type
  const baseType = chartType.replace(/^(stacked|horizontal|smooth|multi)/, '').toLowerCase() as ChartType;
  return CHART_TYPE_GROUPS[baseType] || CHART_TYPE_GROUPS[chartType] || [chartType];
}
