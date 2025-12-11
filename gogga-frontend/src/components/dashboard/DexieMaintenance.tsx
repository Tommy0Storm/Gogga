/**
 * GOGGA Dexie Maintenance Panel
 * Performance monitoring and maintenance tools for IndexedDB
 * 
 * Features:
 * - Real-time database health metrics
 * - Table-level statistics
 * - Vacuum/compact operations
 * - Data export/import
 * - Emergency reset tools
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Trash2,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HardDrive,
  Zap,
  Activity,
  FileText,
  MessageSquare,
  Image,
  Brain,
  Clock,
  Settings,
  Shield,
  Archive,
} from 'lucide-react';
import { db, clearAllData } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

interface TableHealth {
  name: string;
  count: number;
  estimatedSizeKB: number;
  status: 'healthy' | 'warning' | 'error';
  lastChecked: Date;
  icon: React.ReactNode;
}

interface MaintenanceLog {
  id: number;
  timestamp: Date;
  action: string;
  status: 'success' | 'error' | 'warning';
  details: string;
}

interface DatabaseMetrics {
  isConnected: boolean;
  version: number;
  tables: TableHealth[];
  totalSizeKB: number;
  totalRecords: number;
  lastMaintenance: Date | null;
  indexedDBQuota: number | null;
  indexedDBUsage: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getIndexedDBUsage(): Promise<{ quota: number; usage: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
      };
    } catch {
      return null;
    }
  }
  return null;
}

async function getTableCount(tableName: string): Promise<number> {
  try {
    const table = (db as unknown as Record<string, { count: () => Promise<number> }>)[tableName];
    if (table && typeof table.count === 'function') {
      return await table.count();
    }
    return 0;
  } catch {
    return -1;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export const DexieMaintenance: React.FC = () => {
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    danger?: boolean;
  } | null>(null);

  // Log ID counter for guaranteed unique keys
  const logIdRef = React.useRef(0);

  // Add log entry
  const addLog = useCallback((action: string, status: 'success' | 'error' | 'warning', details: string) => {
    logIdRef.current += 1;
    const uniqueId = logIdRef.current;
    setLogs(prev => [{
      id: uniqueId,
      timestamp: new Date(),
      action,
      status,
      details,
    }, ...prev.slice(0, 49)]); // Keep last 50 logs
  }, []);

  // Refresh database metrics
  const refreshMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const storageEstimate = await getIndexedDBUsage();
      
      // Get counts for each table
      const tableConfigs = [
        { name: 'documents', icon: <FileText className="w-4 h-4" />, sizeMultiplier: 10 },
        { name: 'chunks', icon: <Archive className="w-4 h-4" />, sizeMultiplier: 0.5 },
        { name: 'sessions', icon: <Clock className="w-4 h-4" />, sizeMultiplier: 0.1 },
        { name: 'messages', icon: <MessageSquare className="w-4 h-4" />, sizeMultiplier: 1 },
        { name: 'images', icon: <Image className="w-4 h-4" />, sizeMultiplier: 100 },
        { name: 'memories', icon: <Brain className="w-4 h-4" />, sizeMultiplier: 0.5 },
        { name: 'tokenUsage', icon: <Zap className="w-4 h-4" />, sizeMultiplier: 0.1 },
        { name: 'preferences', icon: <Settings className="w-4 h-4" />, sizeMultiplier: 0.01 },
      ];

      const tables: TableHealth[] = await Promise.all(
        tableConfigs.map(async (config) => {
          const count = await getTableCount(config.name);
          const estimatedSizeKB = count * config.sizeMultiplier;
          return {
            name: config.name,
            count: count,
            estimatedSizeKB,
            status: count === -1 ? 'error' : count > 10000 ? 'warning' : 'healthy',
            lastChecked: new Date(),
            icon: config.icon,
          };
        })
      );

      const totalRecords = tables.reduce((sum, t) => sum + (t.count > 0 ? t.count : 0), 0);
      const totalSizeKB = tables.reduce((sum, t) => sum + t.estimatedSizeKB, 0);

      setMetrics({
        isConnected: db.isOpen(),
        version: db.verno,
        tables,
        totalSizeKB,
        totalRecords,
        lastMaintenance: null, // Could persist this
        indexedDBQuota: storageEstimate?.quota || null,
        indexedDBUsage: storageEstimate?.usage || null,
      });

      addLog('Metrics Refresh', 'success', `Scanned ${tables.length} tables, ${totalRecords} records`);
    } catch (error) {
      addLog('Metrics Refresh', 'error', String(error));
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  // Initial load
  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics]);

  // Clear specific table
  const clearTable = async (tableName: string) => {
    setIsRunningAction(true);
    try {
      const table = (db as unknown as Record<string, { clear: () => Promise<void> }>)[tableName];
      if (table && typeof table.clear === 'function') {
        await table.clear();
        addLog(`Clear ${tableName}`, 'success', 'Table cleared successfully');
        await refreshMetrics();
      }
    } catch (error) {
      addLog(`Clear ${tableName}`, 'error', String(error));
    } finally {
      setIsRunningAction(false);
    }
  };

  // Clear all data
  const handleClearAll = async () => {
    setIsRunningAction(true);
    try {
      await clearAllData();
      addLog('Clear All Data', 'success', 'All data cleared (preferences preserved)');
      await refreshMetrics();
    } catch (error) {
      addLog('Clear All Data', 'error', String(error));
    } finally {
      setIsRunningAction(false);
    }
  };

  // Export database
  const handleExport = async () => {
    setIsRunningAction(true);
    try {
      const exportData: Record<string, unknown[]> = {};
      
      const tableNames = ['documents', 'chunks', 'sessions', 'messages', 'images', 'memories', 'tokenUsage', 'preferences'];
      
      for (const tableName of tableNames) {
        try {
          const table = (db as unknown as Record<string, { toArray: () => Promise<unknown[]> }>)[tableName];
          if (table && typeof table.toArray === 'function') {
            exportData[tableName] = await table.toArray();
          }
        } catch {
          exportData[tableName] = [];
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gogga-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      addLog('Export Database', 'success', `Exported ${Object.keys(exportData).length} tables`);
    } catch (error) {
      addLog('Export Database', 'error', String(error));
    } finally {
      setIsRunningAction(false);
    }
  };

  // Force close and reopen database
  const handleReconnect = async () => {
    setIsRunningAction(true);
    try {
      if (db.isOpen()) {
        db.close();
      }
      await db.open();
      addLog('Reconnect', 'success', 'Database reconnected successfully');
      await refreshMetrics();
    } catch (error) {
      addLog('Reconnect', 'error', String(error));
    } finally {
      setIsRunningAction(false);
    }
  };

  // Delete and recreate database (nuclear option)
  const handleNuclearReset = async () => {
    setIsRunningAction(true);
    try {
      await db.delete();
      window.location.reload();
    } catch (error) {
      addLog('Nuclear Reset', 'error', String(error));
      setIsRunningAction(false);
    }
  };

  // Compact orphaned chunks
  const handleCompactOrphans = async () => {
    setIsRunningAction(true);
    try {
      // Find chunks without parent documents
      const allChunks = await db.chunks.toArray();
      const allDocIds = new Set((await db.documents.toArray()).map(d => d.id));
      
      const orphanedChunks = allChunks.filter(c => !allDocIds.has(c.documentId));
      
      if (orphanedChunks.length > 0) {
        const orphanIds = orphanedChunks.map(c => c.id).filter((id): id is number => id !== undefined);
        await db.chunks.bulkDelete(orphanIds);
        addLog('Compact Orphans', 'success', `Removed ${orphanedChunks.length} orphaned chunks`);
      } else {
        addLog('Compact Orphans', 'success', 'No orphaned chunks found');
      }
      
      await refreshMetrics();
    } catch (error) {
      addLog('Compact Orphans', 'error', String(error));
    } finally {
      setIsRunningAction(false);
    }
  };

  // Get health color
  const getHealthColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
    }
  };

  const getStatusIcon = (status: 'success' | 'error' | 'warning') => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Confirmation Dialog */}
      {confirmDialog?.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-primary-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-primary-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg border border-primary-300 text-primary-700 hover:bg-primary-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmDialog(null);
                  await confirmDialog.action();
                }}
                className={`px-4 py-2 rounded-lg text-white ${
                  confirmDialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-900 hover:bg-primary-800'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Actions */}
      <div className="bg-white rounded-xl border border-primary-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-primary-900">Dexie Database</h3>
              <p className="text-sm text-primary-500">
                {metrics?.isConnected ? (
                  <span className="text-green-600">● Connected</span>
                ) : (
                  <span className="text-red-600">● Disconnected</span>
                )}
                {metrics && ` • v${metrics.version} • ${metrics.totalRecords.toLocaleString()} records`}
              </p>
            </div>
          </div>
          <button
            onClick={refreshMetrics}
            disabled={isLoading}
            className="p-2 rounded-lg bg-primary-100 hover:bg-primary-200 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-primary-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={isRunningAction}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Backup
          </button>
          <button
            onClick={handleCompactOrphans}
            disabled={isRunningAction}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 text-sm font-medium transition-colors"
          >
            <Archive className="w-4 h-4" />
            Compact Orphans
          </button>
          <button
            onClick={handleReconnect}
            disabled={isRunningAction}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reconnect
          </button>
        </div>
      </div>

      {/* Storage Quota */}
      {metrics?.indexedDBQuota && metrics?.indexedDBUsage && (
        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <h3 className="font-semibold text-primary-800 mb-3 flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Browser Storage Quota
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-primary-600">Used</span>
              <span className="font-medium text-primary-900">
                {(metrics.indexedDBUsage / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
            <div className="h-3 bg-primary-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 transition-all"
                style={{ width: `${Math.min((metrics.indexedDBUsage / metrics.indexedDBQuota) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-primary-500">
              <span>0 MB</span>
              <span>{(metrics.indexedDBQuota / (1024 * 1024)).toFixed(0)} MB available</span>
            </div>
          </div>
        </div>
      )}

      {/* Table Health Grid */}
      <div className="bg-white rounded-xl border border-primary-200 p-5">
        <h3 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Table Health
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics?.tables.map((table) => (
            <div
              key={table.name}
              className="border border-primary-200 rounded-lg p-3 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {table.icon}
                  <span className="font-medium text-primary-800 text-sm capitalize">
                    {table.name}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getHealthColor(table.status)}`}>
                  {table.status}
                </span>
              </div>
              <div className="text-lg font-bold text-primary-900">
                {table.count >= 0 ? table.count.toLocaleString() : 'Error'}
              </div>
              <div className="text-xs text-primary-500">
                ~{table.estimatedSizeKB.toFixed(1)} KB
              </div>
              <button
                onClick={() => setConfirmDialog({
                  show: true,
                  title: `Clear ${table.name}?`,
                  message: `This will permanently delete all ${table.count} records from the ${table.name} table.`,
                  action: () => clearTable(table.name),
                  danger: true,
                })}
                disabled={isRunningAction || table.count <= 0}
                className="mt-2 w-full text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Clear Table
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 rounded-xl border border-red-200 p-5">
        <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>
        <p className="text-sm text-red-700 mb-4">
          These actions are destructive and cannot be undone. Export your data first!
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setConfirmDialog({
              show: true,
              title: 'Clear All Data?',
              message: 'This will delete all documents, messages, images, and sessions. Preferences will be preserved. This cannot be undone!',
              action: handleClearAll,
              danger: true,
            })}
            disabled={isRunningAction}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
          <button
            onClick={() => setConfirmDialog({
              show: true,
              title: 'Nuclear Reset?',
              message: 'This will DELETE the entire database and reload the page. All data will be lost forever. Only use this if the database is corrupted!',
              action: handleNuclearReset,
              danger: true,
            })}
            disabled={isRunningAction}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
          >
            <Shield className="w-4 h-4" />
            Nuclear Reset
          </button>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white rounded-xl border border-primary-200 p-5">
        <h3 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Maintenance Log
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-primary-500 text-center py-4">No maintenance actions yet</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 text-sm border-b border-primary-100 pb-2 last:border-0"
              >
                {getStatusIcon(log.status)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-primary-800">{log.action}</div>
                  <div className="text-primary-500 truncate">{log.details}</div>
                </div>
                <div className="text-xs text-primary-400 whitespace-nowrap">
                  {log.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DexieMaintenance;
