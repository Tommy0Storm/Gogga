/**
 * GOGGA - User Subscription Helper
 * 
 * Server-side utility for fetching user subscription status.
 * Used in API routes to determine tier-based access.
 */
import prisma from '@/lib/prisma'

export type UserTier = 'FREE' | 'JIVE' | 'JIGGA'

export interface UserSubscription {
  userId: string
  email: string
  tier: UserTier
  status: 'pending' | 'active' | 'cancelled' | 'expired' | null
  nextBilling: Date | null
}

/**
 * Get user's subscription tier by email
 * Returns FREE if no subscription found or subscription not active
 */
export async function getUserTier(email: string): Promise<UserTier> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { subscription: true }
    })

    if (!user?.subscription) {
      return 'FREE'
    }

    // Only return tier if subscription is active
    if (user.subscription.status === 'active') {
      return user.subscription.tier as UserTier
    }

    return 'FREE'
  } catch (error) {
    console.error('Error fetching user tier:', error)
    return 'FREE'
  }
}

/**
 * Get full user subscription details
 */
export async function getUserSubscription(email: string): Promise<UserSubscription | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { subscription: true }
    })

    if (!user) {
      return null
    }

    return {
      userId: user.id,
      email: user.email,
      tier: (user.subscription?.status === 'active' 
        ? user.subscription.tier 
        : 'FREE') as UserTier,
      status: user.subscription?.status as UserSubscription['status'] ?? null,
      nextBilling: user.subscription?.nextBilling ?? null
    }
  } catch (error) {
    console.error('Error fetching user subscription:', error)
    return null
  }
}

/**
 * Check if user has access to a specific tier's features
 */
export function hasTierAccess(userTier: UserTier, requiredTier: UserTier): boolean {
  const tierLevels: Record<UserTier, number> = {
    'FREE': 0,
    'JIVE': 1,
    'JIGGA': 2
  }

  return tierLevels[userTier] >= tierLevels[requiredTier]
}

/**
 * Get tier limits for various features
 */
export function getTierLimits(tier: UserTier) {
  const limits = {
    FREE: {
      imagesPerMonth: 50,
      docsPerSession: 0,
      searchesPerDay: 3,
      researchPerDay: 0,
      hasRag: false,
      hasSemanticRag: false,
      hasChatHistory: false,
      hasThinkingMode: false,
    },
    JIVE: {
      imagesPerMonth: 200,
      docsPerSession: 5,
      searchesPerDay: 50,
      researchPerDay: 10,
      hasRag: true,
      hasSemanticRag: false,
      hasChatHistory: true,
      hasThinkingMode: false,
    },
    JIGGA: {
      imagesPerMonth: 1000,
      docsPerSession: 10,
      searchesPerDay: -1, // unlimited
      researchPerDay: -1, // unlimited
      hasRag: true,
      hasSemanticRag: true,
      hasChatHistory: true,
      hasThinkingMode: true,
    }
  }

  return limits[tier]
}
