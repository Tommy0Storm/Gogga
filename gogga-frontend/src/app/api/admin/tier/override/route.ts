/**
 * GOGGA - Admin Tier Override API
 * 
 * POST /api/admin/tier/override
 * 
 * Allows admins to manually change user subscription tiers with full audit trail.
 * All tier changes are logged with reason, admin email, and IP address.
 * 
 * Requires admin session authentication.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

interface TierOverrideRequest {
  userId: string;
  newTier: 'FREE' | 'JIVE' | 'JIGGA';
  reason: string;           // Required - audit trail
  resetUsage?: boolean;     // Whether to reset monthly usage counters
  grantCredits?: number;    // Optional: grant credits with tier change
}

// Tier configurations
const TIER_CONFIG = {
  FREE: {
    monthlyCredits: 0,
    imagesLimit: 50,
  },
  JIVE: {
    monthlyCredits: 500_000,
    imagesLimit: 200,
  },
  JIGGA: {
    monthlyCredits: 2_000_000,
    imagesLimit: 1000,
  },
} as const

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const session = await auth()
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const adminEmail = session.user.email || 'unknown'
    const adminIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    const body: TierOverrideRequest = await request.json()
    const { userId, newTier, reason, resetUsage = false, grantCredits = 0 } = body

    // Validate inputs
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!newTier || !['FREE', 'JIVE', 'JIGGA'].includes(newTier)) {
      return NextResponse.json(
        { error: 'newTier must be FREE, JIVE, or JIGGA' },
        { status: 400 }
      )
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'reason is required and must be at least 10 characters for audit trail' },
        { status: 400 }
      )
    }

    const config = TIER_CONFIG[newTier]

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get current user and subscription state
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { Subscription: true },
      })

      if (!user) {
        throw new Error('User not found')
      }

      const oldTier = user.Subscription?.tier || 'FREE'
      const oldStatus = user.Subscription?.status || 'none'

      // Update or create subscription
      const subscription = user.Subscription
        ? await tx.subscription.update({
            where: { userId },
            data: {
              tier: newTier,
              status: 'active',
              monthlyCredits: config.monthlyCredits,
              imagesLimit: config.imagesLimit,
              ...(resetUsage ? {
                creditsUsed: 0,
                imagesUsed: 0,
                lastReset: new Date(),
              } : {}),
              updatedAt: new Date(),
            },
          })
        : await tx.subscription.create({
            data: {
              userId,
              tier: newTier,
              status: 'active',
              monthlyCredits: config.monthlyCredits,
              imagesLimit: config.imagesLimit,
              startedAt: new Date(),
            },
          })

      // Reset user-level usage if requested
      const userUpdateData: Record<string, unknown> = {}
      
      if (resetUsage) {
        userUpdateData.usageChatTokens = 0
        userUpdateData.usageImages = 0
        userUpdateData.usageImageEdits = 0
        userUpdateData.usageUpscales = 0
        userUpdateData.usageVideoSeconds = 0
        userUpdateData.usageGoggaTalkMins = 0
        userUpdateData.usageResetDate = new Date()
      }

      // Grant credits if specified
      if (grantCredits > 0) {
        userUpdateData.creditBalance = { increment: grantCredits }
      }

      // Update user if needed
      const updatedUser = Object.keys(userUpdateData).length > 0
        ? await tx.user.update({
            where: { id: userId },
            data: userUpdateData as Parameters<typeof tx.user.update>[0]['data'],
          })
        : user

      // Create subscription event for audit trail
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          userId,
          event: 'admin_override',
          fromTier: oldTier,
          toTier: newTier,
          fromStatus: oldStatus,
          toStatus: 'active',
          actor: adminEmail,
          meta: JSON.stringify({
            reason: reason.trim(),
            resetUsage,
            grantCredits,
            adminIp,
          }),
        },
      })

      // Create credit adjustment record if credits were granted
      if (grantCredits > 0) {
        await tx.creditAdjustment.create({
          data: {
            userId,
            amount: grantCredits,
            balanceBefore: user.creditBalance,
            balanceAfter: user.creditBalance + grantCredits,
            adjustmentType: 'tier_change',
            reason: `Tier change to ${newTier}: ${reason.trim()}`,
            adminEmail,
            adminIp,
            referenceType: 'subscription',
            referenceId: subscription.id,
          },
        })
      }

      // Log to AdminLog
      await tx.adminLog.create({
        data: {
          adminEmail,
          action: 'tier_override',
          targetUser: user.email,
          targetId: subscription.id,
          meta: JSON.stringify({
            fromTier: oldTier,
            toTier: newTier,
            resetUsage,
            grantCredits,
            reason: reason.trim(),
          }),
          ip: adminIp,
        },
      })

      return { user: updatedUser, subscription, oldTier }
    })

    return NextResponse.json({
      success: true,
      override: {
        userId: result.user.id,
        userEmail: result.user.email,
        fromTier: result.oldTier,
        toTier: newTier,
        resetUsage,
        grantCredits,
        reason: reason.trim(),
        adminEmail,
        subscription: {
          id: result.subscription.id,
          tier: result.subscription.tier,
          status: result.subscription.status,
          monthlyCredits: result.subscription.monthlyCredits,
          imagesLimit: result.subscription.imagesLimit,
        },
      },
    })
  } catch (error) {
    console.error('[tier-override] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
