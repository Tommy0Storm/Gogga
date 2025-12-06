'use client';

import { useState } from 'react';
import {
  MdSearch,
  MdPerson,
  MdEmail,
  MdReceipt,
  MdHistory,
  MdCardGiftcard,
} from 'react-icons/md';

interface UserDetails {
  id: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  subscription: {
    tier: string;
    status: string;
    credits: number;
    creditsUsed: number;
    monthlyCredits: number;
    imagesUsed: number;
    imagesLimit: number;
    startedAt: string | null;
    nextBilling: string | null;
    payfastToken: string | null;
  } | null;
  recentVouchers: {
    code: string;
    type: string;
    redeemedAt: string;
  }[];
  recentAuth: {
    action: string;
    createdAt: string;
    ip: string | null;
  }[];
}

export default function UsersPage() {
  const [searchEmail, setSearchEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    setLoading(true);
    setError(null);
    setUser(null);

    try {
      const res = await fetch(`/api/users?email=${encodeURIComponent(searchEmail)}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else if (res.status === 404) {
        setError('User not found');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch user');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAction = async (action: string, params?: Record<string, unknown>) => {
    if (!user) return;
    
    const confirmed = confirm(`Are you sure you want to ${action}?`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action,
          ...params,
        }),
      });

      if (res.ok) {
        alert('Action completed successfully');
        // Refresh user data
        handleSearch(new Event('submit') as unknown as React.FormEvent);
      } else {
        const data = await res.json();
        alert(`Action failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="admin-card">
        <h2 className="text-lg font-semibold mb-4">User Lookup</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <MdSearch
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]"
            />
            <input
              type="email"
              placeholder="Enter user email address..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="admin-input pl-10"
            />
          </div>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
            {loading ? <div className="admin-spinner" /> : 'Search'}
          </button>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="admin-card border-[var(--admin-error)]">
          <p className="text-[var(--admin-error)]">{error}</p>
        </div>
      )}

      {/* User Details */}
      {user && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="admin-card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--admin-surface-2)] flex items-center justify-center">
                  <MdPerson size={24} className="text-[var(--admin-text-muted)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{user.email}</h3>
                  <p className="text-sm text-[var(--admin-text-secondary)]">
                    ID: {user.id}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {user.isAdmin && (
                  <span className="status-badge status-badge-info">Admin</span>
                )}
                <span className={`status-badge ${
                  user.subscription?.tier === 'JIGGA' ? 'status-badge-success' :
                  user.subscription?.tier === 'JIVE' ? 'status-badge-warning' :
                  'status-badge-neutral'
                }`}>
                  {user.subscription?.tier || 'FREE'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-[var(--admin-text-secondary)]">Created</span>
                <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-[var(--admin-text-secondary)]">Sub Status</span>
                <p className="font-medium">{user.subscription?.status || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[var(--admin-text-secondary)]">Next Billing</span>
                <p className="font-medium">
                  {user.subscription?.nextBilling
                    ? new Date(user.subscription.nextBilling).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-[var(--admin-text-secondary)]">PayFast Token</span>
                <p className="font-medium">
                  {user.subscription?.payfastToken ? '••••' + user.subscription.payfastToken.slice(-4) : 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="admin-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MdReceipt size={20} />
              Usage This Period
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="metric-card">
                <span className="metric-label">Credits Used</span>
                <p className="metric-value">{user.subscription?.creditsUsed || 0}</p>
                <p className="text-xs text-[var(--admin-text-muted)]">
                  of {user.subscription?.monthlyCredits || 0} monthly
                </p>
              </div>
              <div className="metric-card">
                <span className="metric-label">Credit Balance</span>
                <p className="metric-value">{user.subscription?.credits || 0}</p>
                <p className="text-xs text-[var(--admin-text-muted)]">purchased credits</p>
              </div>
              <div className="metric-card">
                <span className="metric-label">Images Used</span>
                <p className="metric-value">{user.subscription?.imagesUsed || 0}</p>
                <p className="text-xs text-[var(--admin-text-muted)]">
                  of {user.subscription?.imagesLimit || 50} limit
                </p>
              </div>
              <div className="metric-card">
                <span className="metric-label">Images Left</span>
                <p className="metric-value">
                  {Math.max(0, (user.subscription?.imagesLimit || 50) - (user.subscription?.imagesUsed || 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="admin-card">
            <h3 className="font-semibold mb-4">Admin Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleAdminAction('send_login_email')}
                className="admin-btn admin-btn-primary"
              >
                <MdEmail size={18} />
                Send Login Email
              </button>
              <button
                onClick={() => {
                  const newTier = prompt('New tier (FREE, JIVE, JIGGA):');
                  if (newTier) handleAdminAction('override_tier', { tier: newTier.toUpperCase() });
                }}
                className="admin-btn admin-btn-primary"
              >
                Override Tier
              </button>
              <button
                onClick={() => {
                  const credits = prompt('Credits to add:');
                  if (credits) handleAdminAction('grant_credits', { credits: parseInt(credits) });
                }}
                className="admin-btn admin-btn-primary"
              >
                Grant Credits
              </button>
              <button
                onClick={() => handleAdminAction('reset_monthly')}
                className="admin-btn admin-btn-primary"
              >
                Reset Monthly Usage
              </button>
              <button
                onClick={() => handleAdminAction('toggle_admin')}
                className="admin-btn admin-btn-success"
              >
                {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
              </button>
              <button
                onClick={() => handleAdminAction('cancel_subscription')}
                className="admin-btn admin-btn-danger"
              >
                Cancel Subscription
              </button>
            </div>
          </div>

          {/* Recent Vouchers */}
          <div className="admin-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MdCardGiftcard size={20} />
              Redeemed Vouchers
            </h3>
            {user.recentVouchers.length > 0 ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Redeemed</th>
                  </tr>
                </thead>
                <tbody>
                  {user.recentVouchers.map((v, i) => (
                    <tr key={i}>
                      <td className="font-mono">{v.code}</td>
                      <td>{v.type}</td>
                      <td className="text-[var(--admin-text-secondary)]">
                        {new Date(v.redeemedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[var(--admin-text-muted)]">No vouchers redeemed</p>
            )}
          </div>

          {/* Recent Auth History */}
          <div className="admin-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MdHistory size={20} />
              Recent Auth Activity
            </h3>
            {user.recentAuth.length > 0 ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>IP</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {user.recentAuth.map((a, i) => (
                    <tr key={i}>
                      <td>
                        <span
                          className={`status-badge ${
                            a.action.includes('success')
                              ? 'status-badge-success'
                              : a.action.includes('failed')
                              ? 'status-badge-error'
                              : 'status-badge-neutral'
                          }`}
                        >
                          {a.action}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{a.ip || '—'}</td>
                      <td className="text-[var(--admin-text-secondary)]">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[var(--admin-text-muted)]">No recent auth activity</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
