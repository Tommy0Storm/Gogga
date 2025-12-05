/**
 * GOGGA - Subscription Utilities
 * 
 * Helper functions for checking user tier and subscription status.
 * Use these throughout the app for consistent tier enforcement.
 */
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export type Tier = 'FREE' | 'JIVE' | 'JIGGA'

export interface UserSubscription {
  tier: Tier
  status: 'pending' | 'active' | 'cancelled' | 'expired'
  startedAt: Date | null
  nextBilling: Date | null
}

/**
 * Get the current user's subscription from the database.
 * Falls back to FREE tier if no subscription exists.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  })

  if (!subscription) {
    // Create FREE subscription if missing (shouldn't happen, but safety)
    const newSub = await prisma.subscription.create({
      data: {
        userId,
        tier: 'FREE',
        status: 'active',
        startedAt: new Date()
      }
    })
    return {
      tier: 'FREE',
      status: 'active',
      startedAt: newSub.startedAt,
      nextBilling: null
    }
  }

  return {
    tier: subscription.tier as Tier,
    status: subscription.status as 'pending' | 'active' | 'cancelled' | 'expired',
    startedAt: subscription.startedAt,
    nextBilling: subscription.nextBilling
  }
}

/**
 * Require a minimum tier for access.
 * Redirects to /upgrade if user doesn't have required tier.
 */
export async function requireTier(minTier: Tier): Promise<UserSubscription> {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  const subscription = await getUserSubscription(session.user.id)
  
  const tierRank = { FREE: 0, JIVE: 1, JIGGA: 2 }
  
  if (tierRank[subscription.tier] < tierRank[minTier]) {
    redirect('/upgrade')
  }

  return subscription
}

/**
 * Check if user has at least the specified tier (no redirect).
 */
export function hasTier(userTier: Tier, requiredTier: Tier): boolean {
  const tierRank = { FREE: 0, JIVE: 1, JIGGA: 2 }
  return tierRank[userTier] >= tierRank[requiredTier]
}

/**
 * Get tier display info.
 */
export function getTierInfo(tier: Tier) {
  const tiers = {
    FREE: {
      name: 'Free',
      price: 'R0',
      color: 'gray',
      features: ['Basic AI chat', 'Limited images', 'No RAG']
    },
    JIVE: {
      name: 'Jive',
      price: 'R99/mo',
      color: 'blue',
      features: ['Fast AI (2,200 t/s)', '200 images/mo', '5 docs RAG', 'CePO reasoning']
    },
    JIGGA: {
      name: 'Jigga',
      price: 'R299/mo',
      color: 'purple',
      features: ['Thinking mode', '1,000 images/mo', '10 docs RAG', 'Semantic search', 'Dashboard']
    }
  }
  return tiers[tier]
}
