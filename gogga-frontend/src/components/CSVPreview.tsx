'use client';

/**
 * GOGGA CSV Preview Component
 * 
 * Displays parsed CSV data with:
 * - Data table preview (first 50 rows)
 * - Column selection for chart generation
 * - Data type indicators
 * - Chart generation button
 */

import React, { useState, useMemo } from 'react';
import { 
  Table, 
  BarChart2, 
  X, 
  ChevronDown,
  Hash,
  Type,
  Calendar,
  Check,
} from 'lucide-react';
import { ParsedCSVData, ChartType, ChartData, CHART_TYPE_LABELS } from '@/types/chart';

// =============================================================================
// Types
// =============================================================================

interface CSVPreviewProps {
  data: ParsedCSVData;
  onGenerateChart: (chartData: ChartData) => void;
  onClose?: () => void;
  className?: string;
}

interface ColumnSelection {
  xColumn: string;
  yColumns: string[];
}

// =============================================================================
// Constants
// =============================================================================

const MAX_PREVIEW_ROWS = 50;
const CHART_TYPE_OPTIONS: ChartType[] = ['bar', 'line', 'area', 'pie', 'scatter'];

// =============================================================================
// Helper Components
// =============================================================================

const TypeIcon: React.FC<{ type: 'string' | 'number' | 'date' }> = ({ type }) => {
  switch (type) {
    case 'number':
      return <Hash size={12} className="text-blue-500" />;
    case 'date':
      return <Calendar size={12} className="text-green-500" />;
    default:
      return <Type size={12} className="text-primary-400" />;
  }
};

// =============================================================================
// Component
// =============================================================================

