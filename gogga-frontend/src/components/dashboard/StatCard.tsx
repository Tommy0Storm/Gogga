/**
 * GOGGA RAG Dashboard - Stat Card Component
 * Monochrome design with grey gradients
 * Black Material Icons only
 * Quicksand font 400/Bold
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';

// ============================================================================
// Animation Helpers
// ============================================================================

/**
 * Animated Number Counter - Smoothly transitions between values
 */
function useAnimatedValue(targetValue: number, duration: number = 500): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const previousValue = useRef(targetValue);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function: easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (targetValue - startValue) * eased;
      
      setDisplayValue(current);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = targetValue;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration]);

  return displayValue;
}

/**
 * Tooltip Component - Educational info on hover
 */
interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-primary-900 rounded-lg shadow-elevated whitespace-nowrap animate-fadeIn">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-primary-900" />
        </div>
      )}
    </div>
  );
};

export { Tooltip };

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  compact?: boolean;
  /** Educational tooltip explaining the metric */
  info?: string;
  /** Show animated pulse when value changes */
  pulseOnChange?: boolean;
  /** Animate numeric values with counter effect */
  animateValue?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  loading = false,
  variant = 'default',
  compact = false,
  info,
  pulseOnChange = false,
  animateValue = false,
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const previousValue = useRef(value);
  
  // Parse numeric value for animation
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue) && animateValue;
  const animatedNum = useAnimatedValue(isNumeric ? numericValue : 0);
  
  // Detect value changes for pulse effect
  useEffect(() => {
    if (pulseOnChange && previousValue.current !== value) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 600);
      previousValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value, pulseOnChange]);
  
  const variantStyles = {
    default: 'border-primary-300',
    success: 'border-sa-green',
    warning: 'border-sa-gold',
    danger: 'border-sa-red',
  };

  // Format animated value back to original format
  const displayValue = isNumeric 
    ? (typeof value === 'number' 
        ? Math.round(animatedNum) 
        : String(value).replace(/[\d.]+/, Math.round(animatedNum).toString()))
    : value;

  if (loading) {
    return (
      <div className={`bg-primary-50 border border-primary-200 rounded-xl ${compact ? 'p-3' : 'p-5'} animate-pulse`}>
        <div className="h-4 bg-primary-200 rounded w-1/2 mb-3"></div>
        <div className="h-8 bg-primary-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-primary-200 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div 
      className={`
        bg-white border-l-4 ${variantStyles[variant]} rounded-xl ${compact ? 'p-3' : 'p-5'} 
        shadow-soft hover:shadow-medium transition-all duration-200
        hover:scale-[1.02] hover:-translate-y-0.5
        ${isPulsing ? 'animate-pulse ring-2 ring-sa-green/30' : ''}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <p className={`font-normal text-primary-500 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</p>
            {info && (
              <Tooltip content={info}>
                <Info className="w-3.5 h-3.5 text-primary-400 hover:text-primary-600 cursor-help transition-colors" />
              </Tooltip>
            )}
          </div>
          <p className={`font-bold text-primary-900 ${compact ? 'text-lg' : 'text-2xl'} transition-all duration-300`}>
            {displayValue}
          </p>
          {subtitle && (
            <p className="text-xs text-primary-400 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${trend.isPositive ? 'text-sa-green' : 'text-sa-red'} transition-colors duration-300`}>
              <span className={trend.isPositive ? 'animate-bounce-subtle' : ''}>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-primary-400 font-normal">vs last hour</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`bg-primary-100 rounded-lg ${compact ? 'p-1.5' : 'p-2'} transition-transform duration-200 hover:scale-110`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Metric Card - Multiple metrics in one card
 */
interface MetricCardProps {
  title: string;
  metrics: {
    label: string;
    value: string | number;
    unit?: string;
  }[];
  footer?: React.ReactNode;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  metrics,
  footer,
  icon,
}) => {
  return (
    <div className="bg-white border border-primary-200 rounded-xl p-5 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-primary-800">{title}</h3>
        {icon && (
          <div className="text-primary-500">{icon}</div>
        )}
      </div>
      <div className="space-y-3">
        {metrics.map((metric, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-sm text-primary-500">{metric.label}</span>
            <span className="text-sm font-bold text-primary-900">
              {metric.value}
              {metric.unit && <span className="text-primary-400 font-normal ml-1">{metric.unit}</span>}
            </span>
          </div>
        ))}
      </div>
      {footer && (
        <div className="mt-4 pt-3 border-t border-primary-100">
          {footer}
        </div>
      )}
    </div>
  );
};

/**
 * Progress Ring - Circular progress indicator
 */
interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: 'grey' | 'green' | 'gold' | 'red';
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  max,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
  color = 'grey',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min(value / max, 1);
  const offset = circumference - percent * circumference;

  const colorStyles = {
    grey: 'stroke-primary-600',
    green: 'stroke-sa-green',
    gold: 'stroke-sa-gold',
    red: 'stroke-sa-red',
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-primary-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${colorStyles[color]} transition-all duration-500 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-primary-900">
          {Math.round(percent * 100)}%
        </span>
        {label && (
          <span className="text-xs text-primary-500 mt-1">{label}</span>
        )}
        {sublabel && (
          <span className="text-xs text-primary-400">{sublabel}</span>
        )}
      </div>
    </div>
  );
};

/**
 * Status Badge - For showing model/system status
 */
interface StatusBadgeProps {
  status: 'online' | 'offline' | 'loading' | 'error' | 'idle';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
}) => {
  const statusConfig = {
    online: { color: 'bg-sa-green', text: 'Online', pulse: false },
    offline: { color: 'bg-primary-400', text: 'Offline', pulse: false },
    loading: { color: 'bg-sa-gold', text: 'Loading', pulse: true },
    error: { color: 'bg-sa-red', text: 'Error', pulse: false },
    idle: { color: 'bg-primary-300', text: 'Idle', pulse: false },
  };

  const sizeStyles = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block rounded-full ${config.color} ${sizeStyles[size]} ${config.pulse ? 'animate-pulse' : ''}`} />
      <span className="text-sm text-primary-600">{label || config.text}</span>
    </div>
  );
};

/**
 * Tier Badge - For showing subscription tier
 */
interface TierBadgeProps {
  tier: 'free' | 'jive' | 'jigga';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  tier,
  showLabel = true,
  size = 'md',
}) => {
  const tierConfig = {
    free: { bg: 'bg-primary-200', text: 'text-primary-700', label: 'FREE' },
    jive: { bg: 'bg-sa-green/20', text: 'text-sa-green', label: 'JIVE' },
    jigga: { bg: 'bg-sa-gold/20', text: 'text-sa-gold', label: 'JIGGA' },
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const config = tierConfig[tier];

  return (
    <span className={`inline-flex items-center font-bold rounded-full ${config.bg} ${config.text} ${sizeStyles[size]}`}>
      {showLabel && config.label}
    </span>
  );
};

/**
 * Info Row - Label/value pair
 */
interface InfoRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  highlight = false,
}) => {
  return (
    <div className="flex items-center justify-between py-2 border-b border-primary-100 last:border-0">
      <span className="text-sm text-primary-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-sa-green' : 'text-primary-800'}`}>
        {value}
      </span>
    </div>
  );
};

