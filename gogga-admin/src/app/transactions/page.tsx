'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MdRefresh,
  MdWarning,
  MdError,
  MdCheckCircle,
  MdPayment,
  MdSchedule,
  MdReplay,
  MdCancel,
  MdPlayArrow,
  MdClear,
} from 'react-icons/md';

interface TransactionStats {
  pendingSubscriptions: number;
  failedPayments: number;
  retryPending: number;
  pendingCredits: number;
}

interface Transaction {
  id: string;
  type: 'subscription' | 'credit_purchase';
  userId: string;
  userEmail: string | null;
  tier?: string;
  status: string;
  retryCount?: number;
  paymentFailedAt?: string | null;
  nextBilling?: string | null;
  hasPayfastToken?: boolean;
  createdAt: string;
  updatedAt?: string;
  errorDetails: string | null;
  // Credit purchase fields
  packSize?: string;
  credits?: number;
  pfPaymentId?: string | null;
  expiresAt?: string | null;
}

interface RecentPayment {
  id: string;
  pfPaymentId: string;
  type: string;
  amount: number;
  userId: string;
  processedAt: string;
}

export default function TransactionsPage() {
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<Transaction[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'failed'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/transactions?status=${statusFilter}`);
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load transactions');
      }
      
      const data = await res.json();
      setStats(data.stats);
      setTransactions(data.transactions || []);
      setCreditTransactions(data.creditTransactions || []);
      setRecentPayments(data.recentPayments || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadTransactions();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadTransactions]);

  const handleAction = async (
    action: string,
    subscriptionId: string,
    userId: string,
    reason?: string
  ) => {
    setActionLoading(subscriptionId);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, subscriptionId, userId, reason }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        alert(`Action failed: ${data.error}`);
        return;
      }

      // Refresh the list
      loadTransactions();
    } catch (err) {
      alert('Network error - please try again');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="status-badge status-badge-warning flex items-center gap-1">
            <MdSchedule size={14} />
            Pending
          </span>
        );
      case 'past_due':
        return (
          <span className="status-badge status-badge-error flex items-center gap-1">
            <MdError size={14} />
            Past Due
          </span>
        );
      case 'failed':
        return (
          <span className="status-badge status-badge-error flex items-center gap-1">
            <MdError size={14} />
            Failed
          </span>
        );
      case 'active':
        return (
          <span className="status-badge status-badge-success flex items-center gap-1">
            <MdCheckCircle size={14} />
            Active
          </span>
        );
      default:
        return <span className="status-badge status-badge-neutral">{status}</span>;
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="admin-spinner" />
        <span className="ml-3 text-(--admin-text-secondary)">Loading transactions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-card border-(--admin-error) bg-(--admin-error)/10">
        <div className="flex items-center gap-3">
          <MdError size={24} className="text-(--admin-error)" />
          <div>
            <h3 className="font-semibold text-(--admin-error)">Error Loading Transactions</h3>
            <p className="text-sm text-(--admin-text-secondary)">{error}</p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              loadTransactions();
            }}
            className="ml-auto admin-btn admin-btn-primary"
          >
            <MdRefresh size={18} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const allTransactions = [...transactions, ...creditTransactions];
  const needsAttention = (stats?.pendingSubscriptions || 0) + (stats?.failedPayments || 0);

  return (
    <div className="space-y-6">
      {/* Header with Alert */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MdPayment size={28} className="text-(--admin-primary)" />
          <div>
            <h1 className="text-2xl font-bold">Transaction Monitor</h1>
            <p className="text-sm text-(--admin-text-secondary)">
              Monitor pending and failed payments
            </p>
          </div>
          {needsAttention > 0 && (
            <span className="px-3 py-1 bg-(--admin-warning)/20 text-(--admin-warning) rounded-full text-sm font-medium animate-pulse">
              {needsAttention} needs attention
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-(--admin-text-secondary)">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={loadTransactions}
            disabled={loading}
            className="admin-btn admin-btn-primary"
          >
            <MdRefresh size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <span className="metric-label flex items-center gap-1">
              <MdSchedule size={16} className="text-(--admin-warning)" />
              Pending Subscriptions
            </span>
            <p className={`metric-value ${stats.pendingSubscriptions > 0 ? 'text-(--admin-warning)' : ''}`}>
              {stats.pendingSubscriptions}
            </p>
          </div>
          <div className="metric-card">
            <span className="metric-label flex items-center gap-1">
              <MdError size={16} className="text-(--admin-error)" />
              Failed Payments
            </span>
            <p className={`metric-value ${stats.failedPayments > 0 ? 'text-(--admin-error)' : ''}`}>
              {stats.failedPayments}
            </p>
          </div>
          <div className="metric-card">
            <span className="metric-label flex items-center gap-1">
              <MdReplay size={16} />
              Retry Pending
            </span>
            <p className="metric-value">{stats.retryPending}</p>
          </div>
          <div className="metric-card">
            <span className="metric-label flex items-center gap-1">
              <MdPayment size={16} />
              Pending Credits
            </span>
            <p className="metric-value">{stats.pendingCredits}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'pending', 'failed'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-(--admin-primary) text-white'
                : 'bg-(--admin-surface-2) hover:bg-(--admin-border)'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="admin-card overflow-x-auto">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <MdWarning size={20} className="text-(--admin-warning)" />
          Transactions Requiring Attention
        </h3>

        {allTransactions.length === 0 ? (
          <div className="text-center py-12 text-(--admin-text-muted)">
            <MdCheckCircle size={48} className="mx-auto mb-3 text-(--admin-success)" />
            <p>All transactions are healthy!</p>
            <p className="text-sm mt-1">No pending or failed payments found.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>User</th>
                <th>Details</th>
                <th>Status</th>
                <th>Error Details</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allTransactions.map((tx) => (
                <tr key={tx.id} className={tx.errorDetails ? 'bg-(--admin-warning)/5' : ''}>
                  <td>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-(--admin-surface-2)">
                      {tx.type === 'subscription' ? 'Subscription' : 'Credit Pack'}
                    </span>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium">{tx.userEmail || tx.userId.slice(0, 12) + '...'}</p>
                      <p className="text-xs text-(--admin-text-muted)">{tx.userId.slice(0, 8)}...</p>
                    </div>
                  </td>
                  <td>
                    {tx.type === 'subscription' ? (
                      <div className="text-sm">
                        <span className="font-medium">{tx.tier}</span>
                        {tx.nextBilling && (
                          <p className="text-xs text-(--admin-text-muted)">
                            Next: {formatDate(tx.nextBilling)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm">
                        <span className="font-medium">{tx.packSize}</span>
                        <p className="text-xs text-(--admin-text-muted)">
                          {tx.credits?.toLocaleString()} credits
                        </p>
                      </div>
                    )}
                  </td>
                  <td>
                    {getStatusBadge(tx.status)}
                    {tx.retryCount !== undefined && tx.retryCount > 0 && (
                      <span className="block text-xs text-(--admin-warning) mt-1">
                        Retry #{tx.retryCount}
                      </span>
                    )}
                  </td>
                  <td>
                    {tx.errorDetails ? (
                      <p className="text-xs text-(--admin-warning) max-w-xs">{tx.errorDetails}</p>
                    ) : (
                      <span className="text-(--admin-text-muted)">—</span>
                    )}
                  </td>
                  <td className="text-sm text-(--admin-text-secondary)">
                    {formatDate(tx.createdAt)}
                  </td>
                  <td>
                    {tx.type === 'subscription' && (
                      <div className="flex gap-2">
                        {tx.status === 'past_due' && (
                          <button
                            onClick={() => handleAction('retry_payment', tx.id, tx.userId)}
                            disabled={actionLoading === tx.id}
                            className="text-xs px-2 py-1 rounded bg-(--admin-primary) text-white hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                          >
                            <MdReplay size={14} />
                            Retry
                          </button>
                        )}
                        {tx.status === 'pending' && (
                          <button
                            onClick={() => handleAction('reactivate', tx.id, tx.userId, 'Manual activation')}
                            disabled={actionLoading === tx.id}
                            className="text-xs px-2 py-1 rounded bg-(--admin-success) text-white hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                          >
                            <MdPlayArrow size={14} />
                            Activate
                          </button>
                        )}
                        {tx.paymentFailedAt && (
                          <button
                            onClick={() => handleAction('clear_failure', tx.id, tx.userId)}
                            disabled={actionLoading === tx.id}
                            className="text-xs px-2 py-1 rounded bg-(--admin-surface-2) hover:bg-(--admin-border) flex items-center gap-1"
                          >
                            <MdClear size={14} />
                            Clear
                          </button>
                        )}
                        {tx.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              if (confirm('Cancel this subscription?')) {
                                handleAction('cancel_subscription', tx.id, tx.userId);
                              }
                            }}
                            disabled={actionLoading === tx.id}
                            className="text-xs px-2 py-1 rounded bg-(--admin-error) text-white hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                          >
                            <MdCancel size={14} />
                            Cancel
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

      {/* Recent Successful Payments */}
      {recentPayments.length > 0 && (
        <div className="admin-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MdCheckCircle size={20} className="text-(--admin-success)" />
            Recent Successful Payments
          </h3>
          <div className="grid gap-2">
            {recentPayments.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-(--admin-surface-2) rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <MdCheckCircle size={18} className="text-(--admin-success)" />
                  <div>
                    <p className="text-sm font-medium">
                      {p.type} — R{(p.amount / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-(--admin-text-muted)">
                      PayFast ID: {p.pfPaymentId}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-(--admin-text-secondary)">
                  {formatDate(p.processedAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
