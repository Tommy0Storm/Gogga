'use client';

import { useState, useEffect } from 'react';
import {
  MdAdd,
  MdSearch,
  MdDelete,
  MdBlock,
  MdContentCopy,
  MdDownload,
} from 'react-icons/md';

interface Voucher {
  id: string;
  code: string;
  type: string;
  value: number;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  voided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  redeemed: boolean;
  redeemedAt: string | null;
  redeemedBy: string | null;
  batchId: string | null;
}

type TabType = 'create' | 'active' | 'redeemed' | 'voided';

const VOUCHER_TYPES = [
  { value: 'JIGGA_1MONTH', label: 'JIGGA 1 Month', description: 'Free month of JIGGA tier' },
  { value: 'JIVE_1MONTH', label: 'JIVE 1 Month', description: 'Free month of JIVE tier' },
  { value: 'R200', label: 'R200 Credits', description: '50,000 credits' },
  { value: 'R500', label: 'R500 Credits', description: '150,000 credits' },
  { value: 'R1000', label: 'R1000 Credits', description: '350,000 credits' },
];

export default function VouchersPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [createType, setCreateType] = useState('JIGGA_1MONTH');
  const [createCount, setCreateCount] = useState(1);
  const [createExpiry, setCreateExpiry] = useState(30); // days
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadVouchers();
  }, [activeTab]);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const filter =
        activeTab === 'active'
          ? 'active'
          : activeTab === 'redeemed'
          ? 'redeemed'
          : activeTab === 'voided'
          ? 'voided'
          : 'all';

      const res = await fetch(`/api/vouchers?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setVouchers(data.vouchers || []);
      }
    } catch (error) {
      console.error('Failed to load vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: createType,
          count: createCount,
          expiryDays: createExpiry,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Created ${data.count} voucher(s)`);
        setActiveTab('active');
        loadVouchers();
      } else {
        const data = await res.json();
        alert(`Failed to create vouchers: ${data.error}`);
      }
    } catch (error) {
      alert('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleVoid = async (voucherId: string) => {
    const reason = prompt('Reason for voiding:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/vouchers/${voucherId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        loadVouchers();
      } else {
        const data = await res.json();
        alert(`Failed to void: ${data.error}`);
      }
    } catch {
      alert('Network error');
    }
  };

  const handleDelete = async (voucherId: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/vouchers/${voucherId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadVouchers();
      } else {
        const data = await res.json();
        alert(`Failed to delete: ${data.error}`);
      }
    } catch {
      alert('Network error');
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    // Show brief feedback
  };

  const exportCSV = () => {
    const headers = ['Code', 'Type', 'Status', 'Created', 'Expires', 'Redeemed By'];
    const rows = vouchers.map((v) => [
      v.code,
      v.type,
      v.voided ? 'Voided' : v.redeemed ? 'Redeemed' : 'Active',
      new Date(v.createdAt).toLocaleDateString(),
      new Date(v.expiresAt).toLocaleDateString(),
      v.redeemedBy || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vouchers-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredVouchers = vouchers.filter(
    (v) =>
      v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.redeemedBy?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="admin-tabs">
        {(['active', 'create', 'redeemed', 'voided'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Create Tab */}
      {activeTab === 'create' && (
        <div className="admin-card max-w-xl">
          <h3 className="text-lg font-semibold mb-4">Create Vouchers</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Type */}
            <div>
              <label className="admin-label">Voucher Type</label>
              <select
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
                className="admin-select"
              >
                {VOUCHER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} - {t.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Count */}
            <div>
              <label className="admin-label">Number of Vouchers</label>
              <input
                type="number"
                min={1}
                max={100}
                value={createCount}
                onChange={(e) => setCreateCount(parseInt(e.target.value) || 1)}
                className="admin-input"
              />
              <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                Max 100 vouchers per batch
              </p>
            </div>

            {/* Expiry */}
            <div>
              <label className="admin-label">Valid For (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={createExpiry}
                onChange={(e) => setCreateExpiry(parseInt(e.target.value) || 30)}
                className="admin-input"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="admin-btn admin-btn-primary w-full"
            >
              {creating ? (
                <div className="admin-spinner" />
              ) : (
                <>
                  <MdAdd size={18} />
                  Create {createCount} Voucher{createCount > 1 ? 's' : ''}
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* List Tabs */}
      {activeTab !== 'create' && (
        <>
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <MdSearch
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]"
              />
              <input
                type="text"
                placeholder="Search by code or user email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-input pl-10"
              />
            </div>
            <button onClick={exportCSV} className="admin-btn admin-btn-primary">
              <MdDownload size={18} />
              Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="admin-card overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="admin-spinner" />
              </div>
            ) : filteredVouchers.length === 0 ? (
              <p className="text-center text-[var(--admin-text-muted)] py-8">
                No vouchers found
              </p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>{activeTab === 'redeemed' ? 'Redeemed By' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-[var(--admin-surface-2)] px-2 py-1 rounded">
                            {v.code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(v.code)}
                            className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
                            title="Copy"
                          >
                            <MdContentCopy size={16} />
                          </button>
                        </div>
                      </td>
                      <td>{v.type}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            v.voided
                              ? 'status-badge-error'
                              : v.redeemed
                              ? 'status-badge-success'
                              : new Date(v.expiresAt) < new Date()
                              ? 'status-badge-warning'
                              : 'status-badge-info'
                          }`}
                        >
                          {v.voided
                            ? 'Voided'
                            : v.redeemed
                            ? 'Redeemed'
                            : new Date(v.expiresAt) < new Date()
                            ? 'Expired'
                            : 'Active'}
                        </span>
                      </td>
                      <td className="text-[var(--admin-text-secondary)]">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-[var(--admin-text-secondary)]">
                        {new Date(v.expiresAt).toLocaleDateString()}
                      </td>
                      <td>
                        {activeTab === 'redeemed' ? (
                          <span className="text-sm">{v.redeemedBy}</span>
                        ) : (
                          <div className="flex gap-2">
                            {!v.voided && !v.redeemed && (
                              <button
                                onClick={() => handleVoid(v.id)}
                                className="text-[var(--admin-warning)] hover:text-[var(--admin-text)]"
                                title="Void"
                              >
                                <MdBlock size={18} />
                              </button>
                            )}
                            {!v.redeemed && (
                              <button
                                onClick={() => handleDelete(v.id)}
                                className="text-[var(--admin-error)] hover:text-[var(--admin-text)]"
                                title="Delete"
                              >
                                <MdDelete size={18} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
