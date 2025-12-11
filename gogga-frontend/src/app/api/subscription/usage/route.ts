/**
 * GOGGA - Subscription Usage API Route
 * 
 * POST /api/subscription/usage
 * 
 * Reports token/image usage and deducts from user's credits.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { tokensUsed = 0, imageGenerated = false } = body

    // Get user with subscription
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true },
    })

    if (!user || !user.subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      )
    }

    const subscription = user.subscription

    // FREE tier doesn't track usage
    if (subscription.tier === 'FREE') {
      return NextResponse.json({ success: true, tier: 'FREE' })
    }

    // Calculate credits to deduct (1 credit per token for simplicity)
    const creditsToDeduct = tokensUsed

    // Update subscription
    const updates: Record<string, unknown> = {
      creditsUsed: { increment: creditsToDeduct },
    }

    if (imageGenerated) {
      updates.imagesUsed = { increment: 1 }
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: updates,
    })

    // Check if user is now out of credits
    const totalCredits = updated.credits + updated.monthlyCredits
    const remainingCredits = totalCredits - updated.creditsUsed

    // Log usage for analytics
    await prisma.authLog.create({
      data: {
        email: session.user.email,
        action: 'usage_reported',
        meta: JSON.stringify({
          tokensUsed,
          imageGenerated,
          remainingCredits,
          tier: subscription.tier,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      tier: subscription.tier,
      credits: {
        used: updated.creditsUsed,
        remaining: remainingCredits,
      },
      images: {
        used: updated.imagesUsed,
        limit: updated.imagesLimit,
      },
      outOfCredits: remainingCredits <= 0,
    })

  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
