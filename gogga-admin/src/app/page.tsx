'use client';

import { useEffect, useState } from 'react';
import {
  MdCloud,
  MdCloudOff,
  MdPeople,
  MdReceipt,
  MdCardGiftcard,
  MdWarning,
} from 'react-icons/md';

interface SystemStatus {
  backend: 'online' | 'offline' | 'loading';
  cepo: 'online' | 'offline' | 'loading';
  database: 'online' | 'offline' | 'loading';
}

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  pendingVouchers: number;
  recentErrors: number;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<SystemStatus>({
    backend: 'loading',
    cepo: 'loading',
    database: 'loading',
  });
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    pendingVouchers: 0,
    recentErrors: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSystemStatus();
    loadStats();
  }, []);

  const checkSystemStatus = async () => {
    // Check backend health
    try {
      const res = await fetch('/backend/health');
      setStatus((prev) => ({ ...prev, backend: res.ok ? 'online' : 'offline' }));
    } catch {
      setStatus((prev) => ({ ...prev, backend: 'offline' }));
    }

    // Check CePO health
    try {
      const res = await fetch('/api/health/cepo');
      const data = await res.json();
      setStatus((prev) => ({ ...prev, cepo: data.status === 'online' ? 'online' : 'offline' }));
    } catch {
      setStatus((prev) => ({ ...prev, cepo: 'offline' }));
    }

    // Check database
    try {
      const res = await fetch('/api/health/database');
      const data = await res.json();
      setStatus((prev) => ({ ...prev, database: data.status === 'online' ? 'online' : 'offline' }));
    } catch {
      setStatus((prev) => ({ ...prev, database: 'offline' }));
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ state }: { state: 'online' | 'offline' | 'loading' }) => {
    if (state === 'loading') {
      return <div className="admin-spinner" />;
    }
    if (state === 'online') {
      return <MdCloud size={24} className="text-(--admin-success)" />;
    }
    return <MdCloudOff size={24} className="text-(--admin-error)" />;
  };

  return (
    <div className="space-y-6">
      {/* System Status */}
      <section>
        <h2 className="text-sm font-semibold text-(--admin-text-secondary) uppercase tracking-wider mb-4">
          System Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Backend API */}
          <div className="admin-card flex items-center justify-between">
            <div>
              <p className="text-sm text-(--admin-text-secondary)">Backend API</p>
              <p className="text-lg font-semibold mt-1">Port 8000</p>
            </div>
            <StatusIcon state={status.backend} />
          </div>

          {/* CePO Service */}
          <div className="admin-card flex items-center justify-between">
            <div>
              <p className="text-sm text-(--admin-text-secondary)">CePO Sidecar</p>
              <p className="text-lg font-semibold mt-1">Port 8080</p>
            </div>
            <StatusIcon state={status.cepo} />
          </div>

          {/* Database */}
          <div className="admin-card flex items-center justify-between">
            <div>
              <p className="text-sm text-(--admin-text-secondary)">SQLite Database</p>
              <p className="text-lg font-semibold mt-1">Prisma ORM</p>
            </div>
            <StatusIcon state={status.database} />
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section>
        <h2 className="text-sm font-semibold text-(--admin-text-secondary) uppercase tracking-wider mb-4">
          Platform Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <span className="metric-label">Total Users</span>
              <MdPeople size={20} className="text-(--admin-text-muted)" />
            </div>
            <p className="metric-value">{loading ? '—' : stats.totalUsers}</p>
          </div>

          {/* Active Subscriptions */}
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <span className="metric-label">Active Subs</span>
              <MdReceipt size={20} className="text-(--admin-text-muted)" />
            </div>
            <p className="metric-value">{loading ? '—' : stats.activeSubscriptions}</p>
          </div>

          {/* Pending Vouchers */}
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <span className="metric-label">Active Vouchers</span>
              <MdCardGiftcard size={20} className="text-(--admin-text-muted)" />
            </div>
            <p className="metric-value">{loading ? '—' : stats.pendingVouchers}</p>
          </div>

          {/* Recent Errors */}
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <span className="metric-label">Recent Errors</span>
              <MdWarning size={20} className="text-(--admin-text-muted)" />
            </div>
            <p className="metric-value">{loading ? '—' : stats.recentErrors}</p>
            {stats.recentErrors > 0 && (
              <p className="metric-change negative">Last 24 hours</p>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-sm font-semibold text-(--admin-text-secondary) uppercase tracking-wider mb-4">
          Quick Actions
        </h2>
        <div className="admin-card">
          <div className="flex flex-wrap gap-3">
            <button className="admin-btn admin-btn-primary">
              Create Voucher
            </button>
            <button className="admin-btn admin-btn-primary">
              Lookup User
            </button>
            <button className="admin-btn admin-btn-success">
              Restart Backend
            </button>
            <button className="admin-btn admin-btn-danger">
              View Error Logs
            </button>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-sm font-semibold text-(--admin-text-secondary) uppercase tracking-wider mb-4">
          Recent Activity
        </h2>
        <div className="admin-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-(--admin-text-secondary)">—</td>
                <td>—</td>
                <td>—</td>
                <td className="text-(--admin-text-muted)">No recent activity</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
