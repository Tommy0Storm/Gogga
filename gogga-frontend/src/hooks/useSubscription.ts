'use client'

/**
 * GOGGA - useSubscription Hook
 * 
 * Client-side hook for managing subscription state and tier enforcement.
 * Fetches subscription data and provides methods for credit checking.
 */

import { useState, useEffect, useCallback } from 'react'

export interface SubscriptionState {
  tier: 'FREE' | 'JIVE' | 'JIGGA'
  status: string
  credits: {
    total: number
    used: number
    available: number
    purchased: number
    monthly: number
  }
  images: {
    used: number
    limit: number
  }
  isLoading: boolean
  error: string | null
}

const DEFAULT_STATE: SubscriptionState = {
  tier: 'FREE',
  status: 'active',
  credits: {
    total: 0,
    used: 0,
    available: 0,
    purchased: 0,
    monthly: 0,
  },
  images: {
    used: 0,
    limit: 0,
  },
  isLoading: true,
  error: null,
}

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>(DEFAULT_STATE)

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const response = await fetch('/api/subscription')
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscription')
      }
      
      const data = await response.json()
      
      setState({
        tier: data.tier || 'FREE',
        status: data.status || 'active',
        credits: data.credits || DEFAULT_STATE.credits,
        images: data.images || DEFAULT_STATE.images,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  /**
   * Check if user has enough credits for an action
   * @param estimatedCredits - Estimated credits needed (rough estimate)
   */
  const hasCredits = useCallback((estimatedCredits = 100): boolean => {
    // FREE tier always has "credits" (uses community models)
    if (state.tier === 'FREE') return true
    
    // Paid tiers need actual credits
    return state.credits.available >= estimatedCredits
  }, [state.tier, state.credits.available])

  /**
   * Check if user can generate an image
   */
  const canGenerateImage = useCallback((): boolean => {
    // FREE tier uses LongCat - always allowed
    if (state.tier === 'FREE') return true
    
    // Paid tiers have limits
    return state.images.used < state.images.limit
  }, [state.tier, state.images])

  /**
   * Get effective tier based on credits
   * If paid tier but out of credits, returns 'FREE'
   */
  const effectiveTier = useCallback((): 'FREE' | 'JIVE' | 'JIGGA' => {
    if (state.tier === 'FREE') return 'FREE'
    
    // If out of credits, downgrade to FREE behavior
    if (state.credits.available <= 0) {
      return 'FREE'
    }
    
    return state.tier
  }, [state.tier, state.credits.available])

  /**
   * Check if credits are low (< 10% remaining)
   */
  const isLowCredits = useCallback((): boolean => {
    if (state.tier === 'FREE') return false
    if (state.credits.total === 0) return false
    
    return state.credits.available < (state.credits.total * 0.1)
  }, [state.tier, state.credits])

  /**
   * Report credit usage to backend (called after AI response)
   */
  const reportUsage = useCallback(async (
    tokensUsed: number,
    imageGenerated = false
  ): Promise<void> => {
    if (state.tier === 'FREE') return // FREE tier doesn't track usage
    
    try {
      await fetch('/api/subscription/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokensUsed,
          imageGenerated,
        }),
      })
      
      // Refresh subscription data
      await fetchSubscription()
    } catch (error) {
      console.error('Failed to report usage:', error)
    }
  }, [state.tier, fetchSubscription])

  return {
    ...state,
    hasCredits,
    canGenerateImage,
    effectiveTier,
    isLowCredits,
    reportUsage,
    refresh: fetchSubscription,
  }
}

export default useSubscription
