'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  trackTokenUsage, 
  getTodayTokenUsage, 
  getTotalTokenUsage,
  getTokenUsageHistory,
  TokenUsage 
} from '@/lib/db';

interface TokenStats {
  today: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    costZar: number;
    requestCount: number;
    byTier: Record<string, {
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      costZar: number;
      requestCount: number;
    }>;
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

export function useTokenTracking() {
  const [stats, setStats] = useState<TokenStats>({
    today: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costZar: 0,
      requestCount: 0,
      byTier: {}
    },
    allTime: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costZar: 0,
      requestCount: 0
    },
    isLoading: true
  });

  const refreshStats = useCallback(async () => {
    try {
      const [today, allTime] = await Promise.all([
        getTodayTokenUsage(),
        getTotalTokenUsage()
      ]);
      
      setStats({
        today,
        allTime,
        isLoading: false
      });
    } catch (error) {
      console.error('Error loading token stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const track = useCallback(async (
    tier: string,
    inputTokens: number,
    outputTokens: number,
    costZar: number = 0
  ) => {
    await trackTokenUsage(tier, inputTokens, outputTokens, costZar);
    await refreshStats();
  }, [refreshStats]);

  const getHistory = useCallback(async (days: number = 30): Promise<TokenUsage[]> => {
    return getTokenUsageHistory(days);
  }, []);

  return {
    stats,
    track,
    refreshStats,
    getHistory
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
