/**
 * GOGGA - Internal Subscription Activation API
 * 
 * POST /api/internal/subscription-activate
 * 
 * Development/testing endpoint to manually activate subscriptions
 * when PayFast ITN can't reach the local development environment.
 * 
 * Requires INTERNAL_API_KEY authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Check for admin session OR internal API key
    const session = await auth()
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY || 'dev-internal-key-change-in-production'
    
    const isAdmin = session?.user?.isAdmin === true
    const isInternalCall = authHeader === `Bearer ${expectedKey}`
    
    if (!isAdmin && !isInternalCall) {
      return NextResponse.json(
        { error: 'Unauthorized - admin or internal API key required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, tier, credits } = body

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const normalizedTier = (tier || 'JIVE').toUpperCase()
    if (!['FREE', 'JIVE', 'JIGGA'].includes(normalizedTier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Tier configuration
    const tierConfig = {
      FREE: { monthlyCredits: 0, imagesLimit: 50 },
      JIVE: { monthlyCredits: 500000, imagesLimit: 200 },
      JIGGA: { monthlyCredits: 2000000, imagesLimit: 1000 },
    }
    const config = tierConfig[normalizedTier as keyof typeof tierConfig]

    // Calculate next billing date (1 month from now)
    const nextBilling = new Date()
    nextBilling.setMonth(nextBilling.getMonth() + 1)

    // Upsert subscription
    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        tier: normalizedTier,
        status: 'active',
        startedAt: new Date(),
        nextBilling,
        monthlyCredits: config.monthlyCredits,
        imagesLimit: config.imagesLimit,
        imagesUsed: 0,
        creditsUsed: 0,
        lastReset: new Date(),
        ...(credits ? { credits: { increment: credits } } : {}),
      },
      create: {
        userId: user.id,
        tier: normalizedTier,
        status: 'active',
        startedAt: new Date(),
        nextBilling,
        credits: credits || 0,
        creditsUsed: 0,
        monthlyCredits: config.monthlyCredits,
        imagesLimit: config.imagesLimit,
        imagesUsed: 0,
        lastReset: new Date(),
      },
    })

    // Log the activation
    await prisma.authLog.create({
      data: {
        email: email.toLowerCase(),
        action: 'subscription_manual_activation',
        meta: JSON.stringify({ 
          tier: normalizedTier, 
          credits,
          activatedBy: session?.user?.email || 'internal-api' 
        }),
      },
    })

    console.log(`Manual subscription activation: ${email} → ${normalizedTier}`)

    return NextResponse.json({
      success: true,
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        monthlyCredits: subscription.monthlyCredits,
        imagesLimit: subscription.imagesLimit,
        nextBilling: subscription.nextBilling,
      },
    })

  } catch (error) {
    console.error('Subscription activation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    endpoint: 'subscription-activate',
    note: 'POST with { email, tier } to activate subscription (admin only)'
  })
}
