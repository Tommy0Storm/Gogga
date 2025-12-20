'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  MdRefresh,
  MdKey,
  MdCheck,
  MdWarning,
  MdError,
  MdAccessTime,
  MdAdd,
  MdDelete,
} from 'react-icons/md';

interface KeyStats {
  name: string;
  key_preview: string;
  status: string;
  requests_remaining: {
    minute: number;
    hour: number;
    day: number;
  } | null;
  tokens_remaining: {
    minute: number;
    day: number;
  } | null;
  limits?: {
    requests_per_minute: number;
    requests_per_hour: number;
    requests_per_day: number;
    tokens_per_minute: number;
    tokens_per_day: number;
  };
  session_requests: number;
  session_429s: number;
  is_available: boolean;
  cooldown_remaining: number;
}

interface KeyRotationStats {
  timestamp: number;
  total_keys: number;
  available_keys: number;
  session_total_requests: number;
  session_total_429s: number;
  keys: KeyStats[];
}

export default function ApiKeysPage() {
  const [stats, setStats] = useState<KeyRotationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Add key modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [addingKey, setAddingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const fetchStats = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/backend/api/v1/admin/cerebras/keys');
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const addKey = async () => {
    if (!newKeyValue.trim() || !newKeyName.trim()) return;
    
    setAddingKey(true);
    try {
      const res = await fetch('/backend/api/v1/admin/cerebras/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: newKeyValue.trim(), name: newKeyName.trim() }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to add key');
      }
      
      // Success - close modal and refresh
      setShowAddModal(false);
      setNewKeyValue('');
      setNewKeyName('');
      fetchStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add key');
    } finally {
      setAddingKey(false);
    }
  };

  const deleteKey = async (name: string) => {
    if (!confirm(`Delete API key "${name}"? This cannot be undone.`)) return;
    
    setDeletingKey(name);
    try {
      const res = await fetch('/backend/api/v1/admin/cerebras/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to delete key');
      }
      
      // Success - refresh
      fetchStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete key');
    } finally {
      setDeletingKey(null);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchStats(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  const getUsagePercent = (remaining: number, limit: number) => {
    const used = limit - remaining;
    return Math.round((used / limit) * 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'var(--admin-error)';
    if (percent >= 70) return 'var(--admin-warning)';
    return 'var(--admin-success)';
  };

  const StatusIcon = ({ status, isAvailable }: { status: string; isAvailable: boolean }) => {
    if (!isAvailable) {
      return <MdAccessTime className="text-[var(--admin-warning)]" size={20} />;
    }
    if (status === 'ok') {
      return <MdCheck className="text-[var(--admin-success)]" size={20} />;
    }
    if (status.includes('429')) {
      return <MdWarning className="text-[var(--admin-warning)]" size={20} />;
    }
    return <MdError className="text-[var(--admin-error)]" size={20} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MdKey size={28} />
            Cerebras API Keys
          </h1>
          <p className="text-[var(--admin-text-secondary)] mt-1">
            Load balancing across {stats?.total_keys || 0} API keys
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-success)] text-white rounded-lg hover:opacity-90 transition-colors"
          >
            <MdAdd size={20} />
            Add Key
          </button>
          <button
            onClick={() => fetchStats()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-surface-2)] rounded-lg hover:bg-[var(--admin-border)] transition-colors disabled:opacity-50"
          >
            <MdRefresh className={loading ? 'animate-spin' : ''} size={20} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="admin-card p-4">
            <div className="text-3xl font-bold">{stats.total_keys}</div>
            <div className="text-[var(--admin-text-secondary)]">Total Keys</div>
          </div>
          <div className="admin-card p-4">
            <div className="text-3xl font-bold text-[var(--admin-success)]">
              {stats.available_keys}
            </div>
            <div className="text-[var(--admin-text-secondary)]">Available</div>
          </div>
          <div className="admin-card p-4">
            <div className="text-3xl font-bold">{stats.session_total_requests}</div>
            <div className="text-[var(--admin-text-secondary)]">Session Requests</div>
          </div>
          <div className="admin-card p-4">
            <div className={`text-3xl font-bold ${stats.session_total_429s > 0 ? 'text-[var(--admin-warning)]' : ''}`}>
              {stats.session_total_429s}
            </div>
            <div className="text-[var(--admin-text-secondary)]">Rate Limits Hit</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="admin-card p-4 border-l-4 border-[var(--admin-error)]">
          <div className="flex items-center gap-2 text-[var(--admin-error)]">
            <MdError size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Keys Table */}
      {stats && (
        <div className="admin-card overflow-hidden">
          <div className="p-4 border-b border-[var(--admin-border)]">
            <h2 className="text-lg font-semibold">API Key Status</h2>
            {lastRefresh && (
              <p className="text-sm text-[var(--admin-text-muted)]">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--admin-surface-2)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Account</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Key</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Requests/Day</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Tokens/Day</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Session</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {stats.keys.map((key, idx) => {
                  const reqDayPercent = key.requests_remaining && key.limits
                    ? getUsagePercent(key.requests_remaining.day, key.limits.requests_per_day)
                    : 0;
                  const tokDayPercent = key.tokens_remaining && key.limits
                    ? getUsagePercent(key.tokens_remaining.day, key.limits.tokens_per_day)
                    : 0;

                  return (
                    <tr key={idx} className={!key.is_available ? 'opacity-60' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{key.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-sm bg-[var(--admin-surface-2)] px-2 py-1 rounded">
                          {key.key_preview}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={key.status} isAvailable={key.is_available} />
                          <span className="text-sm">
                            {!key.is_available 
                              ? `Cooldown ${key.cooldown_remaining.toFixed(0)}s`
                              : key.status
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {key.requests_remaining && key.limits ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{key.requests_remaining.day.toLocaleString()}</span>
                              <span className="text-[var(--admin-text-muted)]">
                                / {key.limits.requests_per_day.toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[var(--admin-surface-2)] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${reqDayPercent}%`,
                                  backgroundColor: getUsageColor(reqDayPercent),
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--admin-text-muted)]">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {key.tokens_remaining && key.limits ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{(key.tokens_remaining.day / 1000).toFixed(0)}K</span>
                              <span className="text-[var(--admin-text-muted)]">
                                / {(key.limits.tokens_per_day / 1000).toFixed(0)}K
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[var(--admin-surface-2)] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${tokDayPercent}%`,
                                  backgroundColor: getUsageColor(tokDayPercent),
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--admin-text-muted)]">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span>{key.session_requests} req</span>
                          {key.session_429s > 0 && (
                            <span className="ml-2 text-[var(--admin-warning)]">
                              ({key.session_429s} 429s)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteKey(key.name)}
                          disabled={deletingKey === key.name || (stats?.total_keys ?? 0) <= 1}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-[var(--admin-error)] hover:bg-[var(--admin-error)] hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={(stats?.total_keys ?? 0) <= 1 ? 'Cannot delete the last key' : `Delete ${key.name}`}
                        >
                          <MdDelete size={16} />
                          {deletingKey === key.name ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configuration Help */}
      <div className="admin-card p-4">
        <h3 className="font-semibold mb-2">Adding More Keys</h3>
        <p className="text-sm text-[var(--admin-text-secondary)] mb-3">
          You can add keys using the button above, or manually edit <code className="bg-[var(--admin-surface-2)] px-1 rounded">gogga-backend/.env</code>:
        </p>
        <pre className="bg-[var(--admin-surface-2)] p-3 rounded-lg text-sm overflow-x-auto">
{`# Format: key1:name1,key2:name2,...
CEREBRAS_API_KEYS=csk-xxx:account1,csk-yyy:account2,csk-zzz:account3`}
        </pre>
        <p className="text-sm text-[var(--admin-text-muted)] mt-3">
          Keys are automatically reloaded after adding or deleting. Each key provides: 30 req/min, 900 req/hr, 14,400 req/day, 64K tokens/min, 1M tokens/day.
        </p>
      </div>

      {/* Add Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--admin-surface)] rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-[var(--admin-border)]">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MdAdd size={24} />
                Add Cerebras API Key
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Account Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., my-account"
                  className="w-full px-3 py-2 bg-[var(--admin-surface-2)] border border-[var(--admin-border)] rounded-lg focus:outline-none focus:border-[var(--admin-text-muted)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder="csk-..."
                  className="w-full px-3 py-2 bg-[var(--admin-surface-2)] border border-[var(--admin-border)] rounded-lg focus:outline-none focus:border-[var(--admin-text-muted)] font-mono"
                />
                <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                  Get your API key from <a href="https://cloud.cerebras.ai" target="_blank" rel="noopener noreferrer" className="underline">cloud.cerebras.ai</a>
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-[var(--admin-border)] flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewKeyValue('');
                  setNewKeyName('');
                }}
                className="px-4 py-2 bg-[var(--admin-surface-2)] rounded-lg hover:bg-[var(--admin-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addKey}
                disabled={addingKey || !newKeyValue.trim() || !newKeyName.trim()}
                className="px-4 py-2 bg-[var(--admin-success)] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {addingKey ? 'Adding...' : 'Add Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
