'use client';

import { useState, useEffect } from 'react';
import { MdSearch, MdRefresh } from 'react-icons/md';

interface SubscriptionRow {
  id: string;
  userId: string;
  userEmail: string;
  tier: string;
  status: string;
  credits: number;
  creditsUsed: number;
  imagesUsed: number;
  imagesLimit: number;
  nextBilling: string | null;
  payfastToken: string | null;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadSubscriptions();
  }, [tierFilter, statusFilter]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/subscriptions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (userId: string, action: string, params?: Record<string, unknown>) => {
    const confirmed = confirm(`Are you sure you want to ${action}?`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/subscriptions/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, ...params }),
      });

      if (res.ok) {
        loadSubscriptions();
      } else {
        const data = await res.json();
        alert(`Action failed: ${data.error}`);
      }
    } catch {
      alert('Network error');
    }
  };

  const filteredSubscriptions = subscriptions.filter(
    (s) =>
      s.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.userId.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <MdSearch
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]"
          />
          <input
            type="text"
            placeholder="Search by email or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-input pl-10"
          />
        </div>

        {/* Tier Filter */}
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="admin-select w-32"
        >
          <option value="all">All Tiers</option>
          <option value="FREE">FREE</option>
          <option value="JIVE">JIVE</option>
          <option value="JIGGA">JIGGA</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-select w-36"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="past_due">Past Due</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <button onClick={loadSubscriptions} className="admin-btn admin-btn-primary">
          <MdRefresh size={18} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <span className="metric-label">Total</span>
          <p className="metric-value">{subscriptions.length}</p>
        </div>
        <div className="metric-card">
          <span className="metric-label">JIGGA</span>
          <p className="metric-value">
            {subscriptions.filter((s) => s.tier === 'JIGGA').length}
          </p>
        </div>
        <div className="metric-card">
          <span className="metric-label">JIVE</span>
          <p className="metric-value">
            {subscriptions.filter((s) => s.tier === 'JIVE').length}
          </p>
        </div>
        <div className="metric-card">
          <span className="metric-label">Past Due</span>
          <p className="metric-value text-[var(--admin-warning)]">
            {subscriptions.filter((s) => s.status === 'past_due').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="admin-card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="admin-spinner" />
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <p className="text-center text-[var(--admin-text-muted)] py-8">
            No subscriptions found
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Credits</th>
                <th>Images</th>
                <th>Next Billing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div>
                      <p className="font-medium">{s.userEmail}</p>
                      <p className="text-xs text-[var(--admin-text-muted)]">
                        {s.userId.slice(0, 8)}...
                      </p>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        s.tier === 'JIGGA'
                          ? 'status-badge-success'
                          : s.tier === 'JIVE'
                          ? 'status-badge-warning'
                          : 'status-badge-neutral'
                      }`}
                    >
                      {s.tier}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        s.status === 'active'
                          ? 'status-badge-success'
                          : s.status === 'past_due'
                          ? 'status-badge-warning'
                          : s.status === 'cancelled'
                          ? 'status-badge-error'
                          : 'status-badge-neutral'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="text-sm">
                    {s.creditsUsed.toLocaleString()} used
                    {s.credits > 0 && (
                      <span className="text-[var(--admin-success)]">
                        {' '}
                        + {s.credits.toLocaleString()} balance
                      </span>
                    )}
                  </td>
                  <td className="text-sm">
                    {s.imagesUsed} / {s.imagesLimit}
                  </td>
                  <td className="text-[var(--admin-text-secondary)]">
                    {s.nextBilling
                      ? new Date(s.nextBilling).toLocaleDateString()
                      : '—'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const tier = prompt('New tier (FREE, JIVE, JIGGA):');
                          if (tier) handleAction(s.userId, 'override_tier', { tier: tier.toUpperCase() });
                        }}
                        className="text-xs px-2 py-1 rounded bg-[var(--admin-surface-2)] hover:bg-[var(--admin-border)]"
                      >
                        Tier
                      </button>
                      <button
                        onClick={() => {
                          const credits = prompt('Credits to add:');
                          if (credits) handleAction(s.userId, 'grant_credits', { credits: parseInt(credits) });
                        }}
                        className="text-xs px-2 py-1 rounded bg-[var(--admin-surface-2)] hover:bg-[var(--admin-border)]"
                      >
                        +Credits
                      </button>
                      {s.status !== 'cancelled' && (
                        <button
                          onClick={() => handleAction(s.userId, 'cancel')}
                          className="text-xs px-2 py-1 rounded text-[var(--admin-error)] bg-[var(--admin-surface-2)] hover:bg-[var(--admin-error)] hover:text-white"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
