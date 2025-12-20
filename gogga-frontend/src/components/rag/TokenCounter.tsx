'use client';

/**
 * TokenCounter Component
 * 
 * Real-time token counter for chat input with:
 * - Live token count as user types
 * - Budget utilization bar
 * - Cost estimate tooltip (for paid tiers)
 * - Warning states when approaching limits
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md - Token Budget Allocation
 */

import React, { useMemo } from 'react';
import { 
  countTokens, 
  TOKEN_BUDGETS, 
  estimateTokens, 
  formatTokenCount,
  type Tier 
} from '@/lib/tokenizer';

interface TokenCounterProps {
  /** Current text being typed */
  text: string;
  /** User's subscription tier */
  tier: Tier;
  /** Tokens already consumed in current conversation */
  currentVolatileTokens?: number;
  /** Show cost estimate (for paid tiers) */
  showCost?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Get color class based on utilization percentage
 */
function getUtilizationColor(percent: number): string {
  if (percent >= 90) return 'text-red-600';
  if (percent >= 75) return 'text-orange-500';
  if (percent >= 50) return 'text-yellow-600';
  return 'text-primary-600';
}

/**
 * Get bar color based on utilization
 */
function getBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-orange-400';
  if (percent >= 50) return 'bg-yellow-400';
  return 'bg-primary-500';
}

export function TokenCounter({
  text,
  tier,
  currentVolatileTokens = 0,
  showCost = false,
  compact = false,
  className = '',
}: TokenCounterProps) {
  const inputTokens = useMemo(() => countTokens(text), [text]);
  
  const budget = TOKEN_BUDGETS[tier].volatile;
  const totalUsed = currentVolatileTokens + inputTokens;
  const remaining = Math.max(0, budget - totalUsed);
  const utilizationPercent = Math.min(100, Math.round((totalUsed / budget) * 100));
  
  const estimate = useMemo(() => {
    if (!showCost || tier === 'free') return null;
    return estimateTokens(text, 500, tier);
  }, [text, tier, showCost]);
  
  const colorClass = getUtilizationColor(utilizationPercent);
  const barColor = getBarColor(utilizationPercent);
  
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <span className={colorClass}>
          {formatTokenCount(inputTokens)} tokens
        </span>
        {remaining < 500 && (
          <span className="text-red-500 font-medium">
            ({formatTokenCount(remaining)} left)
          </span>
        )}
      </div>
    );
  }
  
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Token counts */}
      <div className="flex items-center justify-between text-xs">
        <span className={colorClass}>
          {formatTokenCount(inputTokens)} / {formatTokenCount(budget)} tokens
        </span>
        <span className="text-primary-500">
          {formatTokenCount(remaining)} remaining
        </span>
      </div>
      
      {/* Utilization bar */}
      <div className="h-1 w-full bg-primary-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${utilizationPercent}%` }}
        />
      </div>
      
      {/* Cost estimate (paid tiers only) */}
      {estimate && estimate.estimatedCostZar > 0 && (
        <div className="text-xs text-primary-400">
          Est. cost: R{estimate.estimatedCostZar.toFixed(4)}
        </div>
      )}
      
      {/* Warning messages */}
      {utilizationPercent >= 90 && (
        <div className="text-xs text-red-500 font-medium">
          ⚠️ Approaching token limit. Consider starting a new session.
        </div>
      )}
    </div>
  );
}

/**
 * Minimal inline token counter for chat input
 */
export function TokenCounterInline({
  text,
  tier,
  currentVolatileTokens = 0,
}: Pick<TokenCounterProps, 'text' | 'tier' | 'currentVolatileTokens'>) {
  const inputTokens = useMemo(() => countTokens(text), [text]);
  const budget = TOKEN_BUDGETS[tier].volatile;
  const totalUsed = currentVolatileTokens + inputTokens;
  const percent = Math.round((totalUsed / budget) * 100);
  
  return (
    <span className={`text-xs tabular-nums ${getUtilizationColor(percent)}`}>
      {formatTokenCount(inputTokens)}
    </span>
  );
}

/**
 * Pre-send validation component
 */
export function CanSendIndicator({
  text,
  tier,
  currentVolatileTokens = 0,
}: Pick<TokenCounterProps, 'text' | 'tier' | 'currentVolatileTokens'>) {
  const inputTokens = useMemo(() => countTokens(text), [text]);
  const budget = TOKEN_BUDGETS[tier].volatile;
  const remaining = budget - currentVolatileTokens;
  const canSend = inputTokens <= remaining;
  
  if (canSend) {
    return null; // Don't show anything when OK
  }
  
  return (
    <div className="flex items-center gap-1 text-xs text-red-500">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span>Message too long ({formatTokenCount(inputTokens - remaining)} over)</span>
    </div>
  );
}

export default TokenCounter;