/**
 * Privacy Badge - Shows that data is stored locally in the browser
 * Educational component to build user trust
 */
interface PrivacyBadgeProps {
  variant?: 'compact' | 'default' | 'detailed';
  className?: string;
}

export const PrivacyBadge: React.FC<PrivacyBadgeProps> = ({
  variant = 'default',
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'compact') {
    return (
      <Tooltip content="All data stored locally in your browser - never sent to servers">
        <div className={`inline-flex items-center gap-1 px-2 py-1 bg-primary-50 border border-primary-200 rounded-full text-xs text-primary-600 hover:bg-primary-100 transition-colors cursor-help ${className}`}>
          <span>🔒</span>
          <span>Local Storage</span>
        </div>
      </Tooltip>
    );
  }

  if (variant === 'detailed') {
    return (
      <div 
        className={`bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-xl p-4 ${className}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3 cursor-pointer">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-xl">🔒</span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-primary-800">Your Data Stays Private</h4>
            <p className="text-xs text-primary-500 mt-0.5">
              All metrics stored locally in your browser (IndexedDB)
            </p>
          </div>
          <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-primary-200 animate-fadeIn">
            <ul className="text-xs text-primary-600 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-sa-green">✓</span>
                No data sent to external servers
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sa-green">✓</span>
                Automatic cleanup after 7 days
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sa-green">✓</span>
                Clear anytime from Maintenance tab
              </li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg ${className}`}>
      <span className="text-base">🔒</span>
      <span className="text-xs text-primary-600 font-medium">All data stored locally in your browser</span>
    </div>
  );
};

export default StatCard;
