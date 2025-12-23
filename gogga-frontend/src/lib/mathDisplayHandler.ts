/**
 * Math Display Handler
 * 
 * Routes math tool results to appropriate frontend display components.
 * Works with the MathService backend to render statistics, charts, and alerts.
 */

import { ChartData, ChartType } from '@/types/chart';

// =============================================================================
// Types
// =============================================================================

export type MathDisplayType = 
  | 'stat_cards'       // Key-value statistics
  | 'data_table'       // Tabular data (z-scores, amortization)
  | 'chart'            // Visualization (Benford's Law)
  | 'alert_cards'      // Warnings and alerts
  | 'formula'          // Mathematical formulas
  | 'comparison'       // Side-by-side comparison
  | 'python_terminal'; // Python code execution result

export interface MathToolResult {
  success: boolean;
  data: Record<string, unknown>;
  display_type: MathDisplayType;
  error?: string;
  result?: string | number;  // Output value (for python_execute)
  execution_time_ms?: number; // Execution time in milliseconds
}

export interface StatCardItem {
  label: string;
  value: string | number;
  highlight?: boolean;
  icon?: string;
}

export interface AlertItem {
  type: 'warning' | 'success' | 'danger' | 'info';
  title: string;
  message: string;
}

// =============================================================================
// Display Type Detection
// =============================================================================

/**
 * Extract display type from math result
 */
export function getDisplayType(result: MathToolResult): MathDisplayType {
  return result.display_type || 'stat_cards';
}

/**
 * Check if result contains a chart
 */
export function hasChart(result: MathToolResult): boolean {
  return (
    result.display_type === 'chart' ||
    'chart' in result.data
  );
}

/**
 * Extract chart data from result
 */
export function extractChartData(result: MathToolResult): ChartData | null {
  if (!hasChart(result)) return null;
  
  const chart = result.data.chart as Record<string, unknown> | undefined;
  if (!chart) return null;
  
  // Import ChartType from types
  const chartType = (chart.chart_type as string) || 'bar';
  
  return {
    type: 'chart',
    chart_type: chartType as ChartType,
    title: (chart.title as string) || 'Math Result',
    subtitle: chart.subtitle as string | undefined,
    data: (chart.data as Array<Record<string, unknown>>) || [],
    series: chart.series as Array<{
      dataKey: string;
      name: string;
      color?: string;
      type?: 'bar' | 'line' | 'area';
    }> | undefined,
  };
}

// =============================================================================
// Data Transformation
// =============================================================================

/**
 * Convert math result to stat cards format
 */
export function toStatCards(result: MathToolResult): StatCardItem[] {
  const cards: StatCardItem[] = [];
  const data = result.data;
  
  // Skip internal fields
  const skipFields = ['display_type', 'chart', 'schedule', 'z_scores', 'anomalies'];
  
  for (const [key, value] of Object.entries(data)) {
    if (skipFields.includes(key)) continue;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) continue; // Skip arrays
    if (typeof value === 'object') continue; // Skip nested objects
    
    // Format the label
    const label = formatLabel(key);
    
    // Format the value
    const formattedValue = formatValue(key, value);
    
    // Highlight important fields
    const highlight = isHighlightField(key);
    
    cards.push({
      label,
      value: formattedValue,
      highlight,
      icon: getIconForField(key),
    });
  }
  
  return cards;
}

/**
 * Convert snake_case to Title Case
 */
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format value based on field type
 */
