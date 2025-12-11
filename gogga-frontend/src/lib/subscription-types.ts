/**
 * GOGGA - Subscription Types & Constants (Client-Safe)
 * 
 * This file contains only types and constants that can be safely
 * imported in client components (no server-side imports).
 * 
 * For server-side functions that use Prisma, import from subscription.ts
 */

export type Tier = 'FREE' | 'JIVE' | 'JIGGA'

export type SubscriptionStatus =
  | 'pending'
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'out_of_credits';

export interface UserSubscription {
  tier: Tier;
  status: SubscriptionStatus;
  startedAt: Date | null;
  nextBilling: Date | null;
  credits: number;
  creditsUsed: number;
  monthlyCredits: number;
  imagesUsed: number;
  imagesLimit: number;
}

/**
 * Credit pack definitions
 */
export const CREDIT_PACKS = {
  '200': { price: 200, credits: 50000, description: 'Small Pack' },
  '500': { price: 500, credits: 150000, description: 'Medium Pack' },
  '1000': { price: 1000, credits: 350000, description: 'Large Pack' }
} as const

/**
 * Tier limits and credits configuration
 */
export const TIER_CONFIG = {
  FREE: {
    monthlyCredits: 0,
    imagesLimit: 50,
    ragDocs: 0,
    chatPersistence: false,
    streaming: false
  },
  JIVE: {
    monthlyCredits: 500000,
    imagesLimit: 200,
    ragDocs: 5,
    chatPersistence: true,
    streaming: true
  },
  JIGGA: {
    monthlyCredits: 2000000,
    imagesLimit: 1000,
    ragDocs: 10,
    chatPersistence: true,
    streaming: true
  }
} as const

/**
 * Get tier display info (client-safe)
 */
export function getTierInfo(tier: Tier) {
  const tiers: Record<Tier, { name: string; price: string; color: string; features: string[] }> = {
    FREE: {
      name: 'Free',
      price: 'R0/mo',
      color: 'gray',
      features: ['Basic AI', '50 images/mo', 'No RAG', 'No persistence']
    },
    JIVE: {
      name: 'Jive',
      price: 'R99/mo',
      color: 'blue',
      features: ['CePO reasoning', '200 images/mo', '5 docs RAG', 'Chat history']
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

/**
 * Check if user has sufficient credits for an action (client-safe helper).
 * Returns false if out of credits (for paid features).
 */
export function hasCredits(subscription: UserSubscription, required: number = 1): boolean {
  // FREE tier doesn't use credits
  if (subscription.tier === 'FREE') return true
  
  // Paid tiers need credits
  return subscription.credits >= required
}

/**
 * Check if user can generate an image (within monthly limit)
 */
export function canGenerateImage(subscription: UserSubscription): boolean {
  return subscription.imagesUsed < subscription.imagesLimit
}

/**
 * Format credits for display (e.g., 150000 -> "150K")
 */
export function formatCredits(credits: number): string {
  if (credits >= 1000000) return `${(credits / 1000000).toFixed(1)}M`
  if (credits >= 1000) return `${Math.round(credits / 1000)}K`
  return credits.toString()
}

/**
 * Get remaining images this month
 */
export function getRemainingImages(subscription: UserSubscription): number {
  return Math.max(0, subscription.imagesLimit - subscription.imagesUsed)
}
