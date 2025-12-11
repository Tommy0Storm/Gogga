'use client';

/**
 * GOGGA Chart Renderer
 * 
 * Enhanced chart rendering with:
 * - 13+ chart types including stacked variants
 * - Smart legend positioning (right for pie/donut, bottom for others)
 * - HD quality (500px expanded, improved fonts)
 * - Chart type switcher
 * - Multiple export formats (PNG, CSV, JSON)
 * - Multi-series support
 * 
 * Uses Recharts for visualization with Gogga's monochrome theme.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Treemap,
  FunnelChart,
  Funnel,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { 
  Maximize2, 
  Minimize2, 
  Download, 
  ChevronDown,
  Image as ImageIcon,
  FileText,
  FileCode,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  ChartType,
  ChartData,
  LegendPosition,
  CHART_TYPE_LABELS,
  getCompatibleTypes,
  EXTENDED_PALETTE,
} from '@/types/chart';

// =============================================================================
// Types
// =============================================================================

interface ChartRendererProps {
  chartData: ChartData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

// Gogga monochrome palette with accent colors
const DEFAULT_COLORS = EXTENDED_PALETTE;

// Custom tooltip styling
const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  padding: '8px 12px',
  fontFamily: 'Quicksand, sans-serif',
  fontSize: '12px',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get default legend position based on chart type
 */
function getDefaultLegendPosition(chartType: ChartType): LegendPosition {
  switch (chartType) {
    case 'pie':
    case 'donut':
    case 'radialBar':
      return 'right';
    default:
      return 'bottom';
  }
}

// =============================================================================
// Component
// =============================================================================

