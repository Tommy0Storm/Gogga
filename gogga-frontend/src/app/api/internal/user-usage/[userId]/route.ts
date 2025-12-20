/**
 * GOGGA - Internal User Usage API
 * 
 * GET /api/internal/user-usage/[userId]
 * 
 * Returns user's current tier and usage state for backend credit checks.
 * Requires INTERNAL_API_KEY authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('x-internal-key')
    const expectedKey = process.env.INTERNAL_API_KEY || 'dev-internal-key-change-in-production'
    
    if (authHeader !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized - internal API key required' },
        { status: 401 }
      )
    }

    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get user with subscription
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Subscription: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine tier from subscription
    const tier = user.Subscription?.tier || 'FREE'

    return NextResponse.json({
      tier,
      creditBalance: user.creditBalance ?? 0,
      usageChatTokens: user.usageChatTokens ?? 0,
      usageImages: user.usageImages ?? 0,
      usageImageEdits: user.usageImageEdits ?? 0,
      usageUpscales: user.usageUpscales ?? 0,
      usageVideoSeconds: user.usageVideoSeconds ?? 0,
      usageGoggaTalkMins: user.usageGoggaTalkMins ?? 0,
      usageResetDate: user.usageResetDate,
    })
  } catch (error) {
    console.error('[user-usage] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
