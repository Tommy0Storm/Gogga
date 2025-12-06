'use client';

import { useState, useEffect } from 'react';
import {
  MdStorage,
  MdRefresh,
  MdCleaningServices,
  MdBackup,
  MdCode,
  MdTableChart,
  MdSchema,
  MdHealthAndSafety,
  MdPlayArrow,
  MdDelete,
  MdChevronLeft,
  MdChevronRight,
  MdSearch,
  MdDownload,
} from 'react-icons/md';

type Tab = 'overview' | 'query' | 'browse' | 'schema' | 'tools' | 'backup';

interface TableStats {
  name: string;
  count: number;
}

interface DatabaseInfo {
  type: string;
  path: string;
  sizeBytes: number;
  sizeFormatted: string;
  tables: TableStats[];
}

interface SchemaTable {
  name: string;
  columns: { name: string; type: string; notnull: number; pk: number }[];
  indexes: { name: string; unique: number; columns: string }[];
  rowCount: number;
}

interface Backup {
  name: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
}

export default function DatabasePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDatabaseInfo();
  }, []);

  const loadDatabaseInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/database');
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
      }
    } catch (error) {
      console.error('Failed to load database info:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <MdStorage size={18} /> },
    { id: 'query', label: 'SQL Query', icon: <MdCode size={18} /> },
    { id: 'browse', label: 'Browse', icon: <MdTableChart size={18} /> },
    { id: 'schema', label: 'Schema', icon: <MdSchema size={18} /> },
    { id: 'tools', label: 'Tools', icon: <MdHealthAndSafety size={18} /> },
    { id: 'backup', label: 'Backup', icon: <MdBackup size={18} /> },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="admin-spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-[var(--admin-surface-2)] p-1 rounded-lg overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[var(--admin-surface)] text-[var(--admin-text)]'
                : 'text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab dbInfo={dbInfo} onRefresh={loadDatabaseInfo} />}
      {activeTab === 'query' && <QueryTab />}
      {activeTab === 'browse' && <BrowseTab tables={dbInfo?.tables || []} />}
      {activeTab === 'schema' && <SchemaTab />}
      {activeTab === 'tools' && <ToolsTab />}
      {activeTab === 'backup' && <BackupTab />}
    </div>
  );
}