export const ChartRenderer: React.FC<ChartRendererProps> = ({ chartData, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentChartType, setCurrentChartType] = useState<ChartType>(chartData.chart_type as ChartType);
  const [showTypeSwitcher, setShowTypeSwitcher] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  const { 
    title, 
    subtitle,
    data, 
    x_label, 
    y_label, 
    colors = DEFAULT_COLORS,
    legendPosition,
    series,
    showGrid = true,
    gridStyle = 'dashed',
    animate = true,
  } = chartData;
  
  // Ensure data has proper format
  const processedData = useMemo(() => data.map((item, index) => ({
    name: item.name || `Item ${index + 1}`,
    value: item.value ?? item.y ?? 0,
    x: item.x ?? index,
    y: item.y ?? item.value ?? 0,
    ...item,
  })), [data]);
  
  // Get all data keys for multi-series charts
  const dataKeys = useMemo(() => {
    if (series && series.length > 0) {
      return series.map(s => s.dataKey);
    }
    // Auto-detect numeric keys from data
    if (processedData.length > 0) {
      const firstItem = processedData[0] as Record<string, unknown>;
      const numericKeys = Object.keys(firstItem).filter(key => 
        key !== 'name' && key !== 'x' && typeof firstItem[key] === 'number'
      );
      // If we have more than just 'value', return all numeric keys
      if (numericKeys.length > 1) {
        return numericKeys.filter(k => k !== 'value' && k !== 'y');
      }
    }
    return ['value'];
  }, [series, processedData]);
  
  // Determine legend position based on chart type
  const getLegendProps = () => {
    const position = legendPosition || getDefaultLegendPosition(currentChartType);
    
    if (position === 'none') {
      return { wrapperStyle: { display: 'none' } };
    }
    
    const baseProps = {
      iconSize: 10,
      wrapperStyle: { fontSize: '12px', fontFamily: 'Quicksand, sans-serif' },
    };
    
    switch (position) {
      case 'right':
        return { ...baseProps, layout: 'vertical' as const, verticalAlign: 'middle' as const, align: 'right' as const };
      case 'left':
        return { ...baseProps, layout: 'vertical' as const, verticalAlign: 'middle' as const, align: 'left' as const };
      case 'top':
        return { ...baseProps, layout: 'horizontal' as const, verticalAlign: 'top' as const, align: 'center' as const };
      case 'bottom':
      default:
        return { ...baseProps, layout: 'horizontal' as const, verticalAlign: 'bottom' as const, align: 'center' as const };
    }
  };
  
  // Get grid stroke style
  const getGridStroke = () => {
    switch (gridStyle) {
      case 'solid': return undefined;
      case 'dotted': return '1 3';
      case 'none': return undefined;
      case 'dashed':
      default: return '3 3';
    }
  };
  
  // Export chart as PNG
  const exportPNG = async () => {
    if (!chartRef.current) return;
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2, // Retina quality
        backgroundColor: '#ffffff',
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export PNG:', error);
    }
  };
  
  // Export chart data as CSV
  const exportCSV = () => {
    const headers = Object.keys(processedData[0] || {}).join(',');
    const rows = processedData.map(row => 
      Object.values(row).join(',')
    ).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Export chart data as JSON
  const exportJSON = () => {
    const json = JSON.stringify(chartData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Get compatible chart types for switching
  const compatibleTypes = useMemo(() => getCompatibleTypes(currentChartType), [currentChartType]);
  
  // Chart height based on expanded state - HD quality
  const chartHeight = isExpanded ? 500 : 350;
  
  // Common axis props with improved fonts
  const xAxisProps = {
    dataKey: 'name',
    tick: { fill: '#737373', fontSize: 12, fontFamily: 'Quicksand, sans-serif' },
    axisLine: { stroke: '#d4d4d4' },
    tickLine: { stroke: '#d4d4d4' },
    label: x_label ? { value: x_label, position: 'bottom' as const, fill: '#737373', fontSize: 13, fontFamily: 'Quicksand, sans-serif', offset: -5 } : undefined,
  };
  
  const yAxisProps = {
    tick: { fill: '#737373', fontSize: 12, fontFamily: 'Quicksand, sans-serif' },
    axisLine: { stroke: '#d4d4d4' },
    tickLine: { stroke: '#d4d4d4' },
    label: y_label ? { value: y_label, angle: -90, position: 'insideLeft' as const, fill: '#737373', fontSize: 13, fontFamily: 'Quicksand, sans-serif' } : undefined,
  };
  
  // Render the appropriate chart type
  const renderChart = () => {
    const gridProps = showGrid && gridStyle !== 'none' 
      ? { strokeDasharray: getGridStroke(), stroke: '#e5e5e5' }
      : undefined;
    
    switch (currentChartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.length === 1 ? (
                <Bar dataKey={dataKeys[0]} name={series?.[0]?.name || 'Value'} radius={[4, 4, 0, 0]} isAnimationActive={animate}>
                  {processedData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              ) : (
                dataKeys.map((key, idx) => (
                  <Bar 
                    key={key}
                    dataKey={key} 
                    name={series?.[idx]?.name || key} 
                    fill={series?.[idx]?.color || colors[idx % colors.length]}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={animate}
                  />
                ))
              )}
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'stackedBar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.map((key, idx) => (
                <Bar 
                  key={key}
                  dataKey={key} 
                  name={series?.[idx]?.name || key}
                  stackId="stack"
                  fill={series?.[idx]?.color || colors[idx % colors.length]}
                  isAnimationActive={animate}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'horizontalBar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={processedData} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 5 }}>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis type="number" tick={{ fill: '#737373', fontSize: 12, fontFamily: 'Quicksand, sans-serif' }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#737373', fontSize: 12, fontFamily: 'Quicksand, sans-serif' }} width={70} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.length === 1 ? (
                <Bar dataKey={dataKeys[0]} name={series?.[0]?.name || 'Value'} radius={[0, 4, 4, 0]} isAnimationActive={animate}>
                  {processedData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              ) : (
                dataKeys.map((key, idx) => (
                  <Bar 
                    key={key}
                    dataKey={key} 
                    name={series?.[idx]?.name || key}
                    fill={series?.[idx]?.color || colors[idx % colors.length]}
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={animate}
                  />
                ))
              )}
            </BarChart>
          </ResponsiveContainer>
        );
        
      case 'line':
      case 'smoothLine':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.map((key, idx) => (
                <Line 
                  key={key}
                  type={currentChartType === 'smoothLine' ? 'monotone' : 'linear'}
                  dataKey={key}
                  name={series?.[idx]?.name || key}
                  stroke={series?.[idx]?.color || colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ fill: series?.[idx]?.color || colors[idx % colors.length], strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={animate}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'stackedLine':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.map((key, idx) => (
                <Area 
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={series?.[idx]?.name || key}
                  stackId="stack"
                  stroke={series?.[idx]?.color || colors[idx % colors.length]}
                  fill={series?.[idx]?.color || colors[idx % colors.length]}
                  fillOpacity={0.6}
                  isAnimationActive={animate}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
        
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              <defs>
                {dataKeys.map((key, idx) => (
                  <linearGradient key={`gradient-${key}`} id={`colorGradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={series?.[idx]?.color || colors[idx % colors.length]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={series?.[idx]?.color || colors[idx % colors.length]} stopOpacity={0.1}/>
                  </linearGradient>
                ))}
              </defs>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.map((key, idx) => (
                <Area 
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={series?.[idx]?.name || key}
                  stroke={series?.[idx]?.color || colors[idx % colors.length]}
                  fillOpacity={1}
                  fill={`url(#colorGradient-${key})`}
                  isAnimationActive={animate}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      
      case 'stackedArea':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.map((key, idx) => (
                <Area 
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={series?.[idx]?.name || key}
                  stackId="stack"
                  stroke={series?.[idx]?.color || colors[idx % colors.length]}
                  fill={series?.[idx]?.color || colors[idx % colors.length]}
                  fillOpacity={0.7}
                  isAnimationActive={animate}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      
      case 'multiArea':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              <defs>
                {dataKeys.map((key, idx) => (
                  <linearGradient key={`gradient-${key}`} id={`multiGradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={series?.[idx]?.color || colors[idx % colors.length]} stopOpacity={0.6}/>
                    <stop offset="95%" stopColor={series?.[idx]?.color || colors[idx % colors.length]} stopOpacity={0.1}/>
                  </linearGradient>
                ))}
              </defs>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.map((key, idx) => (
                <Area 
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={series?.[idx]?.name || key}
                  stroke={series?.[idx]?.color || colors[idx % colors.length]}
                  strokeWidth={2}
                  fill={`url(#multiGradient-${key})`}
                  fillOpacity={1}
                  isAnimationActive={animate}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
        
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
              <Pie
                data={processedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={isExpanded ? 130 : 100}
                paddingAngle={2}
                label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
                isAnimationActive={animate}
              >
                {processedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [`${value} (${name})`, '']}
              />
              <Legend 
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                iconSize={10}
                wrapperStyle={{ fontSize: '12px', fontFamily: 'Quicksand, sans-serif', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
              <Pie
                data={processedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={isExpanded ? 70 : 50}
                outerRadius={isExpanded ? 130 : 100}
                paddingAngle={2}
                label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
                isAnimationActive={animate}
              >
                {processedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [`${value} (${name})`, '']}
              />
              <Legend 
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                iconSize={10}
                wrapperStyle={{ fontSize: '12px', fontFamily: 'Quicksand, sans-serif', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis 
                type="number"
                dataKey="x" 
                tick={{ fill: '#737373', fontSize: 12, fontFamily: 'Quicksand, sans-serif' }}
                axisLine={{ stroke: '#d4d4d4' }}
                label={x_label ? { value: x_label, position: 'bottom' as const, fill: '#737373', fontSize: 13 } : undefined}
              />
              <YAxis 
                type="number"
                dataKey="y"
                tick={{ fill: '#737373', fontSize: 12, fontFamily: 'Quicksand, sans-serif' }}
                axisLine={{ stroke: '#d4d4d4' }}
                label={y_label ? { value: y_label, angle: -90, position: 'insideLeft' as const, fill: '#737373', fontSize: 13 } : undefined}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
              <Legend {...getLegendProps()} />
              <Scatter name="Data" data={processedData} fill={colors[0]} isAnimationActive={animate}>
                {processedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        );
      
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RadarChart cx="50%" cy="50%" outerRadius={isExpanded ? '75%' : '65%'} data={processedData}>
              <PolarGrid stroke="#e5e5e5" />
              <PolarAngleAxis dataKey="name" tick={{ fill: '#737373', fontSize: 12, fontFamily: 'Quicksand, sans-serif' }} />
              <PolarRadiusAxis tick={{ fill: '#737373', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {dataKeys.map((key, idx) => (
                <Radar
                  key={key}
                  name={series?.[idx]?.name || key}
                  dataKey={key}
                  stroke={series?.[idx]?.color || colors[idx % colors.length]}
                  fill={series?.[idx]?.color || colors[idx % colors.length]}
                  fillOpacity={0.4}
                  isAnimationActive={animate}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        );
      
      case 'radialBar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RadialBarChart
              cx="40%"
              cy="50%"
              innerRadius={isExpanded ? '25%' : '20%'}
              outerRadius={isExpanded ? '85%' : '80%'}
              barSize={isExpanded ? 18 : 14}
              data={processedData}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar
                label={{ position: 'insideStart', fill: '#fff', fontSize: 12, fontFamily: 'Quicksand, sans-serif' }}
                background
                dataKey="value"
                isAnimationActive={animate}
              >
                {processedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </RadialBar>
              <Legend
                iconSize={10}
                layout="vertical"
                verticalAlign="middle"
                align="right"
                wrapperStyle={{ fontSize: '12px', fontFamily: 'Quicksand, sans-serif', paddingLeft: '20px' }}
              />
              <Tooltip contentStyle={tooltipStyle} />
            </RadialBarChart>
          </ResponsiveContainer>
        );
      
      case 'composed':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: x_label ? 30 : 5 }}>
              {gridProps && <CartesianGrid {...gridProps} />}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...getLegendProps()} />
              {series && series.length > 0 ? (
                series.map((s, idx) => {
                  const color = s.color || colors[idx % colors.length];
                  switch (s.type) {
                    case 'bar':
                      return <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={animate} />;
                    case 'line':
                      return <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={color} strokeWidth={2} isAnimationActive={animate} />;
                    case 'area':
                      return <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} fill={color} fillOpacity={0.3} stroke={color} isAnimationActive={animate} />;
                    default:
                      return <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={color} isAnimationActive={animate} />;
                  }
                })
              ) : (
                <>
                  <Area type="monotone" dataKey="value" name="Area" fill={colors[2] || '#16a34a'} fillOpacity={0.2} stroke="none" isAnimationActive={animate} />
                  <Bar dataKey="value" name="Bar" fill={colors[0]} radius={[4, 4, 0, 0]} isAnimationActive={animate} />
                  <Line type="monotone" dataKey="value" name="Line" stroke={colors[1] || '#2563eb'} strokeWidth={2} isAnimationActive={animate} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        );
      
      case 'funnel':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <FunnelChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Funnel
                dataKey="value"
                data={processedData}
                isAnimationActive={animate}
              >
                {processedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
                <LabelList position="center" fill="#fff" stroke="none" dataKey="name" fontSize={12} fontFamily="Quicksand, sans-serif" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        );
      
      case 'treemap':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <Treemap
              data={processedData}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill={colors[0]}
              isAnimationActive={animate}
            >
              {processedData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
              <Tooltip contentStyle={tooltipStyle} />
            </Treemap>
          </ResponsiveContainer>
        );
        
      default:
        return (
          <div className="text-center py-8 text-primary-500">
            Unknown chart type: {currentChartType}
          </div>
        );
    }
  };
  
  return (
    <div className={`bg-white rounded-xl border border-primary-200 overflow-hidden shadow-sm ${className}`}>
      {/* Enhanced Header */}
      <div className="px-4 py-3 border-b border-primary-100 bg-primary-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-xl flex-shrink-0">📊</span>
            <div className="min-w-0">
              <h3 className="font-bold text-primary-800 text-base truncate" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-primary-500 truncate mt-0.5" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Chart Type Badge & Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowTypeSwitcher(!showTypeSwitcher)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-full transition-colors"
                style={{ fontFamily: 'Quicksand, sans-serif' }}
              >
                {CHART_TYPE_LABELS[currentChartType] || currentChartType}
                <ChevronDown size={12} className={`transition-transform ${showTypeSwitcher ? 'rotate-180' : ''}`} />
              </button>
              
              {showTypeSwitcher && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-primary-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                  {compatibleTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        setCurrentChartType(type);
                        setShowTypeSwitcher(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50 transition-colors ${
                        currentChartType === type ? 'bg-primary-100 font-semibold' : ''
                      }`}
                      style={{ fontFamily: 'Quicksand, sans-serif' }}
                    >
                      {CHART_TYPE_LABELS[type] || type}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Data Points Badge */}
            <span className="text-xs text-primary-500 px-2 py-1 bg-primary-100 rounded-full hidden sm:inline" style={{ fontFamily: 'Quicksand, sans-serif' }}>
              {processedData.length} pts
            </span>
            
            {/* Export Dropdown */}
            <div className="relative group/export">
              <button
                className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-500 hover:text-primary-700 transition-colors"
                title="Export"
              >
                <Download size={16} />
              </button>
              <div className="absolute right-0 top-full pt-1 z-50 min-w-[100px] invisible opacity-0 group-hover/export:visible group-hover/export:opacity-100 transition-all duration-150">
                <div className="bg-white border border-primary-200 rounded-lg shadow-lg py-1">
                  <button
                    onClick={exportPNG}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50 transition-colors flex items-center gap-2"
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                  >
                    <ImageIcon size={12} /> PNG
                  </button>
                  <button
                    onClick={exportCSV}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50 transition-colors flex items-center gap-2"
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                  >
                    <FileText size={12} /> CSV
                  </button>
                  <button
                    onClick={exportJSON}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50 transition-colors flex items-center gap-2"
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                  >
                    <FileCode size={12} /> JSON
                  </button>
                </div>
              </div>
            </div>
            
            {/* Expand/Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-500 hover:text-primary-700 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Chart Area */}
      <div ref={chartRef} className="p-4 bg-white overflow-hidden">
        {renderChart()}
      </div>
      
      {/* Footer - Data summary */}
      <div className="px-4 py-2 border-t border-primary-100 bg-primary-50/50 flex items-center justify-between">
        <span className="text-xs text-primary-500" style={{ fontFamily: 'Quicksand, sans-serif' }}>
          {processedData.length} data points
          {x_label && ` • X: ${x_label}`}
          {y_label && ` • Y: ${y_label}`}
        </span>
        {chartData.timestamp && (
          <span className="text-xs text-primary-400" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            {new Date(chartData.timestamp).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default ChartRenderer;
