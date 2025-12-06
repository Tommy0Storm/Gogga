'use client';

import { useState, useEffect } from 'react';
import { MdInfo, MdRefresh, MdLock } from 'react-icons/md';

interface SystemInfo {
  environment: string;
  version: string;
  nodeVersion: string;
  buildTime?: string;
  gitCommit?: string;
  services: {
    backendUrl: string;
    cepoUrl: string;
    frontendUrl: string;
    databaseUrl: string;
    payfastEnv: string;
  };
  uptime: {
    admin: string;
  };
}

export default function SettingsPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      }
    } catch (error) {
      console.error('Failed to load system info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="admin-spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--admin-text-secondary)] uppercase tracking-wider">
          System Configuration
        </h2>
        <button onClick={loadSystemInfo} className="admin-btn admin-btn-primary">
          <MdRefresh size={18} />
        </button>
      </div>

      {/* Environment Info */}
      <div className="admin-card">
        <div className="flex items-center gap-2 mb-4">
          <MdInfo size={20} className="text-[var(--admin-text-muted)]" />
          <h3 className="font-semibold">Environment</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <span className="admin-label">Environment</span>
            <p className="font-medium">
              <span
                className={`status-badge ${
                  info?.environment === 'production'
                    ? 'status-badge-success'
                    : 'status-badge-warning'
                }`}
              >
                {info?.environment || 'development'}
              </span>
            </p>
          </div>
          <div>
            <span className="admin-label">Admin Version</span>
            <p className="font-medium">{info?.version || '1.0.0'}</p>
          </div>
          <div>
            <span className="admin-label">Node.js</span>
            <p className="font-medium">{info?.nodeVersion || 'Unknown'}</p>
          </div>
          {info?.buildTime && (
            <div>
              <span className="admin-label">Build Time</span>
              <p className="font-medium">{info.buildTime}</p>
            </div>
          )}
          {info?.gitCommit && (
            <div>
              <span className="admin-label">Git Commit</span>
              <p className="font-mono text-sm">{info.gitCommit}</p>
            </div>
          )}
          <div>
            <span className="admin-label">Uptime</span>
            <p className="font-medium">{info?.uptime.admin || 'Unknown'}</p>
          </div>
        </div>
      </div>

      {/* Service URLs */}
      <div className="admin-card">
        <div className="flex items-center gap-2 mb-4">
          <MdLock size={20} className="text-[var(--admin-text-muted)]" />
          <h3 className="font-semibold">Service Configuration</h3>
          <span className="text-xs text-[var(--admin-text-muted)]">(Read Only)</span>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="admin-label">Backend URL</span>
              <p className="font-mono text-sm bg-[var(--admin-surface-2)] px-3 py-2 rounded">
                {info?.services.backendUrl || 'http://localhost:8000'}
              </p>
            </div>
            <div>
              <span className="admin-label">CePO URL</span>
              <p className="font-mono text-sm bg-[var(--admin-surface-2)] px-3 py-2 rounded">
                {info?.services.cepoUrl || 'http://localhost:8080'}
              </p>
            </div>
            <div>
              <span className="admin-label">Frontend URL</span>
              <p className="font-mono text-sm bg-[var(--admin-surface-2)] px-3 py-2 rounded">
                {info?.services.frontendUrl || 'http://localhost:3000'}
              </p>
            </div>
            <div>
              <span className="admin-label">Database</span>
              <p className="font-mono text-sm bg-[var(--admin-surface-2)] px-3 py-2 rounded">
                {info?.services.databaseUrl
                  ? info.services.databaseUrl.replace(/:[^:]*@/, ':****@')
                  : 'file:./prisma/dev.db'}
              </p>
            </div>
          </div>
          <div>
            <span className="admin-label">PayFast Environment</span>
            <p>
              <span
                className={`status-badge ${
                  info?.services.payfastEnv === 'production'
                    ? 'status-badge-success'
                    : 'status-badge-warning'
                }`}
              >
                {info?.services.payfastEnv || 'sandbox'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Admin Emails */}
      <div className="admin-card">
        <h3 className="font-semibold mb-4">Admin Users</h3>
        <div className="bg-[var(--admin-surface-2)] p-4 rounded-lg">
          <p className="text-sm text-[var(--admin-text-secondary)]">
            Admin emails are configured via the <code className="text-[var(--admin-text)]">ADMIN_EMAILS</code>{' '}
            environment variable.
          </p>
          <p className="text-sm text-[var(--admin-text-muted)] mt-2">
            Users with the <code>isAdmin</code> flag set can also access this panel.
          </p>
        </div>
      </div>

      {/* Rate Limits */}
      <div className="admin-card">
        <h3 className="font-semibold mb-4">Tier Rate Limits</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Monthly Credits</th>
              <th>Image Limit</th>
              <th>RAG Docs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="status-badge status-badge-neutral">FREE</span></td>
              <td>0</td>
              <td>50</td>
              <td>0</td>
            </tr>
            <tr>
              <td><span className="status-badge status-badge-warning">JIVE</span></td>
              <td>200,000</td>
              <td>200</td>
              <td>5</td>
            </tr>
            <tr>
              <td><span className="status-badge status-badge-success">JIGGA</span></td>
              <td>500,000</td>
              <td>1,000</td>
              <td>10</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
