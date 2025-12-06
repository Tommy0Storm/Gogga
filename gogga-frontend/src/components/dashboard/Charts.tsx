/**
 * GOGGA RAG Dashboard - Chart Components
 * Built with Recharts for enterprise-grade visualization
 * Monochrome design with grey gradients
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';

// ============================================================================
// Client-side mount check hook to prevent SSR dimension errors
// ============================================================================

function useIsMounted(): boolean {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  return isMounted;
}
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// ============================================================================
// Animation Hook - Enable only on first mount
// ============================================================================

function useAnimateOnMount(): boolean {
  const hasAnimated = useRef(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      // Disable animation after first render
      const timer = setTimeout(() => setShouldAnimate(false), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  return shouldAnimate;
}

// ============================================================================
// Client-Only Wrapper for ResponsiveContainer
// Prevents "Cannot read properties of undefined (reading 'dimensions')" error
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
        className="flex items-center justify-center bg-primary-50 rounded-lg animate-pulse"
        style={{ 
          width: typeof width === 'number' ? `${width}px` : width, 
          height: typeof height === 'number' ? `${height}px` : height 
        }}
      >
        <span className="text-xs text-primary-400">Loading chart...</span>
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
// Color Palette (Monochrome)
// ============================================================================

const COLORS = {
  primary: '#525252',      // primary-600
  secondary: '#a3a3a3',    // primary-400
  tertiary: '#d4d4d4',     // primary-300
  accent: '#171717',       // primary-900
  grid: '#e5e5e5',         // primary-200
  saGreen: '#007749',
  saGold: '#FFB612',
};

const PIE_COLORS = ['#171717', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4'];

// ============================================================================
// Custom Tooltip Types
// ============================================================================

/**
 * Payload entry from Recharts tooltip
 * Matches the structure passed by Recharts internals
 */
interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  unit?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-primary-900 text-white px-4 py-3 rounded-lg shadow-elevated">
      <p className="text-sm font-semibold mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs">
          <span style={{ color: entry.color }}>{entry.name}: </span>
          <span className="font-bold">{entry.value?.toFixed(2)}{unit}</span>
        </p>
      ))}
    </div>
  );
};

// ============================================================================
// Latency Area Chart
// ============================================================================

interface LatencyChartData {
  name: string;
  semantic: number;
  keyword: number;
  timestamp: number;
}

interface LatencyChartProps {
  data: LatencyChartData[];
  height?: number;
  showLegend?: boolean;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({
  data,
  height = 300,
  showLegend = true,
}) => {
  const shouldAnimate = useAnimateOnMount();

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-primary-50 rounded-lg"
        style={{ height }}
      >
        <p className="text-sm text-primary-400">No latency data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4">
      <h3 className="text-base font-semibold text-primary-800 mb-4">
        Query Latency
      </h3>
      <ClientResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="semanticGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="keywordGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={COLORS.secondary}
                stopOpacity={0.3}
              />
              <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: COLORS.secondary }}
            axisLine={{ stroke: COLORS.grid }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: COLORS.secondary }}
            axisLine={{ stroke: COLORS.grid }}
            tickFormatter={(value) => `${value}ms`}
          />
          <Tooltip content={<CustomTooltip unit="ms" />} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <Area
            type="monotone"
            dataKey="semantic"
            name="Semantic"
            stroke={COLORS.primary}
            fill="url(#semanticGradient)"
            strokeWidth={2}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
          />
          <Area
            type="monotone"
            dataKey="keyword"
            name="Keyword"
            stroke={COLORS.secondary}
            fill="url(#keywordGradient)"
            strokeWidth={2}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
          />
        </AreaChart>
      </ClientResponsiveContainer>
    </div>
  );
};

// ============================================================================
// Storage Breakdown Bar Chart
// ============================================================================

interface StorageData {
  name: string;
  size: number;
  count: number;
}

interface StorageChartProps {
  data: StorageData[];
  height?: number;
  maxMB?: number;
}