function formatValue(key: string, value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number') {
    // Currency fields
    if (key.includes('amount') || key.includes('payment') || key.includes('interest') ||
        key.includes('tax') || key.includes('income') || key.includes('value') ||
        key.includes('principal') || key.includes('total')) {
      return `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    // Percentage fields
    if (key.includes('rate') || key.includes('percentage') || key.includes('percent')) {
      return `${value.toFixed(2)}%`;
    }
    
    // Count fields
    if (key.includes('count') || key.includes('periods') || key.includes('years')) {
      return value.toLocaleString();
    }
    
    // Default number formatting
    return value.toLocaleString('en-ZA', { maximumFractionDigits: 4 });
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  return String(value);
}

/**
 * Determine if a field should be highlighted
 */
function isHighlightField(key: string): boolean {
  const highlightFields = [
    'tax_payable', 'monthly_payment', 'final_amount', 'total_interest',
    'take_home_monthly', 'effective_rate', 'npv', 'irr', 'roi',
    'mean', 'median', 'std_dev', 'outlier_count', 'conclusion',
    'chi_square', 'p_value', 'deviation_level'
  ];
  return highlightFields.includes(key);
}

/**
 * Get Lucide icon name for a field
 */
function getIconForField(key: string): string {
  const iconMap: Record<string, string> = {
    // Financial
    'tax_payable': 'receipt',
    'monthly_payment': 'calendar',
    'take_home_monthly': 'wallet',
    'total_interest': 'percent',
    'final_amount': 'banknote',
    'loan_amount': 'landmark',
    'principal': 'piggy-bank',
    
    // Statistics
    'mean': 'calculator',
    'median': 'align-center-horizontal',
    'std_dev': 'scatter-chart',
    'variance': 'activity',
    'count': 'hash',
    'min': 'arrow-down',
    'max': 'arrow-up',
    'range': 'move-horizontal',
    
    // Fraud
    'chi_square': 'bar-chart-2',
    'p_value': 'sigma',
    'conclusion': 'check-circle',
    'deviation_level': 'alert-triangle',
    'suspicious': 'shield-alert',
    'anomaly_count': 'alert-circle',
    
    // Tax
    'tax_bracket': 'layers',
    'marginal_rate': 'trending-up',
    'rebate': 'gift',
    
    // Default
    'default': 'circle',
  };
  
  for (const [field, icon] of Object.entries(iconMap)) {
    if (key.includes(field)) return icon;
  }
  
  return iconMap.default ?? 'circle';
}

// =============================================================================
// Alert Extraction
// =============================================================================

/**
 * Extract alerts from math result
 */
export function extractAlerts(result: MathToolResult): AlertItem[] {
  const alerts: AlertItem[] = [];
  const data = result.data;
  
  // Check for error
  if (result.error) {
    alerts.push({
      type: 'danger',
      title: 'Calculation Error',
      message: result.error,
    });
    return alerts;
  }
  
  // Check for warnings
  if (data.warning) {
    alerts.push({
      type: 'warning',
      title: 'Warning',
      message: String(data.warning),
    });
  }
  
  // Check for suspicious/fraud indicators
  if (data.suspicious === true) {
    alerts.push({
      type: 'danger',
      title: 'Suspicious Pattern Detected',
      message: String(data.conclusion || 'Review the data for potential issues'),
    });
  }
  
  // Check for conclusion
  if (data.conclusion && typeof data.conclusion === 'string') {
    const isPositive = data.conclusion.toLowerCase().includes('no significant') ||
                       data.conclusion.toLowerCase().includes('appears normal') ||
                       data.conclusion.toLowerCase().includes('follows');
    alerts.push({
      type: isPositive ? 'success' : 'warning',
      title: 'Analysis Result',
      message: data.conclusion,
    });
  }
  
  // Check for outliers
  if (data.outlier_count && Number(data.outlier_count) > 0) {
    alerts.push({
      type: 'warning',
      title: `${data.outlier_count} Outliers Found`,
      message: `Values outside the expected range (${data.lower_bound} - ${data.upper_bound})`,
    });
  }
  
  return alerts;
}

// =============================================================================
// Table Data Extraction
// =============================================================================

export interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency';
}

export interface TableData {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

/**
 * Extract table data from math result
 */
export function extractTableData(result: MathToolResult): TableData | null {
  const data = result.data;
  
  // Check for amortization schedule
  if (data.schedule && Array.isArray(data.schedule)) {
    return {
      columns: [
        { key: 'period', label: 'Period', type: 'number' },
        { key: 'payment', label: 'Payment', type: 'currency' },
        { key: 'principal', label: 'Principal', type: 'currency' },
        { key: 'interest', label: 'Interest', type: 'currency' },
        { key: 'balance', label: 'Balance', type: 'currency' },
      ],
      rows: data.schedule as Array<Record<string, unknown>>,
    };
  }
  
  // Check for z-scores
  if (data.z_scores && Array.isArray(data.z_scores)) {
    const zScores = data.z_scores as number[];
    return {
      columns: [
        { key: 'index', label: '#', type: 'number' },
        { key: 'z_score', label: 'Z-Score', type: 'number' },
      ],
      rows: zScores.map((z, i) => ({ index: i + 1, z_score: z.toFixed(4) })),
    };
  }
  
  // Check for anomalies
  if (data.anomalies && Array.isArray(data.anomalies)) {
    return {
      columns: [
        { key: 'index', label: 'Index', type: 'number' },
        { key: 'value', label: 'Value', type: 'currency' },
        { key: 'z_score', label: 'Z-Score', type: 'number' },
      ],
      rows: data.anomalies as Array<Record<string, unknown>>,
    };
  }
  
  // Check for duplicates
  if (data.top_duplicates && Array.isArray(data.top_duplicates)) {
    return {
      columns: [
        { key: 'value', label: 'Value', type: 'currency' },
        { key: 'count', label: 'Occurrences', type: 'number' },
      ],
      rows: data.top_duplicates as Array<Record<string, unknown>>,
    };
  }
  
  return null;
}

// =============================================================================
// Formatting Utilities
// =============================================================================

/**
 * Format currency value for display
 */
export function formatCurrency(value: number): string {
  return `R${value.toLocaleString('en-ZA', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Get severity class for alert type
 */
export function getAlertColorClass(type: AlertItem['type']): string {
  const colorMap = {
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return colorMap[type] || colorMap.info;
}

/**
 * Get icon for alert type
 */
export function getAlertIcon(type: AlertItem['type']): string {
  const iconMap = {
    warning: 'alert-triangle',
    success: 'check-circle',
    danger: 'x-circle',
    info: 'info',
  };
  return iconMap[type] || iconMap.info;
}
