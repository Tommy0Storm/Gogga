'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  MdShowChart,
  MdTrendingUp,
  MdPeople,
  MdBolt,
  MdAttachMoney,
  MdRefresh,
  MdAccessTime,
  MdTag,
  MdBuild,
} from 'react-icons/md';

interface UsageData {
  period: string;
  startDate: string;
  totals: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    costCents: number;
    costZar: string;
    requestCount: number;
    activeUsers: number;
  };
  byTier: {
    tier: string;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    costCents: number;
    requestCount: number;
  }[];
  byProvider: {
    provider: string;
    totalTokens: number;
    costCents: number;
    requestCount: number;
  }[];
  toolUsage: {
    toolName: string;
    callCount: number;
    successRate: number;
    avgDurationMs: number;
  }[];
  dailyTrend: {
    date: string;
    totalTokens: number;
    requestCount: number;
  }[];
}

const TIER_COLORS = {
  FREE: '#94a3b8',
  JIVE: '#3b82f6',
  JIGGA: '#8b5cf6',
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`/api/usage?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch usage data');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchUsage, 30000); // 30 second refresh
    return () => clearInterval(interval);
  }, [autoRefresh, fetchUsage]);

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000000) return `${(tokens / 1000000000).toFixed(1)}B`;
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatDuration = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <MdRefresh className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Error loading usage data: {error}</p>
        <button
          onClick={fetchUsage}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
          <p className="text-sm text-gray-500">
            {period === 'today' ? 'Today' : 
             period === 'week' ? 'Last 7 days' :
             period === 'month' ? 'This month' :
             period === 'year' ? 'This year' : 'All time'}
            {' • '}Updated {new Date().toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Period selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
          </select>
          
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          
          <button
            onClick={fetchUsage}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <MdRefresh className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Ticker Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tokens */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTokens(data.totals.totalTokens)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatTokens(data.totals.promptTokens)} in / {formatTokens(data.totals.completionTokens)} out
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <MdTag className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Request Count */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Requests</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.totals.requestCount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.dailyTrend.length > 0 
                  ? `~${Math.round(data.totals.requestCount / data.dailyTrend.length)}/day`
                  : 'No data'}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <MdShowChart className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.totals.activeUsers.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.totals.requestCount > 0 
                  ? `${(data.totals.requestCount / data.totals.activeUsers).toFixed(1)} req/user`
                  : 'No data'}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <MdPeople className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Cost */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Est. Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                R{data.totals.costZar}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                ${(data.totals.costCents / 100).toFixed(2)} USD
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <MdAttachMoney className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MdTrendingUp className="w-5 h-5 text-blue-500" />
            Daily Usage Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[...data.dailyTrend].reverse()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={formatTokens} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'totalTokens' ? formatTokens(value) : value,
                  name === 'totalTokens' ? 'Tokens' : 'Requests'
                ]}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="totalTokens" 
                name="Tokens"
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="requestCount" 
                name="Requests"
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Usage by Tier */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MdBolt className="w-5 h-5 text-purple-500" />
            Usage by Tier
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.byTier}
                  dataKey="totalTokens"
                  nameKey="tier"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => 
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {data.byTier.map((entry) => (
                    <Cell 
                      key={entry.tier} 
                      fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS] || '#94a3b8'} 
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatTokens(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center space-y-3">
              {data.byTier.map((tier) => (
                <div key={tier.tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: TIER_COLORS[tier.tier as keyof typeof TIER_COLORS] || '#94a3b8' }}
                    />
                    <span className="text-sm font-medium">{tier.tier}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatTokens(tier.totalTokens)}</p>
                    <p className="text-xs text-gray-400">{tier.requestCount} requests</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tool Usage Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MdBuild className="w-5 h-5 text-orange-500" />
          Tool Usage Analytics
        </h3>
        {data.toolUsage.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tool</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Duration</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Usage Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.toolUsage.slice(0, 15).map((tool, idx) => {
                  const maxCalls = data.toolUsage[0]?.callCount || 1;
                  const percentage = (tool.callCount / maxCalls) * 100;
                  return (
                    <tr key={tool.toolName} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{tool.toolName}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-700">{tool.callCount.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          tool.successRate >= 95 ? 'text-green-600' :
                          tool.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {tool.successRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-600 flex items-center justify-end gap-1">
                          <MdAccessTime className="w-3 h-3" />
                          {formatDuration(tool.avgDurationMs)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MdBuild className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No tool usage data yet</p>
            <p className="text-sm text-gray-400">Tool usage will appear here as users interact with AI tools</p>
          </div>
        )}
      </div>

      {/* Provider Breakdown */}
      {data.byProvider.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.byProvider}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="provider" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatTokens} />
              <Tooltip formatter={(value: number) => formatTokens(value)} />
              <Bar dataKey="totalTokens" fill="#3b82f6" name="Tokens" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
