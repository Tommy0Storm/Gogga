/**
 * GOGGA - Internal Subscription Reset API
 * 
 * POST /api/internal/subscription-reset
 * 
 * Called by backend scheduler to:
 * - Reset monthly credits for active subscriptions
 * - Expire cancelled subscriptions past grace period
 * - Mark failed subscriptions as cancelled after 3 retries
 * 
 * Security: Requires INTERNAL_API_KEY in Authorization header
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Tier credit/image allocations
const TIER_CREDITS: Record<string, number> = {
  FREE: 0,
  JIVE: 500_000,
  JIGGA: 2_000_000,
}

const TIER_IMAGES: Record<string, number> = {
  FREE: 0,
  JIVE: 200,
  JIGGA: 1000,
}

export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY || 'dev-internal-key-change-in-production'
    
    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      console.warn('Internal API: Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, user_id } = body

    if (action === 'manual_reset' && user_id) {
      // Manual reset for a specific user (admin action)
      return await handleManualReset(user_id)
    }

    // Daily check - process all subscriptions
    return await handleDailyCheck()

  } catch (error) {
    console.error('Subscription reset error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleDailyCheck() {
  const now = new Date()
  const results = {
    reset: 0,
    expired: 0,
    cancelled: 0,
    errors: 0,
  }

  console.log(`[Subscription Check] Starting daily check at ${now.toISOString()}`)

  // 1. Reset active subscriptions that are due
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      nextBilling: { lte: now },
    },
    include: { user: true },
  })

  for (const sub of activeSubscriptions) {
    try {
      const tierCredits = TIER_CREDITS[sub.tier] || 0
      const tierImages = TIER_IMAGES[sub.tier] || 0
      const nextBilling = new Date(sub.nextBilling || now)
      nextBilling.setDate(nextBilling.getDate() + 30)

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          monthlyCredits: tierCredits,
          creditsUsed: 0,
          imagesUsed: 0,
          imagesLimit: tierImages,
          nextBilling,
          lastReset: now,
          // Reset retry count on successful renewal
          retryCount: 0,
          paymentFailedAt: null,
        },
      })

      console.log(`[Reset] ${sub.user.email}: ${sub.tier} → ${tierCredits} credits, ${tierImages} images`)
      results.reset++
    } catch (err) {
      console.error(`[Reset Error] ${sub.id}:`, err)
      results.errors++
    }
  }

  // 2. Expire cancelled subscriptions past their nextBilling date
  const cancelledSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'cancelled',
      nextBilling: { lte: now },
    },
    include: { user: true },
  })

  for (const sub of cancelledSubscriptions) {
    try {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'expired',
          tier: 'FREE',
          monthlyCredits: 0,
          imagesLimit: 0,
          imagesUsed: 0,
          creditsUsed: 0,
          // Keep purchased credits - they don't expire on cancel
        },
      })

      console.log(`[Expired] ${sub.user.email}: ${sub.tier} → FREE (grace period over)`)
      results.expired++
      
      // TODO: Send subscription_expired email
    } catch (err) {
      console.error(`[Expire Error] ${sub.id}:`, err)
      results.errors++
    }
  }

  // 3. Cancel past_due subscriptions with 3+ failed retries
  const pastDueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'past_due',
      retryCount: { gte: 3 },
    },
    include: { user: true },
  })

  for (const sub of pastDueSubscriptions) {
    try {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'cancelled',
          // Keep nextBilling so they have grace period
        },
      })

      console.log(`[Cancelled] ${sub.user.email}: Payment failed 3+ times`)
      results.cancelled++
      
      // TODO: Send subscription_cancelled email
    } catch (err) {
      console.error(`[Cancel Error] ${sub.id}:`, err)
      results.errors++
    }
  }

  console.log(`[Subscription Check] Complete: ${results.reset} reset, ${results.expired} expired, ${results.cancelled} cancelled, ${results.errors} errors`)

  return NextResponse.json(results)
}

async function handleManualReset(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { user: true },
  })

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const tierCredits = TIER_CREDITS[subscription.tier] || 0
  const tierImages = TIER_IMAGES[subscription.tier] || 0
  const now = new Date()
  const nextBilling = new Date(now)
  nextBilling.setDate(nextBilling.getDate() + 30)

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      monthlyCredits: tierCredits,
      creditsUsed: 0,
      imagesUsed: 0,
      imagesLimit: tierImages,
      nextBilling,
      lastReset: now,
      status: 'active',
      retryCount: 0,
      paymentFailedAt: null,
    },
  })

  console.log(`[Manual Reset] ${subscription.user.email}: ${subscription.tier} → ${tierCredits} credits`)

  return NextResponse.json({
    success: true,
    user: subscription.user.email,
    tier: subscription.tier,
    credits: tierCredits,
    images: tierImages,
  })
}

// Health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    endpoint: 'subscription-reset',
    description: 'Internal API for daily subscription management'
  })
}
