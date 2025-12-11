/**
 * Chat Display Components
 * 
 * Rich display outputs for AI chat responses.
 * Monochrome design with grey gradients, Quicksand font.
 * 
 * Components:
 * - Terminal: Code output, logs, calculations
 * - DataTable: CSV data, query results
 * - StatCards: KPIs, metrics, dashboards
 * - FormulaDisplay: LaTeX equations, math proofs
 * - ComparisonView: A vs B, before/after
 * - AlertCard: Warnings, fraud alerts, notices
 * - ProgressGauge: Completion %, scores, ratings
 */

'use client';

import React, { useState } from 'react';
import { 
  Terminal as TerminalIcon, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

// ============================================================================
// TERMINAL DISPLAY
// ============================================================================

export interface TerminalDisplayProps {
  content: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  maxHeight?: number;
}

export function TerminalDisplay({ 
  content, 
  language = 'plaintext', 
  title,
  showLineNumbers = true,
  maxHeight = 400
}: TerminalDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  
  const lines = content.split('\n');
  const isLong = lines.length > 20;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-gray-300 bg-gray-900 font-mono text-sm my-3">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-gray-400" />
          <span className="text-gray-300 text-xs font-medium">
            {title || language.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div 
        className={`overflow-auto p-3 ${!expanded ? 'max-h-32' : ''}`}
        style={{ maxHeight: expanded ? maxHeight : undefined }}
      >
        <pre className="text-gray-100">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {showLineNumbers && (
                <span className="text-gray-600 select-none w-8 text-right pr-3 flex-shrink-0">
                  {i + 1}
                </span>
              )}
              <code className="flex-1">{line || ' '}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// DATA TABLE
// ============================================================================

export interface DataTableProps {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
  maxRows?: number;
  striped?: boolean;
}

export function DataTable({ 
  headers, 
  rows, 
  title,
  maxRows = 10,
  striped = true 
}: DataTableProps) {
  const [showAll, setShowAll] = useState(false);
  const displayRows = showAll ? rows : rows.slice(0, maxRows);
  const hasMore = rows.length > maxRows;

  return (
    <div className="rounded-lg overflow-hidden border border-gray-300 my-3">
      {title && (
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-300">
          <span className="font-medium text-gray-800 text-sm">{title}</span>
          <span className="text-gray-500 text-xs ml-2">({rows.length} rows)</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {headers.map((header, i) => (
                <th 
                  key={i} 
                  className="px-4 py-2 text-left font-medium text-gray-700 border-b border-gray-200"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr 
                key={i} 
                className={`${striped && i % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 transition-colors`}
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-gray-800 border-b border-gray-100">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {showAll ? 'Show less' : `Show ${rows.length - maxRows} more rows`}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// STAT CARDS
// ============================================================================

export interface StatCardData {
  label: string;
  value: string | number;
  change?: number; // Percentage change
  prefix?: string; // e.g., "R" for currency
  suffix?: string; // e.g., "%" for percentage
}

export interface StatCardsProps {
  stats: StatCardData[];
  title?: string;
  columns?: 2 | 3 | 4;
}

export function StatCards({ stats, title, columns = 3 }: StatCardsProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className="my-3">
      {title && (
        <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      )}
      <div className={`grid ${gridCols[columns]} gap-3`}>
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200"
          >
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              {stat.label}
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {stat.prefix}{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}{stat.suffix}
            </div>
            {stat.change !== undefined && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${
                stat.change > 0 ? 'text-green-600' : stat.change < 0 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {stat.change > 0 ? <TrendingUp size={12} /> : stat.change < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                <span>{stat.change > 0 ? '+' : ''}{stat.change}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// FORMULA / MATH DISPLAY
// ============================================================================

export interface FormulaDisplayProps {
  formula: string;
  description?: string;
  result?: string | number;
}

export function FormulaDisplay({ formula, description, result }: FormulaDisplayProps) {
  return (
    <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 my-3">
      {description && (
        <div className="text-xs text-gray-500 mb-2">{description}</div>
      )}
      <div className="font-mono text-lg text-gray-800 bg-white rounded px-3 py-2 border border-gray-200 overflow-x-auto">
        {formula}
      </div>
      {result !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-gray-500 text-sm">=</span>
          <span className="font-bold text-gray-800 text-lg">{result}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPARISON VIEW
// ============================================================================

export interface ComparisonItem {
  label: string;
  before: string | number;
  after: string | number;
  unit?: string;
}

export interface ComparisonViewProps {
  items: ComparisonItem[];
  title?: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function ComparisonView({ 
  items, 
  title,
  beforeLabel = 'Before',
  afterLabel = 'After'
}: ComparisonViewProps) {
  return (
    <div className="rounded-lg border border-gray-300 overflow-hidden my-3">
      {title && (
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 font-medium text-gray-800 text-sm">
          {title}
        </div>
      )}
      <div className="divide-y divide-gray-200">
        {/* Header */}
        <div className="grid grid-cols-3 bg-gray-50 text-xs font-medium text-gray-600 uppercase tracking-wide">
          <div className="px-4 py-2">Metric</div>
          <div className="px-4 py-2 text-center">{beforeLabel}</div>
          <div className="px-4 py-2 text-center">{afterLabel}</div>
        </div>
        {/* Rows */}
        {items.map((item, i) => {
          const beforeVal = typeof item.before === 'number' ? item.before : parseFloat(item.before as string);
          const afterVal = typeof item.after === 'number' ? item.after : parseFloat(item.after as string);
          const improved = !isNaN(afterVal) && !isNaN(beforeVal) && afterVal > beforeVal;
          const declined = !isNaN(afterVal) && !isNaN(beforeVal) && afterVal < beforeVal;
          
          return (
            <div key={i} className="grid grid-cols-3 hover:bg-gray-50 transition-colors">
              <div className="px-4 py-3 text-sm text-gray-700">{item.label}</div>
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                {item.before}{item.unit}
              </div>
              <div className={`px-4 py-3 text-sm text-center font-medium ${
                improved ? 'text-green-600' : declined ? 'text-red-600' : 'text-gray-800'
              }`}>
                {item.after}{item.unit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ALERT CARD
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'success';

export interface AlertCardProps {
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: string[];
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function AlertCard({ 
  severity, 
  title, 
  message, 
  details,
  dismissible = false,
  onDismiss
}: AlertCardProps) {
  const styles = {
    info: {
      bg: 'bg-gray-50',
      border: 'border-gray-300',
      icon: <Info size={20} className="text-gray-600" />,
      title: 'text-gray-800',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      icon: <AlertTriangle size={20} className="text-amber-600" />,
      title: 'text-amber-800',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      icon: <AlertCircle size={20} className="text-red-600" />,
      title: 'text-red-800',
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      icon: <CheckCircle size={20} className="text-green-600" />,
      title: 'text-green-800',
    },
  };

  const style = styles[severity];

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-4 my-3`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
        <div className="flex-1">
          <div className={`font-medium ${style.title}`}>{title}</div>
          <div className="text-sm text-gray-600 mt-1">{message}</div>
          {details && details.length > 0 && (
            <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
              {details.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
        {dismissible && onDismiss && (
          <button 
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PROGRESS / GAUGE
// ============================================================================

export interface ProgressGaugeProps {
  value: number; // 0-100
  label: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'gray' | 'green' | 'red' | 'amber';
}

export function ProgressGauge({ 
  value, 
  label, 
  showValue = true,
  size = 'md',
  color = 'gray'
}: ProgressGaugeProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  const heights = { sm: 'h-2', md: 'h-3', lg: 'h-4' };
  const colors = {
    gray: 'bg-gray-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    amber: 'bg-amber-500',
  };

  return (
    <div className="my-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        {showValue && (
          <span className="text-sm font-medium text-gray-800">{clampedValue}%</span>
        )}
      </div>
      <div className={`w-full bg-gray-200 rounded-full ${heights[size]} overflow-hidden`}>
        <div 
          className={`${colors[color]} ${heights[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MULTI-PROGRESS (for dashboards)
// ============================================================================

export interface MultiProgressProps {
  items: Array<{
    label: string;
    value: number;
    color?: 'gray' | 'green' | 'red' | 'amber';
  }>;
  title?: string;
}

export function MultiProgress({ items, title }: MultiProgressProps) {
  return (
    <div className="rounded-lg border border-gray-300 p-4 my-3">
      {title && (
        <div className="text-sm font-medium text-gray-700 mb-3">{title}</div>
      )}
      <div className="space-y-3">
        {items.map((item, i) => (
          <ProgressGauge
            key={i}
            value={item.value}
            label={item.label}
            color={item.color || 'gray'}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  TerminalDisplay,
  DataTable,
  StatCards,
  FormulaDisplay,
  ComparisonView,
  AlertCard,
  ProgressGauge,
  MultiProgress,
};
