/**
 * GOGGA LLM Monitor Panel
 * Real-time monitoring of LLM API usage, costs, and performance
 * 
 * Features:
 * - Token usage tracking (today/all-time)
 * - Cost tracking in ZAR
 * - Model usage breakdown
 * - Latency monitoring
 * - Request history
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Client-side mount check to prevent SSR dimension errors
function useIsMounted(): boolean {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  return isMounted;
}
import {
  Zap,
  Clock,
  DollarSign,
  BarChart3,
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Brain,
  MessageSquare,
  Calendar,
  Layers,
} from 'lucide-react';
import { db, TokenUsage, ChatMessage, getTokenUsageHistory } from '@/lib/db';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

interface TokenStats {
  today: TodayStats;
  allTime: AllTimeStats;
  history: TokenUsage[];
  avgLatency: number;
}

interface TodayStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costZar: number;
  requestCount: number;
  byTier: Record<string, TierStats>;
}

interface AllTimeStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costZar: number;
  requestCount: number;
}

interface TierStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costZar: number;
  requestCount: number;
}

// ============================================================================
// Client-Only Wrapper for ResponsiveContainer
// ============================================================================

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
        className="flex items-center justify-center bg-gray-50 rounded-lg animate-pulse"
        style={{ 
          width: typeof width === 'number' ? `${width}px` : width, 
          height: typeof height === 'number' ? `${height}px` : height 
        }}
      >
        <span className="text-xs text-gray-400">Loading...</span>
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width={width} height={height}>
      {children}
    </ResponsiveContainer>
  );
};

// ============================================================================
// Constants
// ============================================================================

const TIER_COLORS: Record<string, string> = {
  free: '#737373',   // Grey for free
  jive: '#007749',   // SA Green
  jigga: '#FFB612',  // SA Gold
};

const PIE_COLORS = ['#171717', '#404040', '#525252', '#737373', '#a3a3a3'];

// ============================================================================
// Helper Functions
// ============================================================================

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function formatCurrency(zar: number): string {
  return `R${zar.toFixed(2)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-primary-900 text-white px-4 py-3 rounded-lg shadow-elevated">
      <p className="text-sm font-semibold mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs">
          <span style={{ color: entry.color }}>{entry.name}: </span>
          <span className="font-bold">{formatTokenCount(entry.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, trend }) => (
  <div className="bg-white border border-primary-200 rounded-lg p-4 shadow-sm">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm text-primary-500">{title}</span>
      <span className="text-primary-400">{icon}</span>
    </div>
    <div className="flex items-end gap-2">
      <span className="text-2xl font-bold text-primary-900">{value}</span>
      {trend && (
        <span className={`flex items-center text-xs ${trend.isPositive ? 'text-sa-green' : 'text-red-500'}`}>
          {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend.value)}%
        </span>
      )}
    </div>
    {subtitle && <p className="text-xs text-primary-400 mt-1">{subtitle}</p>}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

type TimeRangeProp = 'today' | '7days';

interface LLMMonitorProps {
  timeRange?: TimeRangeProp;
}

export const LLMMonitor: React.FC<LLMMonitorProps> = ({ timeRange: externalTimeRange = 'today' }) => {
  const [stats, setStats] = useState<TokenStats>({
    today: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costZar: 0,
      requestCount: 0,
      byTier: {},
    },
    allTime: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costZar: 0,
      requestCount: 0,
    },
    history: [],
    avgLatency: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  // Internal chart range (history depth)
  const [chartRange, setChartRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Sync chart range with external time range
  React.useEffect(() => {
    if (externalTimeRange === '7days') {
      setChartRange('7d');
    }
  }, [externalTimeRange]);

  // Load token stats
  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Calculate date range based on externalTimeRange
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      
      // Get records based on time range (today or past 7 days)
      const primaryRecords = (externalTimeRange === '7days'
        ? await db.tokenUsage.where('date').aboveOrEqual(sevenDaysAgoStr).toArray()
        : await db.tokenUsage.where('date').equals(today).toArray()) as TokenUsage[];
      
      const todayStats = primaryRecords.reduce((acc: TodayStats, record: TokenUsage) => {
        acc.totalTokens += record.totalTokens;
        acc.inputTokens += record.inputTokens;
        acc.outputTokens += record.outputTokens;
        acc.costZar += record.costZar;
        acc.requestCount += record.requestCount;
        
        // Group by tier
        if (!acc.byTier[record.tier]) {
          acc.byTier[record.tier] = {
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            costZar: 0,
            requestCount: 0,
          };
        }
        const tierData = acc.byTier[record.tier];
        if (tierData) {
          tierData.totalTokens += record.totalTokens;
          tierData.inputTokens += record.inputTokens;
          tierData.outputTokens += record.outputTokens;
          tierData.costZar += record.costZar;
          tierData.requestCount += record.requestCount;
        }
        
        return acc;
      }, {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        costZar: 0,
        requestCount: 0,
        byTier: {} as Record<string, TierStats>,
      });

      // Get all-time usage
      const allRecords = await db.tokenUsage.toArray() as TokenUsage[];
      const allTimeStats = allRecords.reduce((acc: AllTimeStats, record: TokenUsage) => {
        acc.totalTokens += record.totalTokens;
        acc.inputTokens += record.inputTokens;
        acc.outputTokens += record.outputTokens;
        acc.costZar += record.costZar;
        acc.requestCount += record.requestCount;
        return acc;
      }, {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        costZar: 0,
        requestCount: 0,
      });

      // Get history for charts
      const days = chartRange === '7d' ? 7 : chartRange === '30d' ? 30 : 365;
      const history = await getTokenUsageHistory(days);

      // Calculate average latency from messages
      const recentMessages = await db.messages
        .orderBy('timestamp')
        .reverse()
        .limit(100)
        .toArray() as ChatMessage[];
      
      const latencies = recentMessages
        .filter((m: ChatMessage) => m.meta?.latency_seconds)
        .map((m: ChatMessage) => (m.meta?.latency_seconds as number) * 1000);
      
      const avgLatency = latencies.length > 0 
        ? latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length 
        : 0;

      setStats({
        today: todayStats,
        allTime: allTimeStats,
        history,
        avgLatency,
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading LLM stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chartRange, externalTimeRange]);

  useEffect(() => {
    loadStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  // Prepare chart data
  const historyChartData = stats.history
    .slice(-14) // Last 14 data points
    .map(h => ({
      name: getDateLabel(h.date),
      input: h.inputTokens,
      output: h.outputTokens,
      total: h.totalTokens,
      cost: h.costZar,
      requests: h.requestCount,
    }));

  // Tier breakdown for pie chart
  const tierPieData = Object.entries(stats.today.byTier).map(([tier, data]) => ({
    name: tier.toUpperCase(),
    value: data.totalTokens,
    cost: data.costZar,
    requests: data.requestCount,
  }));

  // Input/Output ratio
  const ioRatioData = [
    { name: 'Input', value: stats.today.inputTokens },
    { name: 'Output', value: stats.today.outputTokens },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-primary-600" />
          <h2 className="text-xl font-bold text-primary-900">LLM Monitor</h2>
        </div>
        <div className="flex items-center gap-4">
          {/* Chart Range Selector */}
          <div className="flex bg-primary-100 rounded-lg p-1">
            {(['7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setChartRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  chartRange === range
                    ? 'bg-white text-primary-900 shadow-sm'
                    : 'text-primary-500 hover:text-primary-700'
                }`}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>
          {/* Refresh Button */}
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="p-2 rounded-lg border border-primary-200 hover:bg-primary-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-primary-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <p className="text-xs text-primary-400">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={externalTimeRange === '7days' ? 'Tokens (7 Days)' : 'Tokens Today'}
          value={formatTokenCount(stats.today.totalTokens)}
          subtitle={`${formatTokenCount(stats.today.inputTokens)} in / ${formatTokenCount(stats.today.outputTokens)} out`}
          icon={<Zap className="w-5 h-5" />}
        />
        <StatCard
          title={externalTimeRange === '7days' ? 'Cost (7 Days)' : 'Cost Today'}
          value={formatCurrency(stats.today.costZar)}
          subtitle="Estimated ZAR"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title={externalTimeRange === '7days' ? 'Requests (7 Days)' : 'Requests Today'}
          value={stats.today.requestCount}
          subtitle="API calls"
          icon={<MessageSquare className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Latency"
          value={formatLatency(stats.avgLatency)}
          subtitle="Response time"
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* All-Time Stats */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-medium text-primary-700">All-Time Usage</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary-900">{formatTokenCount(stats.allTime.totalTokens)}</p>
            <p className="text-xs text-primary-500">Total Tokens</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-900">{formatCurrency(stats.allTime.costZar)}</p>
            <p className="text-xs text-primary-500">Total Cost</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-900">{stats.allTime.requestCount.toLocaleString()}</p>
            <p className="text-xs text-primary-500">Total Requests</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-900">
              {stats.allTime.requestCount > 0 
                ? Math.round(stats.allTime.totalTokens / stats.allTime.requestCount).toLocaleString()
                : 0}
            </p>
            <p className="text-xs text-primary-500">Avg Tokens/Request</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage History */}
        <div className="bg-white border border-primary-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium text-primary-700">Token Usage History</span>
          </div>
          <div className="h-64">
            {historyChartData.length > 0 ? (
              <ClientResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#737373' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#737373' }}
                    tickLine={false}
                    tickFormatter={formatTokenCount}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="input"
                    name="Input"
                    stackId="1"
                    stroke="#525252"
                    fill="#a3a3a3"
                  />
                  <Area
                    type="monotone"
                    dataKey="output"
                    name="Output"
                    stackId="1"
                    stroke="#171717"
                    fill="#525252"
                  />
                </AreaChart>
              </ClientResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-primary-400">
                No usage data yet
              </div>
            )}
          </div>
        </div>

        {/* Tier Breakdown */}
        <div className="bg-white border border-primary-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium text-primary-700">Usage by Tier (Today)</span>
          </div>
          <div className="h-64">
            {tierPieData.length > 0 ? (
              <ClientResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {tierPieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={TIER_COLORS[entry.name.toLowerCase()] || PIE_COLORS[index % PIE_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatTokenCount(value)}
                  />
                </PieChart>
              </ClientResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-primary-400">
                No tier data today
              </div>
            )}
          </div>
          {/* Tier Legend */}
          <div className="flex justify-center gap-4 mt-2">
            {tierPieData.map((tier) => (
              <div key={tier.name} className="flex items-center gap-1 text-xs">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[tier.name.toLowerCase()] || '#737373' }}
                />
                <span className="text-primary-600">{tier.name}</span>
                <span className="text-primary-400">({tier.requests} req)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost History */}
      <div className="bg-white border border-primary-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-medium text-primary-700">Daily Cost Trend (ZAR)</span>
        </div>
        <div className="h-48">
          {historyChartData.length > 0 ? (
            <ClientResponsiveContainer width="100%" height="100%">
              <BarChart data={historyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#737373' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#737373' }}
                  tickLine={false}
                  tickFormatter={(v) => `R${v.toFixed(0)}`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => label}
                />
                <Bar 
                  dataKey="cost" 
                  name="Cost" 
                  fill="#525252"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ClientResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-primary-400">
              No cost data yet
            </div>
          )}
        </div>
      </div>

      {/* Input/Output Ratio */}
      <div className="bg-white border border-primary-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-medium text-primary-700">Input/Output Distribution (Today)</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {ioRatioData.map((item, index) => (
            <div key={item.name} className="text-center">
              <div 
                className="h-4 rounded-full mb-2"
                style={{ 
                  width: `${stats.today.totalTokens > 0 ? (item.value / stats.today.totalTokens) * 100 : 50}%`,
                  backgroundColor: index === 0 ? '#a3a3a3' : '#404040',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  minWidth: '20%'
                }}
              />
              <p className="text-lg font-bold text-primary-900">{formatTokenCount(item.value)}</p>
              <p className="text-xs text-primary-500">{item.name} Tokens</p>
              <p className="text-xs text-primary-400">
                {stats.today.totalTokens > 0 
                  ? `${((item.value / stats.today.totalTokens) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-xs text-primary-400 text-center">
        <p>Token usage is tracked locally in IndexedDB. Data persists across sessions.</p>
        <p>Cost estimates are based on current API pricing and may not reflect actual billing.</p>
      </div>
    </div>
  );
};

export default LLMMonitor;
