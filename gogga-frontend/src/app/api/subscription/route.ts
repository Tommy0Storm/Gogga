/**
 * GOGGA - Subscription API Route
 * 
 * GET /api/subscription
 * 
 * Returns current user's subscription details including tier, credits, and usage.
 * 
 * Supports two auth modes:
 * 1. Session-based (for frontend): Uses NextAuth session
 * 2. Internal API key (for backend): Uses Authorization header with INTERNAL_API_KEY + email param
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    let userEmail: string | null = null

    // Check for internal API key (backend-to-frontend verification)
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY || 'dev-internal-key-change-in-production'
    
    if (authHeader === `Bearer ${expectedKey}`) {
      // Internal API call - get email from query param
      userEmail = request.nextUrl.searchParams.get('email')
      if (!userEmail) {
        return NextResponse.json(
          { error: 'Email parameter required for internal API' },
          { status: 400 }
        )
      }
    } else {
      // Session-based auth (frontend)
      const session = await auth()
      userEmail = session?.user?.email || null
    }
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user with subscription
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        subscription: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Default FREE tier values
    const defaultSubscription = {
      tier: 'FREE',
      status: 'active',
      credits: 0,
      creditsUsed: 0,
      monthlyCredits: 0,
      imagesUsed: 0,
      imagesLimit: 0,
      nextBilling: null as Date | null,
      payfastToken: null as string | null,
    }

    const subscription = user.subscription || defaultSubscription

    // Calculate available credits
    const totalCredits = (subscription.credits || 0) + (subscription.monthlyCredits || 0)
    const usedCredits = subscription.creditsUsed || 0
    const availableCredits = totalCredits - usedCredits

    return NextResponse.json({
      email: user.email,
      tier: subscription.tier || 'FREE',
      status: subscription.status || 'active',
      credits: {
        total: totalCredits,
        used: usedCredits,
        available: availableCredits,
        purchased: subscription.credits || 0,
        monthly: subscription.monthlyCredits || 0,
      },
      images: {
        used: subscription.imagesUsed || 0,
        limit: subscription.imagesLimit || 0,
      },
      nextBilling: 'nextBilling' in subscription ? subscription.nextBilling : null,
      payfastToken: ('payfastToken' in subscription && subscription.payfastToken) ? true : false,
    })

  } catch (error) {
    console.error('Subscription API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
