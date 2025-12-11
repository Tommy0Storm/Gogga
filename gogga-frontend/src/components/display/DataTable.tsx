'use client';

/**
 * DataTable Component
 * 
 * Displays tabular data for math results like amortization schedules,
 * z-scores, or anomaly lists.
 */

import React from 'react';

export interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency';
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  title?: string;
  maxRows?: number;
}

/**
 * Format cell value based on column type
 */
function formatCell(value: unknown, type: TableColumn['type']): string {
  if (value === null || value === undefined) return '-';
  
  if (type === 'currency') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);
    return `R${num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  if (type === 'number') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);
    return num.toLocaleString('en-ZA', { maximumFractionDigits: 4 });
  }
  
  return String(value);
}

export function DataTable({ columns, rows, title, maxRows = 50 }: DataTableProps) {
  const displayRows = rows.slice(0, maxRows);
  const hasMore = rows.length > maxRows;

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-primary-900 mb-4">{title}</h3>
      )}
      <div className="overflow-x-auto rounded-lg border border-primary-200">
        <table className="w-full text-sm">
          <thead className="bg-primary-100">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-4 py-3 font-semibold text-primary-700 border-b border-primary-200
                    ${col.align === 'right' || col.type === 'number' || col.type === 'currency' 
                      ? 'text-right' 
                      : 'text-left'
                    }
                  `}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {displayRows.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className="hover:bg-primary-50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      px-4 py-2.5 text-primary-800
                      ${col.align === 'right' || col.type === 'number' || col.type === 'currency'
                        ? 'text-right font-mono'
                        : 'text-left'
                      }
                    `}
                  >
                    {formatCell(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <p className="text-sm text-primary-500 mt-2 text-center">
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  );
}

export default DataTable;