export const StorageChart: React.FC<StorageChartProps> = ({
  data,
  height = 250,
  maxMB = 100,
}) => {
  const shouldAnimate = useAnimateOnMount();
  const formattedData = data.map((d) => ({
    ...d,
    sizeMB: d.size / (1024 * 1024),
  }));

  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4">
      <h3 className="text-base font-semibold text-primary-800 mb-4">
        Storage by Session
      </h3>
      <ClientResponsiveContainer width="100%" height={height}>
        <BarChart
          data={formattedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLORS.grid}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: COLORS.secondary }}
            domain={[0, maxMB]}
            tickFormatter={(value) => `${value.toFixed(1)} MB`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: COLORS.secondary }}
            width={50}
          />
          <Tooltip content={<CustomTooltip unit=" MB" />} />
          <Bar
            dataKey="sizeMB"
            name="Size"
            fill={COLORS.primary}
            radius={[0, 4, 4, 0]}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
          />
        </BarChart>
      </ClientResponsiveContainer>
    </div>
  );
};

// ============================================================================
// Query Mode Pie Chart
// ============================================================================

/**
 * Data structure for QueryModePie chart
 * Recharts requires index signature for data items
 */
interface QueryModeData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface QueryModePieProps {
  semantic: number;
  keyword: number;
  size?: number;
}

export const QueryModePie: React.FC<QueryModePieProps> = ({
  semantic,
  keyword,
  size = 200,
}) => {
  const shouldAnimate = useAnimateOnMount();
  const data: QueryModeData[] = [
    { name: 'Semantic', value: semantic },
    { name: 'Keyword', value: keyword },
  ];

  const total = semantic + keyword;

  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4">
      <h3 className="text-base font-semibold text-primary-800 mb-4">
        Query Distribution
      </h3>
      <div className="flex items-center justify-center">
        <ClientResponsiveContainer width={size} height={size}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              dataKey="value"
              stroke="none"
              isAnimationActive={shouldAnimate}
              animationDuration={1000}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ClientResponsiveContainer>
      </div>
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary-900" />
          <span className="text-xs text-primary-600">
            Semantic ({total > 0 ? ((semantic / total) * 100).toFixed(0) : 0}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary-500" />
          <span className="text-xs text-primary-600">
            Keyword ({total > 0 ? ((keyword / total) * 100).toFixed(0) : 0}%)
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Performance Line Chart
// ============================================================================

interface PerformanceData {
  name: string;
  latency: number;
  score: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
  height?: number;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  height = 250,
}) => {
  const shouldAnimate = useAnimateOnMount();
  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4">
      <h3 className="text-base font-semibold text-primary-800 mb-4">
        Performance Over Time
      </h3>
      <ClientResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: COLORS.secondary }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: COLORS.secondary }}
            tickFormatter={(value) => `${value}ms`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: COLORS.secondary }}
            domain={[0, 1]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="latency"
            name="Latency (ms)"
            stroke={COLORS.primary}
            strokeWidth={2}
            dot={false}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="score"
            name="Avg Score"
            stroke={COLORS.saGreen}
            strokeWidth={2}
            dot={false}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
          />
        </LineChart>
      </ClientResponsiveContainer>
    </div>
  );
};

// ============================================================================
// Score Distribution Histogram
// ============================================================================

interface ScoreDistributionData {
  range: string;
  count: number;
}

interface ScoreHistogramProps {
  data: ScoreDistributionData[];
  height?: number;
}

export const ScoreHistogram: React.FC<ScoreHistogramProps> = ({
  data,
  height = 200,
}) => {
  const shouldAnimate = useAnimateOnMount();
  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4">
      <h3 className="text-base font-semibold text-primary-800 mb-4">
        Similarity Score Distribution
      </h3>
      <ClientResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLORS.grid}
            vertical={false}
          />
          <XAxis
            dataKey="range"
            tick={{ fontSize: 10, fill: COLORS.secondary }}
          />
          <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            name="Queries"
            fill={COLORS.primary}
            radius={[4, 4, 0, 0]}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
          />
        </BarChart>
      </ClientResponsiveContainer>
    </div>
  );
};

// ============================================================================
// Mini Sparkline
// ============================================================================

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color = COLORS.primary,
}) => {
  const shouldAnimate = useAnimateOnMount();
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <ClientResponsiveContainer width={width} height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
      >
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={shouldAnimate}
          animationDuration={800}
        />
      </LineChart>
    </ClientResponsiveContainer>
  );
};