export const CSVPreview: React.FC<CSVPreviewProps> = ({
  data,
  onGenerateChart,
  onClose,
  className = '',
}) => {
  const [selection, setSelection] = useState<ColumnSelection>({
    xColumn: data.headers[0] || '',
    yColumns: [],
  });
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showChartTypeMenu, setShowChartTypeMenu] = useState(false);
  const [chartTitle, setChartTitle] = useState('');

  // Get preview rows
  const previewRows = useMemo(() => {
    return data.rows.slice(0, MAX_PREVIEW_ROWS);
  }, [data.rows]);

  // Get numeric columns for Y-axis selection
  const numericColumns = useMemo(() => {
    return data.headers.filter(h => data.columnTypes[h] === 'number');
  }, [data.headers, data.columnTypes]);

  // Get non-numeric columns for X-axis selection
  const categoryColumns = useMemo(() => {
    return data.headers.filter(h => data.columnTypes[h] !== 'number');
  }, [data.headers, data.columnTypes]);

  /**
   * Toggle Y-column selection
   */
  const toggleYColumn = (column: string) => {
    setSelection(prev => ({
      ...prev,
      yColumns: prev.yColumns.includes(column)
        ? prev.yColumns.filter(c => c !== column)
        : [...prev.yColumns, column],
    }));
  };

  /**
   * Generate chart from selection
   */
  const handleGenerateChart = () => {
    if (!selection.xColumn || selection.yColumns.length === 0) {
      return;
    }

    // Build chart data
    const chartData: ChartData = {
      type: 'chart',
      chart_type: chartType,
      title: chartTitle || `${selection.yColumns.join(', ')} by ${selection.xColumn}`,
      data: data.rows.map(row => {
        const point: Record<string, unknown> = {
          name: String(row[selection.xColumn] || ''),
        };
        
        selection.yColumns.forEach(col => {
          point[col] = Number(row[col]) || 0;
        });
        
        // For single Y column, also set 'value' for compatibility
        if (selection.yColumns.length === 1) {
          const col = selection.yColumns[0];
          if (col !== undefined) {
            point.value = Number(row[col]) || 0;
          }
        }
        
        return point;
      }),
      x_label: selection.xColumn,
      ...(selection.yColumns.length === 1 ? { y_label: selection.yColumns[0] } : {}),
      ...(selection.yColumns.length > 1 
        ? { series: selection.yColumns.map(col => ({ dataKey: col, name: col })) }
        : {}),
      timestamp: new Date().toISOString(),
      ...(data.meta?.filename ? { source: data.meta.filename } : {}),
    };

    onGenerateChart(chartData);
  };

  const canGenerate = selection.xColumn && selection.yColumns.length > 0;

  return (
    <div className={`bg-white rounded-xl border border-primary-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-100 bg-primary-50">
        <div className="flex items-center gap-2">
          <Table size={18} className="text-primary-600" />
          <h3 className="font-semibold text-primary-800 text-sm" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            CSV Preview
          </h3>
          <span className="text-xs text-primary-500 bg-primary-100 px-2 py-0.5 rounded-full">
            {data.rowCount} rows × {data.headers.length} columns
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-primary-100 text-primary-500 hover:text-primary-700 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Column Selection */}
      <div className="p-4 border-b border-primary-100 bg-primary-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* X-Axis Selection */}
          <div>
            <label className="block text-xs font-medium text-primary-600 mb-1.5" style={{ fontFamily: 'Quicksand, sans-serif' }}>
              X-Axis (Categories)
            </label>
            <select
              value={selection.xColumn}
              onChange={(e) => setSelection(prev => ({ ...prev, xColumn: e.target.value }))}
              className="w-full text-sm border border-primary-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              style={{ fontFamily: 'Quicksand, sans-serif' }}
            >
              {data.headers.map(header => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>

          {/* Y-Axis Selection */}
          <div>
            <label className="block text-xs font-medium text-primary-600 mb-1.5" style={{ fontFamily: 'Quicksand, sans-serif' }}>
              Y-Axis (Values) - Select numeric columns
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 border border-primary-200 rounded-lg bg-white">
              {numericColumns.length > 0 ? (
                numericColumns.map(col => (
                  <button
                    key={col}
                    onClick={() => toggleYColumn(col)}
                    className={`
                      flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors
                      ${selection.yColumns.includes(col)
                        ? 'bg-primary-700 text-white'
                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                      }
                    `}
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                  >
                    {selection.yColumns.includes(col) && <Check size={10} />}
                    {col}
                  </button>
                ))
              ) : (
                <span className="text-xs text-primary-400" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                  No numeric columns found
                </span>
              )}
            </div>
          </div>

          {/* Chart Type Selection */}
          <div>
            <label className="block text-xs font-medium text-primary-600 mb-1.5" style={{ fontFamily: 'Quicksand, sans-serif' }}>
              Chart Type
            </label>
            <div className="relative">
              <button
                onClick={() => setShowChartTypeMenu(!showChartTypeMenu)}
                className="w-full flex items-center justify-between text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white hover:bg-primary-50 transition-colors"
                style={{ fontFamily: 'Quicksand, sans-serif' }}
              >
                <span className="flex items-center gap-2">
                  <BarChart2 size={14} />
                  {CHART_TYPE_LABELS[chartType]}
                </span>
                <ChevronDown size={14} className={`transition-transform ${showChartTypeMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showChartTypeMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-primary-200 rounded-lg shadow-lg py-1">
                  {CHART_TYPE_OPTIONS.map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        setChartType(type);
                        setShowChartTypeMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50 transition-colors ${
                        chartType === type ? 'bg-primary-100 font-semibold' : ''
                      }`}
                      style={{ fontFamily: 'Quicksand, sans-serif' }}
                    >
                      {CHART_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chart Title */}
          <div>
            <label className="block text-xs font-medium text-primary-600 mb-1.5" style={{ fontFamily: 'Quicksand, sans-serif' }}>
              Chart Title (optional)
            </label>
            <input
              type="text"
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
              placeholder="Auto-generated if empty"
              className="w-full text-sm border border-primary-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              style={{ fontFamily: 'Quicksand, sans-serif' }}
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleGenerateChart}
            disabled={!canGenerate}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${canGenerate
                ? 'bg-primary-700 text-white hover:bg-primary-800'
                : 'bg-primary-200 text-primary-400 cursor-not-allowed'
              }
            `}
            style={{ fontFamily: 'Quicksand, sans-serif' }}
          >
            <BarChart2 size={16} />
            Generate Chart
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-sm">
          <thead className="bg-primary-50 sticky top-0">
            <tr>
              {data.headers.map(header => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-xs font-semibold text-primary-700 border-b border-primary-200"
                  style={{ fontFamily: 'Quicksand, sans-serif' }}
                >
                  <div className="flex items-center gap-1.5">
                    <TypeIcon type={data.columnTypes[header] || 'string'} />
                    <span className="truncate max-w-[120px]" title={header}>
                      {header}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                className="border-b border-primary-100 hover:bg-primary-50/50 transition-colors"
              >
                {data.headers.map(header => (
                  <td
                    key={header}
                    className="px-3 py-2 text-xs text-primary-600 truncate max-w-[150px]"
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                    title={String(row[header] ?? '')}
                  >
                    {row[header] !== null && row[header] !== undefined 
                      ? String(row[header])
                      : <span className="text-primary-300">—</span>
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {data.rowCount > MAX_PREVIEW_ROWS && (
        <div className="px-4 py-2 border-t border-primary-100 bg-primary-50/50 text-center">
          <span className="text-xs text-primary-500" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            Showing first {MAX_PREVIEW_ROWS} of {data.rowCount} rows
          </span>
        </div>
      )}
    </div>
  );
};

export default CSVPreview;
