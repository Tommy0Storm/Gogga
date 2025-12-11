'use client';

/**
 * MathResultDisplay Component
 * 
 * Main component for rendering math tool results.
 * Automatically routes to appropriate sub-components based on display_type.
 * Includes terminal view showing execution logs embedded in the result.
 */

import React, { useMemo, useState } from 'react';
import { StatCards } from './StatCards';
import { AlertCards } from './AlertCards';
import { DataTable } from './DataTable';
import { FormulaView } from './FormulaView';
import TerminalView, { TerminalLine } from './TerminalView';
import ChartRenderer from '../ChartRenderer';
import { 
  MathToolResult, 
  toStatCards, 
  extractAlerts, 
  extractTableData,
  extractChartData 
} from '@/lib/mathDisplayHandler';

// Extended result type with embedded execution logs
interface MathResultWithLogs extends MathToolResult {
  executionLogs?: Array<{
    timestamp: string;
    level: 'info' | 'debug' | 'success' | 'error' | 'warn';
    message: string;
    icon?: string;
  }>;
}

interface MathResultDisplayProps {
  result: MathResultWithLogs;
  showTitle?: boolean;
  showTerminal?: boolean;
}

export function MathResultDisplay({ result, showTitle = true, showTerminal = true }: MathResultDisplayProps) {
  const [showLogs, setShowLogs] = useState(false); // Default collapsed

  // Convert embedded execution logs to TerminalLine format
  const terminalLines: TerminalLine[] = useMemo(() => {
    if (!result.executionLogs || result.executionLogs.length === 0) {
      return [];
    }
    
    return result.executionLogs.map((log, index) => ({
      id: `log-${index}-${log.timestamp}`,
      timestamp: new Date(log.timestamp),
      level: log.level,
      message: log.message,
      icon: log.icon,
    }));
  }, [result.executionLogs]);

  // Extract data for different display types
  const alerts = extractAlerts(result);
  const tableData = extractTableData(result);
  const chartData = extractChartData(result);
  const statCards = toStatCards(result);

  // Error state
  if (!result.success) {
    return (
      <div className="space-y-4">
        {terminalLines.length > 0 && (
          <TerminalView 
            lines={terminalLines} 
            title="Execution Log" 
            className="mb-4"
          />
        )}
        <AlertCards 
          alerts={[{
            type: 'danger',
            title: 'Calculation Error',
            message: result.error || 'An unknown error occurred',
          }]} 
        />
      </div>
    );
  }

  // Terminal toggle button
  const TerminalToggle = () => (
    <button
      onClick={() => setShowLogs(!showLogs)}
      className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-2 transition-colors"
    >
      <span className="font-mono text-green-500">{showLogs ? '▼' : '▶'}</span>
      <span className="font-mono">{showLogs ? 'Hide' : 'Show'} Execution Log</span>
      <span className="text-gray-600">({terminalLines.length} lines)</span>
    </button>
  );

  // Render based on display type
  switch (result.display_type) {
    case 'chart':
      return (
        <div className="space-y-4">
          {/* Terminal toggle and view */}
          {terminalLines.length > 0 && <TerminalToggle />}
          {showLogs && terminalLines.length > 0 && (
            <TerminalView lines={terminalLines} title="Math Tool Execution" />
          )}
          
          {/* Show alerts first if any */}
          {alerts.length > 0 && <AlertCards alerts={alerts} />}
          
          {/* Chart visualization */}
          {chartData && <ChartRenderer chartData={chartData} />}
          
          {/* Supporting stats */}
          {statCards.length > 0 && (
            <StatCards items={statCards} columns={3} />
          )}
        </div>
      );

    case 'data_table':
      return (
        <div className="space-y-4">
          {/* Terminal toggle and view */}
          {terminalLines.length > 0 && <TerminalToggle />}
          {showLogs && terminalLines.length > 0 && (
            <TerminalView lines={terminalLines} title="Math Tool Execution" />
          )}
          
          {/* Summary stats at top */}
          {statCards.length > 0 && (
            <StatCards 
              items={statCards.slice(0, 6)} 
              columns={3} 
            />
          )}
          
          {/* Table data */}
          {tableData && (
            <DataTable 
              columns={tableData.columns} 
              rows={tableData.rows}
            />
          )}
        </div>
      );

    case 'alert_cards':
      return (
        <div className="space-y-4">
          {/* Terminal toggle and view */}
          {terminalLines.length > 0 && <TerminalToggle />}
          {showLogs && terminalLines.length > 0 && (
            <TerminalView lines={terminalLines} title="Math Tool Execution" />
          )}
          
          {/* Alerts */}
          <AlertCards alerts={alerts} />
          
          {/* Supporting stats */}
          {statCards.length > 0 && (
            <StatCards items={statCards} columns={3} />
          )}
        </div>
      );

    case 'formula':
      const formula = result.data.formula as string | undefined;
      return (
        <div className="space-y-4">
          {/* Terminal toggle and view */}
          {terminalLines.length > 0 && <TerminalToggle />}
          {showLogs && terminalLines.length > 0 && (
            <TerminalView lines={terminalLines} title="Math Tool Execution" />
          )}
          
          {formula && <FormulaView formula={formula} />}
          
          {/* Stats */}
          {statCards.length > 0 && (
            <StatCards items={statCards} columns={3} />
          )}
        </div>
      );

    case 'stat_cards':
    default:
      return (
        <div className="space-y-4">
          {/* Terminal toggle and view */}
          {terminalLines.length > 0 && <TerminalToggle />}
          {showLogs && terminalLines.length > 0 && (
            <TerminalView lines={terminalLines} title="Math Tool Execution" />
          )}
          
          {/* Alerts first if any */}
          {alerts.length > 0 && <AlertCards alerts={alerts} />}
          
          {/* Main stat cards */}
          <StatCards items={statCards} columns={3} />
          
          {/* Table if present */}
          {tableData && (
            <DataTable 
              columns={tableData.columns} 
              rows={tableData.rows}
            />
          )}
        </div>
      );
  }
}

export default MathResultDisplay;

// Re-export sub-components for direct use
export { StatCards } from './StatCards';
export { AlertCards } from './AlertCards';
export { DataTable } from './DataTable';
export { FormulaView } from './FormulaView';
export { default as TerminalView } from './TerminalView';
export type { AlertItem } from './AlertCards';
export type { TableColumn } from './DataTable';