// ============================================================================
// Gauge Chart (for health score)
// ============================================================================

interface GaugeChartProps {
  value: number;
  max?: number;
  size?: number;
  label?: string;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  max = 100,
  size = 180,
  label = 'Health',
}) => {
  const shouldAnimate = useAnimateOnMount();
  const percentage = (value / max) * 100;

  const getColor = () => {
    if (percentage >= 80) return COLORS.saGreen;
    if (percentage >= 50) return COLORS.saGold;
    return '#DE3831'; // sa-red
  };

  const data = [
    { name: 'value', value: percentage },
    { name: 'empty', value: 100 - percentage },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ClientResponsiveContainer width={size} height={size / 2 + 20}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={size / 3}
              outerRadius={size / 2.2}
              dataKey="value"
              stroke="none"
              isAnimationActive={shouldAnimate}
              animationDuration={1000}
            >
              <Cell fill={getColor()} />
              <Cell fill={COLORS.tertiary} />
            </Pie>
          </PieChart>
        </ClientResponsiveContainer>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
          <p className="text-2xl font-bold text-primary-900">
            {Math.round(percentage)}%
          </p>
          <p className="text-xs text-primary-500">{label}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Browser Load Chart (FPS, Memory, Long Tasks)
// ============================================================================

interface BrowserLoadChartProps {
  fpsHistory: number[];
  heapHistory: number[];
  height?: number;
}

export const BrowserLoadChart: React.FC<BrowserLoadChartProps> = ({
  fpsHistory,
  heapHistory,
  height = 200,
}) => {
  const shouldAnimate = useAnimateOnMount();
  // Combine data for dual-line chart
  const chartData = fpsHistory.map((fps, index) => ({
    index,
    fps,
    heap: heapHistory[index] ?? 0,
  }));

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-primary-50 rounded-lg"
        style={{ height }}
      >
        <p className="text-sm text-primary-400">
          Collecting performance data...
        </p>
      </div>
    );
  }

  // Calculate current values for display
  const currentFps = fpsHistory[fpsHistory.length - 1] ?? 0;
  const currentHeap = heapHistory[heapHistory.length - 1] ?? 0;

  // FPS color indicator
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return COLORS.saGreen;
    if (fps >= 30) return COLORS.saGold;
    return '#DE3831';
  };

  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-primary-800">
          Browser Performance
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getFpsColor(currentFps) }}
            />
            <span className="text-primary-600">{currentFps} FPS</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary-500" />
            <span className="text-primary-600">
              {currentHeap.toFixed(1)}% Heap
            </span>
          </div>
        </div>
      </div>
      <ClientResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="index"
            tick={false}
            axisLine={{ stroke: COLORS.grid }}
          />
          <YAxis
            yAxisId="fps"
            domain={[0, 65]}
            tick={{ fontSize: 10, fill: COLORS.secondary }}
            axisLine={{ stroke: COLORS.grid }}
            tickFormatter={(value) => `${value}`}
          />
          <YAxis
            yAxisId="heap"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: COLORS.secondary }}
            axisLine={{ stroke: COLORS.grid }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-primary-900 text-white px-3 py-2 rounded-lg shadow-elevated text-xs">
                  <p>
                    FPS: <span className="font-bold">{payload[0]?.value}</span>
                  </p>
                  <p>
                    Heap:{' '}
                    <span className="font-bold">
                      {Number(payload[1]?.value).toFixed(1)}%
                    </span>
                  </p>
                </div>
              );
            }}
          />
          <Line
            yAxisId="fps"
            type="monotone"
            dataKey="fps"
            name="FPS"
            stroke={COLORS.saGreen}
            strokeWidth={2}
            dot={false}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
          />
          <Line
            yAxisId="heap"
            type="monotone"
            dataKey="heap"
            name="Heap %"
            stroke={COLORS.primary}
            strokeWidth={2}
            dot={false}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
          />
        </LineChart>
      </ClientResponsiveContainer>
    </div>
  );
};

export default LatencyChart;
