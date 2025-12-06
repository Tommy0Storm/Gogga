/**
 * GOGGA - Subscription Utilities (Server-Side)
 * 
 * Helper functions for checking user tier and subscription status.
 * Use these throughout the app for consistent tier enforcement.
 * 
 * NOTE: This file contains server-side code (Prisma, auth).
 * For client components, import from subscription-types.ts instead.
 */
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

// Re-export client-safe types and constants for backward compatibility
export {
  type Tier,
  type SubscriptionStatus,
  type UserSubscription,
  CREDIT_PACKS,
  TIER_CONFIG,
  getTierInfo,
  hasCredits,
  canGenerateImage,
  formatCredits,
  getRemainingImages
} from './subscription-types'

import {
  type Tier,
  type SubscriptionStatus,
  type UserSubscription,
  TIER_CONFIG,
} from './subscription-types';

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
        startedAt: new Date(),
        credits: 0,
        creditsUsed: 0,
        monthlyCredits: 0,
        imagesUsed: 0,
        imagesLimit: 50,
      },
    });
    return {
      tier: 'FREE',
      status: 'active',
      startedAt: newSub.startedAt,
      nextBilling: null,
      credits: 0,
      creditsUsed: 0,
      monthlyCredits: 0,
      imagesUsed: 0,
      imagesLimit: 50,
    };
  }

  return {
    tier: subscription.tier as Tier,
    status: subscription.status as SubscriptionStatus,
    startedAt: subscription.startedAt,
    nextBilling: subscription.nextBilling,
    credits: subscription.credits,
    creditsUsed: subscription.creditsUsed,
    monthlyCredits: subscription.monthlyCredits,
    imagesUsed: subscription.imagesUsed,
    imagesLimit: subscription.imagesLimit,
  };
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
 * Deduct credits from user account (server-side only)
 */
export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  })
  
  if (!subscription) return false
  if (subscription.tier === 'FREE') return true // FREE doesn't use credits
  if (subscription.credits < amount) return false
  
  await prisma.subscription.update({
    where: { userId },
    data: {
      credits: { decrement: amount },
      creditsUsed: { increment: amount }
    }
  })
  
  return true
}

/**
 * Add credits to user account (from credit pack purchase)
 */
export async function addCredits(userId: string, amount: number): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: {
      credits: { increment: amount }
    }
  })
}

/**
 * Increment image usage counter
 */
export async function useImage(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  })
  
  if (!subscription) return false
  if (subscription.imagesUsed >= subscription.imagesLimit) return false
  
  await prisma.subscription.update({
    where: { userId },
    data: {
      imagesUsed: { increment: 1 }
    }
  })
  
  return true
}

/**
 * Reset monthly counters (called on billing cycle reset)
 */
export async function resetMonthlyCounters(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) return;

  const tierConfig = TIER_CONFIG[subscription.tier as Tier];

  await prisma.subscription.update({
    where: { userId },
    data: {
      credits: tierConfig.monthlyCredits,
      creditsUsed: 0,
      imagesUsed: 0,
      lastReset: new Date(),
    },
  });
}

/**
 * Activate a subscription (called after PayFast payment confirmation)
 */
export async function activateSubscription(
  userId: string,
  tier: 'JIVE' | 'JIGGA',
  payfastToken?: string
): Promise<void> {
  const tierConfig = TIER_CONFIG[tier];
  const now = new Date();
  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      tier,
      status: 'active',
      payfastToken,
      credits: tierConfig.monthlyCredits,
      creditsUsed: 0,
      monthlyCredits: tierConfig.monthlyCredits,
      imagesUsed: 0,
      imagesLimit: tierConfig.imagesLimit,
      startedAt: now,
      nextBilling,
      lastReset: now,
    },
    create: {
      userId,
      tier,
      status: 'active',
      payfastToken,
      credits: tierConfig.monthlyCredits,
      creditsUsed: 0,
      monthlyCredits: tierConfig.monthlyCredits,
      imagesUsed: 0,
      imagesLimit: tierConfig.imagesLimit,
      startedAt: now,
      nextBilling,
      lastReset: now,
    },
  });
}

/**
 * Downgrade user to FREE tier (when credits run out or subscription cancelled)
 */
export async function downgradeToFree(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: {
      tier: 'FREE',
      status: 'active',
      credits: 0,
      creditsUsed: 0,
      monthlyCredits: 0,
      imagesUsed: 0,
      imagesLimit: 50,
      payfastToken: null,
      nextBilling: null,
    },
  });
}
