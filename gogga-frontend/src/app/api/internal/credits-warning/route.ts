/**
 * GOGGA - Internal Credits Warning API
 * 
 * POST /api/internal/credits-warning
 * 
 * Called by backend scheduler to send low-credits warnings.
 * Identifies users with < threshold% credits remaining.
 * 
 * Security: Requires INTERNAL_API_KEY in Authorization header
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Tier credit allocations for percentage calculation
const TIER_CREDITS: Record<string, number> = {
  FREE: 0,
  JIVE: 500_000,
  JIGGA: 2_000_000,
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
    const thresholdPercent = body.threshold_percent || 10

    // Find active subscriptions with low credits
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        tier: { in: ['JIVE', 'JIGGA'] },
      },
      include: { User: true },
    })

    let warningsSent = 0
    const warnings: Array<{ email: string; tier: string; percent: number }> = []

    for (const sub of subscriptions) {
      const totalCredits = sub.credits + sub.monthlyCredits
      const available = totalCredits - sub.creditsUsed
      const maxCredits = TIER_CREDITS[sub.tier] || 1

      // Calculate percentage of monthly allocation remaining
      const percentRemaining = (available / maxCredits) * 100

      if (percentRemaining <= thresholdPercent && percentRemaining > 0) {
        // TODO: Send credits_low email via EmailJS
        console.log(`[Credits Warning] ${sub.User.email}: ${Math.round(percentRemaining)}% remaining`)
        
        warnings.push({
          email: sub.User.email,
          tier: sub.tier,
          percent: Math.round(percentRemaining),
        })
        warningsSent++
      }
    }

    console.log(`[Credits Warning] Complete: ${warningsSent} warnings identified`)

    return NextResponse.json({
      warnings_sent: warningsSent,
      warnings,
    })

  } catch (error) {
    console.error('Credits warning error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    endpoint: 'credits-warning',
    description: 'Internal API for low-credits email notifications'
  })
}
