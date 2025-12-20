'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  trackTokenUsage,
  getTodayTokenUsage,
  getTotalTokenUsage,
  getTokenUsageHistory,
  getMonthlyTokenUsage,
  getMostUsedTools,
  getMonthlyToolUsage,
  TokenUsage,
} from '@/lib/db';

interface TierBreakdown {
  input: number;
  output: number;
  cost: number;
  requests: number;
}

interface TokenStats {
  today: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    costZar: number;
    requestCount: number;
    byTier: Record<string, TierBreakdown>;
  };
  monthly: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    costZar: number;
    requestCount: number;
    month: string;
    byTier: Record<string, TierBreakdown>;
  };
  allTime: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    costZar: number;
    requestCount: number;
  };
  isLoading: boolean;
}

interface ToolStats {
  mostUsed: {
    toolName: string;
    callCount: number;
    successRate: number;
    avgExecutionTimeMs: number;
    tier: string;
  }[];
  monthly: {
    month: string;
    totalCalls: number;
    successRate: number;
    byTool: { toolName: string; callCount: number; successRate: number }[];
  };
  isLoading: boolean;
}

export function useTokenTracking() {
  const [stats, setStats] = useState<TokenStats>({
    today: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costZar: 0,
      requestCount: 0,
      byTier: {},
    },
    monthly: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costZar: 0,
      requestCount: 0,
      month: '',
      byTier: {},
    },
    allTime: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costZar: 0,
      requestCount: 0,
    },
    isLoading: true,
  });

  const [toolStats, setToolStats] = useState<ToolStats>({
    mostUsed: [],
    monthly: {
      month: '',
      totalCalls: 0,
      successRate: 0,
      byTool: [],
    },
    isLoading: true,
  });

  const refreshStats = useCallback(async () => {
    try {
      const [today, monthly, allTime] = await Promise.all([
        getTodayTokenUsage(),
        getMonthlyTokenUsage(),
        getTotalTokenUsage(),
      ]);

      setStats({
        today,
        monthly,
        allTime,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading token stats:', error);
      setStats((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const refreshToolStats = useCallback(async () => {
    try {
      const [mostUsed, monthly] = await Promise.all([
        getMostUsedTools(10),
        getMonthlyToolUsage(),
      ]);

      setToolStats({
        mostUsed,
        monthly,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading tool stats:', error);
      setToolStats((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    refreshStats();
    refreshToolStats();
  }, [refreshStats, refreshToolStats]);

  const track = useCallback(
    async (
      tier: string,
      inputTokens: number,
      outputTokens: number,
      costZar: number = 0
    ) => {
      await trackTokenUsage({ tier, inputTokens, outputTokens, costZar });
      await refreshStats();
    },
    [refreshStats]
  );

  const getHistory = useCallback(
    async (days: number = 30): Promise<TokenUsage[]> => {
      return getTokenUsageHistory(days);
    },
    []
  );

  return {
    stats,
    toolStats,
    track,
    refreshStats,
    refreshToolStats,
    getHistory,
  };
}

// Format token count for display (e.g., 1.2K, 15.3K, 1.5M)
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  } else if (tokens < 1000000) {
    return (tokens / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else {
    return (tokens / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
  }
}

// Format cost for display in ZAR
export function formatCostZar(cost: number): string {
  return `R${cost.toFixed(2)}`;
}
