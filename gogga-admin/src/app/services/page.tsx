'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  MdPlayArrow,
  MdStop,
  MdRefresh,
  MdCloud,
  MdTerminal,
  MdClose,
  MdApi,
  MdWeb,
  MdPsychology,
  MdSchedule,
  MdSupervisorAccount,
  MdAdd,
  MdRemove,
} from 'react-icons/md';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

// Client-side mount check to prevent SSR dimension errors with ResponsiveContainer
function useIsMounted(): boolean {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  return isMounted;
}

// Safe wrapper for ResponsiveContainer that only renders on client
interface ClientResponsiveContainerProps {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  children: React.ReactElement;
}

const ClientResponsiveContainer: React.FC<ClientResponsiveContainerProps> = ({
  width = '100%',
  height = '100%',
  children,
}) => {
  const isMounted = useIsMounted();
  
  if (!isMounted) {
    return (
      <div 
        className="flex items-center justify-center bg-(--admin-bg-secondary) rounded-lg animate-pulse"
        style={{ 
          width: typeof width === 'number' ? `${width}px` : width, 
          height: typeof height === 'number' ? `${height}px` : height 
        }}
      >
        <span className="text-xs text-(--admin-text-muted)">Loading chart...</span>
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width={width} height={height}>
      {children}
    </ResponsiveContainer>
  );
};

interface ServiceStatus {
  name: string;
  displayName: string;
  description: string;
  port: number | null;
  status: 'online' | 'offline' | 'unknown' | 'loading' | 'restarting';
  lastCheck: string;
  canControl: boolean;
  metrics?: {
    avgLatencyMs?: number;
  };
}

interface LatencyDataPoint {
  time: string;
  backend: number | null;
  cepo: number | null;
  frontend: number | null;
}

interface ServiceAdmin {
  id: string;
  email: string;
  isAdmin: boolean;
  isServiceAdmin: boolean;
  createdAt: string;
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  backend: <MdApi className="w-6 h-6" />,
  cepo: <MdPsychology className="w-6 h-6" />,
  scheduler: <MdSchedule className="w-6 h-6" />,
  frontend: <MdWeb className="w-6 h-6" />,
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [latencyHistory, setLatencyHistory] = useState<LatencyDataPoint[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  
  // Service Admin management state
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [serviceAdmins, setServiceAdmins] = useState<ServiceAdmin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  
  // Shell/Terminal modal state
  const [showLogs, setShowLogs] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [logLoading, setLogLoading] = useState(false);
  
  // OpenRouter Fallback toggle state
  const [openRouterFallback, setOpenRouterFallback] = useState(false);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  // Fetch OpenRouter fallback status
  const fetchFallbackStatus = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/v1/admin/openrouter-fallback`);
      const data = await res.json();
      setOpenRouterFallback(data.enabled);
    } catch (error) {
      console.error('Failed to fetch fallback status:', error);
    }
  }, []);

  // Toggle OpenRouter fallback
  const toggleFallback = async () => {
    setFallbackLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/v1/admin/openrouter-fallback?enabled=${!openRouterFallback}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setOpenRouterFallback(data.enabled);
      }
    } catch (error) {
      console.error('Failed to toggle fallback:', error);
    } finally {
      setFallbackLoading(false);
    }
  };

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services', { cache: 'no-store' });
      const data = await res.json();
      
      setServices(data.services);
      setLastRefresh(new Date());
      
      // Update latency history
      const now = new Date().toLocaleTimeString('en-ZA', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
      });
      
      const newPoint: LatencyDataPoint = {
        time: now,
        backend: null,
        cepo: null,
        frontend: null,
      };
      
      for (const service of data.services) {
        if (service.metrics?.avgLatencyMs !== undefined) {
          (newPoint as unknown as Record<string, unknown>)[service.name] = service.metrics.avgLatencyMs;
        }
      }
      
      setLatencyHistory(prev => {
        const updated = [...prev, newPoint];
        // Keep only last 20 data points
        return updated.slice(-20);
      });
      
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    fetchFallbackStatus(); // Fetch fallback status on mount
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchServices, 15000);
    return () => clearInterval(interval);
  }, [fetchServices, fetchFallbackStatus]);

  // Fetch service admins
  const fetchServiceAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/users/service-admin');
      const data = await res.json();
      setServiceAdmins(data.serviceAdmins || []);
    } catch (error) {
      console.error('Failed to fetch service admins:', error);
    }
  }, []);

  // Grant service admin access
  const grantServiceAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setAdminActionLoading(true);
    try {
      const res = await fetch('/api/users/service-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim(), grant: true }),
      });
      const data = await res.json();
      if (data.success) {
        setNewAdminEmail('');
        fetchServiceAdmins();
      } else {
        alert(data.error || 'Failed to grant access');
      }
    } catch (error) {
      alert('Error granting service admin access');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Revoke service admin access
  const revokeServiceAdmin = async (email: string) => {
    if (!confirm(`Revoke service admin access from ${email}?`)) return;
    setAdminActionLoading(true);
    try {
      const res = await fetch('/api/users/service-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, grant: false }),
      });
      const data = await res.json();
      if (data.success) {
        fetchServiceAdmins();
      } else {
        alert(data.error || 'Failed to revoke access');
      }
    } catch (error) {
      alert('Error revoking service admin access');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Load service admins when modal opens
  useEffect(() => {
    if (showAdminManager) {
      fetchServiceAdmins();
    }
  }, [showAdminManager, fetchServiceAdmins]);

  const handleServiceAction = async (
    serviceName: string,
    action: 'start' | 'stop' | 'restart'
  ) => {
    setActionInProgress(`${serviceName}-${action}`);
    
    // Update UI to show restarting
    setServices(prev =>
      prev.map(s =>
        s.name === serviceName ? { ...s, status: 'restarting' } : s
      )
    );
    
    try {
      const res = await fetch(`/api/services/${serviceName}/${action}`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (!data.success) {
        alert(`Failed to ${action} ${serviceName}: ${data.error}`);
      }
      
      // Wait a bit then refresh status
      setTimeout(() => {
        fetchServices();
        setActionInProgress(null);
      }, 3000);
      
    } catch (error) {
      alert(`Error: ${error}`);
      setActionInProgress(null);
      fetchServices();
    }
  };

  const fetchLogs = async (serviceName: string) => {
    setSelectedService(serviceName);
    setShowLogs(true);
    setLogLoading(true);
    
    try {
      const res = await fetch(`/api/services/${serviceName}/logs?lines=100`);
      const data = await res.json();
      setLogContent(data.content || 'No logs available');
    } catch {
      setLogContent('Failed to fetch logs');
    } finally {
      setLogLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: ServiceStatus['status'] }) => {
    const config = {
      online: { 
        bg: 'bg-green-500/20', 
        text: 'text-green-400', 
        dot: 'bg-green-500',
        label: 'Online' 
      },
      offline: { 
        bg: 'bg-red-500/20', 
        text: 'text-red-400', 
        dot: 'bg-red-500',
        label: 'Offline' 
      },
      unknown: { 
        bg: 'bg-gray-500/20', 
        text: 'text-gray-400', 
        dot: 'bg-gray-500',
        label: 'Unknown' 
      },
      loading: { 
        bg: 'bg-gray-500/20', 
        text: 'text-gray-400', 
        dot: 'bg-gray-500 animate-pulse',
        label: 'Checking...' 
      },
      restarting: { 
        bg: 'bg-yellow-500/20', 
        text: 'text-yellow-400', 
        dot: 'bg-yellow-500 animate-pulse',
        label: 'Restarting...' 
      },
    };
    
    const c = config[status];
    
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${c.bg} ${c.text} text-sm font-medium`}>
        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
        {c.label}
      </span>
    );
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 bg-(--admin-surface) border border-(--admin-border) rounded-lg shadow-lg">
          <p className="text-sm text-(--admin-text-secondary) mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: <span className="font-mono">{entry.value}ms</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading && services.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-(--admin-text-muted) border-t-(--admin-text) rounded-full mx-auto mb-4" />
          <p className="text-(--admin-text-secondary)">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OpenRouter Fallback Toggle - Testing Mode */}
      <div className={`admin-card border-2 ${openRouterFallback ? 'border-yellow-500 bg-yellow-500/5' : 'border-(--admin-border)'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-(--admin-text) flex items-center gap-2">
              🔄 OpenRouter Fallback Mode
              {openRouterFallback && (
                <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">
                  ACTIVE
                </span>
              )}
            </h3>
            <p className="text-sm text-(--admin-text-secondary) mt-1">
              {openRouterFallback 
                ? 'JIVE/JIGGA tiers are routing to OpenRouter (Qwen 235B) instead of Cerebras'
                : 'JIVE/JIGGA tiers are using Cerebras (normal operation)'}
            </p>
          </div>
          <button
            onClick={toggleFallback}
            disabled={fallbackLoading}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              openRouterFallback ? 'bg-yellow-500' : 'bg-(--admin-surface-2)'
            } ${fallbackLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                openRouterFallback ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-(--admin-text)">
            Service Management
          </h1>
          <p className="text-sm text-(--admin-text-secondary) mt-1">
            Monitor and control GOGGA platform services
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAdminManager(true)}
            className="admin-btn admin-btn-secondary flex items-center gap-2"
          >
            <MdSupervisorAccount className="w-5 h-5" />
            Service Admins
          </button>
          <span className="text-sm text-(--admin-text-muted)">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchServices}
            className="admin-btn admin-btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <MdRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => (
          <div
            key={service.name}
            className="admin-card hover:border-(--admin-border-light) transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  service.status === 'online' 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-(--admin-surface-2) text-(--admin-text-muted)'
                }`}>
                  {SERVICE_ICONS[service.name] || <MdCloud className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-semibold text-(--admin-text)">
                    {service.displayName}
                  </h3>
                  {service.port && (
                    <p className="text-xs text-(--admin-text-muted) font-mono">
                      Port {service.port}
                    </p>
                  )}
                </div>
              </div>
              <StatusBadge status={service.status} />
            </div>

            <p className="text-sm text-(--admin-text-secondary) mb-4">
              {service.description}
            </p>

            {/* Metrics */}
            {service.metrics?.avgLatencyMs !== undefined && (
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-(--admin-text-muted)">Latency:</span>
                  <span className={`font-mono ${
                    service.metrics.avgLatencyMs < 100 
                      ? 'text-green-400' 
                      : service.metrics.avgLatencyMs < 500 
                        ? 'text-yellow-400' 
                        : 'text-red-400'
                  }`}>
                    {service.metrics.avgLatencyMs}ms
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            {service.canControl && (
              <div className="flex items-center gap-2 pt-4 border-t border-(--admin-border)">
                <button
                  onClick={() => handleServiceAction(service.name, 'start')}
                  disabled={actionInProgress !== null || service.status === 'online'}
                  className="admin-btn admin-btn-success flex items-center gap-1 text-sm disabled:opacity-50"
                >
                  <MdPlayArrow className="w-4 h-4" />
                  Start
                </button>
                <button
                  onClick={() => handleServiceAction(service.name, 'stop')}
                  disabled={actionInProgress !== null || service.status === 'offline'}
                  className="admin-btn admin-btn-danger flex items-center gap-1 text-sm disabled:opacity-50"
                >
                  <MdStop className="w-4 h-4" />
                  Stop
                </button>
                <button
                  onClick={() => handleServiceAction(service.name, 'restart')}
                  disabled={actionInProgress !== null}
                  className="admin-btn admin-btn-secondary flex items-center gap-1 text-sm disabled:opacity-50"
                >
                  <MdRefresh className="w-4 h-4" />
                  Restart
                </button>
                <button
                  onClick={() => fetchLogs(service.name)}
                  className="admin-btn admin-btn-secondary flex items-center gap-1 text-sm ml-auto"
                >
                  <MdTerminal className="w-4 h-4" />
                  Logs
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Latency Chart */}
      {latencyHistory.length > 1 && (
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-(--admin-text) mb-4">
            Service Latency (Health Check Response Time)
          </h3>
          <div className="h-[300px]">
            <ClientResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyHistory} margin={{ right: 30, top: 10 }}>
                <defs>
                  <linearGradient id="backendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6b7280" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6b7280" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="cepoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="frontendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d1d5db" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d1d5db" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="var(--admin-border)" 
                  vertical={false}
                />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--admin-text-muted)" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="var(--admin-text-muted)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}ms`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="backend"
                  name="Backend"
                  stroke="#6b7280"
                  fill="url(#backendGradient)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="cepo"
                  name="CePO"
                  stroke="#9ca3af"
                  fill="url(#cepoGradient)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="frontend"
                  name="Frontend"
                  stroke="#d1d5db"
                  fill="url(#frontendGradient)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ClientResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#6b7280]" />
              <span className="text-(--admin-text-secondary)">Backend</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#9ca3af]" />
              <span className="text-(--admin-text-secondary)">CePO</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#d1d5db]" />
              <span className="text-(--admin-text-secondary)">Frontend</span>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-(--admin-surface) border border-(--admin-border) rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-(--admin-border)">
              <div className="flex items-center gap-3">
                <MdTerminal className="w-5 h-5 text-(--admin-text-muted)" />
                <h3 className="font-semibold text-(--admin-text)">
                  {selectedService} logs
                </h3>
              </div>
              <button
                onClick={() => setShowLogs(false)}
                className="p-2 hover:bg-(--admin-surface-2) rounded-lg transition-colors"
              >
                <MdClose className="w-5 h-5 text-(--admin-text-muted)" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-black/50">
              {logLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin w-6 h-6 border-2 border-(--admin-text-muted) border-t-(--admin-text) rounded-full" />
                </div>
              ) : (
                <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">
                  {logContent}
                </pre>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-(--admin-border)">
              <button
                onClick={() => selectedService && fetchLogs(selectedService)}
                className="admin-btn admin-btn-secondary flex items-center gap-2"
              >
                <MdRefresh className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => setShowLogs(false)}
                className="admin-btn admin-btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Admin Manager Modal */}
      {showAdminManager && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-(--admin-surface) border border-(--admin-border) rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-(--admin-border)">
              <div className="flex items-center gap-3">
                <MdSupervisorAccount className="w-5 h-5 text-(--admin-text-muted)" />
                <h3 className="font-semibold text-(--admin-text)">
                  Service Admin Management
                </h3>
              </div>
              <button
                onClick={() => setShowAdminManager(false)}
                className="p-2 hover:bg-(--admin-surface-2) rounded-lg transition-colors"
              >
                <MdClose className="w-5 h-5 text-(--admin-text-muted)" />
              </button>
            </div>
            
            {/* Add new service admin */}
            <div className="p-4 border-b border-(--admin-border)">
              <p className="text-sm text-(--admin-text-secondary) mb-3">
                Service admins can start, stop, and restart GOGGA services via shell commands.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 px-3 py-2 bg-(--admin-surface-2) border border-(--admin-border) rounded-lg text-(--admin-text) placeholder:text-(--admin-text-muted) focus:outline-none focus:border-(--admin-border-light)"
                />
                <button
                  onClick={grantServiceAdmin}
                  disabled={adminActionLoading || !newAdminEmail.trim()}
                  className="admin-btn admin-btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <MdAdd className="w-4 h-4" />
                  Grant Access
                </button>
              </div>
            </div>

            {/* List of service admins */}
            <div className="flex-1 overflow-auto p-4">
              {serviceAdmins.length === 0 ? (
                <p className="text-center text-(--admin-text-muted) py-8">
                  No service admins configured yet
                </p>
              ) : (
                <div className="space-y-2">
                  {serviceAdmins.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-3 bg-(--admin-surface-2) rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-(--admin-text)">
                          {admin.email}
                        </p>
                        <p className="text-xs text-(--admin-text-muted)">
                          Added {new Date(admin.createdAt).toLocaleDateString()}
                          {admin.isAdmin && ' • Also full admin'}
                        </p>
                      </div>
                      <button
                        onClick={() => revokeServiceAdmin(admin.email)}
                        disabled={adminActionLoading}
                        className="admin-btn admin-btn-danger flex items-center gap-1 text-sm disabled:opacity-50"
                      >
                        <MdRemove className="w-4 h-4" />
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end p-4 border-t border-(--admin-border)">
              <button
                onClick={() => setShowAdminManager(false)}
                className="admin-btn admin-btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