// Overview Tab
function OverviewTab({ dbInfo, onRefresh }: { dbInfo: DatabaseInfo | null; onRefresh: () => void }) {
  const [vacuuming, setVacuuming] = useState(false);

  const handleVacuum = async () => {
    if (!confirm('Run VACUUM on the database? This may take a moment.')) return;
    setVacuuming(true);
    try {
      const res = await fetch('/api/database/vacuum', { method: 'POST' });
      if (res.ok) {
        alert('Vacuum complete');
        onRefresh();
      } else {
        const data = await res.json();
        alert(`Vacuum failed: ${data.error}`);
      }
    } catch {
      alert('Network error');
    } finally {
      setVacuuming(false);
    }
  };

  return (
    <>
      <div className="admin-card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[var(--admin-surface-2)] flex items-center justify-center">
              <MdStorage size={24} className="text-[var(--admin-text-muted)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">SQLite Database</h3>
              <p className="text-sm text-[var(--admin-text-secondary)]">{dbInfo?.path || 'prisma/dev.db'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onRefresh} className="admin-btn admin-btn-primary">
              <MdRefresh size={18} />
            </button>
            <button onClick={handleVacuum} disabled={vacuuming} className="admin-btn admin-btn-primary">
              {vacuuming ? <div className="admin-spinner" /> : <><MdCleaningServices size={18} /> Vacuum</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <span className="metric-label">Database Size</span>
            <p className="metric-value">{dbInfo?.sizeFormatted || '—'}</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Tables</span>
            <p className="metric-value">{dbInfo?.tables.length || 0}</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total Rows</span>
            <p className="metric-value">{dbInfo?.tables.reduce((sum, t) => sum + t.count, 0).toLocaleString() || 0}</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Type</span>
            <p className="metric-value">SQLite 3.51</p>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3 className="text-lg font-semibold mb-4">Tables</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Table Name</th>
              <th>Row Count</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dbInfo?.tables.map((table) => (
              <tr key={table.name}>
                <td className="font-medium">{table.name}</td>
                <td>{table.count.toLocaleString()}</td>
                <td>
                  <span className={`status-badge ${table.count > 10000 ? 'status-badge-warning' : table.count > 0 ? 'status-badge-success' : 'status-badge-neutral'}`}>
                    {table.count > 10000 ? 'Large' : table.count > 0 ? 'Active' : 'Empty'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// SQL Query Tab
function QueryTab() {
  const [query, setQuery] = useState('SELECT * FROM User LIMIT 10;');
  const [readOnly, setReadOnly] = useState(true);
  const [result, setResult] = useState<{ rows?: unknown[]; error?: string; duration?: string } | null>(null);
  const [executing, setExecuting] = useState(false);

  const executeQuery = async () => {
    setExecuting(true);
    setResult(null);
    try {
      const res = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, readOnly }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ rows: data.result, duration: data.duration });
      } else {
        setResult({ error: data.error });
      }
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="text-lg font-semibold mb-4">SQL Query Runner</h3>
      
      <div className="space-y-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-32 p-3 bg-[var(--admin-surface-2)] border border-[var(--admin-border)] rounded-lg font-mono text-sm resize-y"
          placeholder="Enter SQL query..."
        />
        
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              className="rounded"
            />
            Read-only mode (safer)
          </label>
          
          <button onClick={executeQuery} disabled={executing} className="admin-btn admin-btn-primary">
            {executing ? <div className="admin-spinner" /> : <><MdPlayArrow size={18} /> Execute</>}
          </button>
        </div>

        {result && (
          <div className="mt-4">
            {result.error ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                <strong>Error:</strong> {result.error}
              </div>
            ) : (
              <>
                <div className="text-sm text-[var(--admin-text-secondary)] mb-2">
                  {Array.isArray(result.rows) ? result.rows.length : 0} rows returned in {result.duration}
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  {Array.isArray(result.rows) && result.rows.length > 0 && (
                    <table className="admin-table text-sm">
                      <thead>
                        <tr>
                          {Object.keys(result.rows[0] as object).map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i}>
                            {Object.values(row as object).map((val, j) => (
                              <td key={j} className="font-mono text-xs">
                                {val === null ? <span className="text-gray-500">NULL</span> : String(val).substring(0, 100)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Browse Tab
function BrowseTab({ tables }: { tables: TableStats[] }) {
  const [selectedTable, setSelectedTable] = useState(tables[0]?.name || '');
  const [data, setData] = useState<{ rows: unknown[]; columns: string[]; pagination: { page: number; totalPages: number; totalRows: number } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const loadTableData = async (tableName: string, pageNum: number, searchQuery: string) => {
    if (!tableName) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ table: tableName, page: String(pageNum), limit: '25' });
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/database/browse?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Failed to load table data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, page, search);
    }
  }, [selectedTable, page]);

  const handleSearch = () => {
    setPage(1);
    loadTableData(selectedTable, 1, search);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this row?')) return;
    try {
      const res = await fetch(`/api/database/browse?table=${selectedTable}&id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadTableData(selectedTable, page, search);
      } else {
        alert('Failed to delete');
      }
    } catch {
      alert('Error deleting row');
    }
  };

  return (
    <div className="admin-card">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          value={selectedTable}
          onChange={(e) => { setSelectedTable(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-[var(--admin-surface-2)] border border-[var(--admin-border)] rounded-lg"
        >
          {tables.map((t) => (
            <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
          ))}
        </select>

        <div className="flex gap-2 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search..."
            className="flex-1 px-3 py-2 bg-[var(--admin-surface-2)] border border-[var(--admin-border)] rounded-lg"
          />
          <button onClick={handleSearch} className="admin-btn admin-btn-primary">
            <MdSearch size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="admin-spinner" /></div>
      ) : data && (
        <>
          <div className="overflow-x-auto">
            <table className="admin-table text-sm">
              <thead>
                <tr>
                  {data.columns.map((col) => <th key={col}>{col}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row: unknown, i: number) => {
                  const rowData = row as Record<string, unknown>;
                  return (
                    <tr key={i}>
                      {data.columns.map((col) => (
                        <td key={col} className="font-mono text-xs max-w-48 truncate">
                          {rowData[col] === null ? <span className="text-gray-500">NULL</span> : String(rowData[col]).substring(0, 50)}
                        </td>
                      ))}
                      <td>
                        <button onClick={() => handleDelete(String(rowData.id))} className="text-red-400 hover:text-red-300">
                          <MdDelete size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-[var(--admin-text-secondary)]">
              {data.pagination.totalRows} total rows
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="admin-btn">
                <MdChevronLeft size={18} />
              </button>
              <span className="text-sm">Page {page} of {data.pagination.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))} disabled={page >= data.pagination.totalPages} className="admin-btn">
                <MdChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Schema Tab
function SchemaTab() {
  const [schema, setSchema] = useState<{ tables: SchemaTable[]; stats: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/database/schema')
      .then((res) => res.json())
      .then(setSchema)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="admin-spinner" /></div>;

  if (!schema || !schema.tables || schema.tables.length === 0) {
    return (
      <div className="admin-card text-center py-8">
        <p className="text-[var(--admin-text-muted)]">No schema data available</p>
        <button onClick={() => window.location.reload()} className="admin-btn admin-btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schema.tables.map((table) => (
        <div key={table.name} className="admin-card">
          <button
            onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <MdTableChart size={20} className="text-[var(--admin-text-muted)]" />
              <span className="font-semibold">{table.name}</span>
              <span className="text-sm text-[var(--admin-text-secondary)]">({table.rowCount} rows)</span>
            </div>
            <span className="text-sm text-[var(--admin-text-muted)]">{table.columns.length} columns</span>
          </button>

          {expandedTable === table.name && (
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Columns</h4>
                <table className="admin-table text-sm">
                  <thead>
                    <tr><th>Name</th><th>Type</th><th>Nullable</th><th>Primary Key</th></tr>
                  </thead>
                  <tbody>
                    {table.columns.map((col) => (
                      <tr key={col.name}>
                        <td className="font-mono">{col.name}</td>
                        <td>{col.type}</td>
                        <td>{col.notnull ? 'No' : 'Yes'}</td>
                        <td>{col.pk ? '✓' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {table.indexes.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Indexes</h4>
                  <table className="admin-table text-sm">
                    <thead><tr><th>Name</th><th>Columns</th><th>Unique</th></tr></thead>
                    <tbody>
                      {table.indexes.map((idx) => (
                        <tr key={idx.name}>
                          <td className="font-mono">{idx.name}</td>
                          <td>{idx.columns}</td>
                          <td>{idx.unique ? '✓' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Tools Tab
function ToolsTab() {
  const [result, setResult] = useState<{ tool: string; status?: string; analysis?: Record<string, unknown>; error?: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const runTool = async (tool: string) => {
    setLoading(tool);
    setResult(null);
    try {
      const res = await fetch(`/api/database/tools?tool=${tool}`);
      setResult(await res.json());
    } catch (error) {
      setResult({ tool, error: error instanceof Error ? error.message : 'Failed' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="admin-card">
        <h3 className="text-lg font-semibold mb-4">SQLite Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => runTool('integrity')} disabled={loading !== null} className="admin-btn admin-btn-primary justify-center py-4">
            {loading === 'integrity' ? <div className="admin-spinner" /> : <><MdHealthAndSafety size={20} /> Integrity Check</>}
          </button>
          <button onClick={() => runTool('analyzer')} disabled={loading !== null} className="admin-btn admin-btn-primary justify-center py-4">
            {loading === 'analyzer' ? <div className="admin-spinner" /> : <><MdStorage size={20} /> Analyze Database</>}
          </button>
          <button onClick={() => runTool('stats')} disabled={loading !== null} className="admin-btn admin-btn-primary justify-center py-4">
            {loading === 'stats' ? <div className="admin-spinner" /> : <><MdCode size={20} /> PRAGMA Stats</>}
          </button>
        </div>
      </div>

      {result && (
        <div className="admin-card">
          <h4 className="font-semibold mb-2">{result.tool} Results</h4>
          {result.error ? (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400">{result.error}</div>
          ) : (
            <pre className="p-3 bg-[var(--admin-surface-2)] rounded overflow-x-auto text-sm font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// Backup Tab
function BackupTab() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/database/backup')
      .then((res) => res.json())
      .then((data) => setBackups(data.backups || []))
      .finally(() => setLoading(false));
  }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/database/backup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBackups((prev) => [data.backup, ...prev]);
        alert('Backup created successfully!');
      } else {
        alert('Failed to create backup');
      }
    } catch {
      alert('Error creating backup');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Database Backups</h3>
        <button onClick={createBackup} disabled={creating} className="admin-btn admin-btn-primary">
          {creating ? <div className="admin-spinner" /> : <><MdBackup size={18} /> Create Backup</>}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="admin-spinner" /></div>
      ) : backups.length === 0 ? (
        <p className="text-[var(--admin-text-secondary)] text-center py-8">No backups yet</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Filename</th><th>Size</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.name}>
                <td className="font-mono text-sm">{backup.name}</td>
                <td>{backup.sizeFormatted}</td>
                <td>{new Date(backup.createdAt).toLocaleString()}</td>
                <td>
                  <button 
                    onClick={() => {
                      // Trigger download via API
                      window.open(`/api/database/backup/download?name=${encodeURIComponent(backup.name)}`, '_blank');
                    }}
                    className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]" 
                    title="Download backup"
                  >
                    <MdDownload size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
