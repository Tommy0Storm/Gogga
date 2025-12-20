/**
 * GOGGA - Internal Deduct Usage API (Enterprise Grade)
 * 
 * POST /api/internal/deduct-usage
 * 
 * Deducts usage from subscription limits or credit balance.
 * Called by backend after an action completes with actual token counts.
 * 
 * Enterprise Features:
 * - Idempotency key prevents double-billing
 * - Atomic transactions for credit deductions
 * - Full audit trail via UsageEvent model
 * 
 * Requires INTERNAL_API_KEY authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type ActionType = 
  | 'chat_10k_tokens'
  | 'image_create'
  | 'image_edit'
  | 'upscale'
  | 'video_second'
  | 'gogga_talk_min';

type DeductionSource = 'subscription' | 'credits' | 'free';

interface DeductRequest {
  userId: string;
  action: ActionType;
  quantity: number;
  source: DeductionSource;
  idempotencyKey?: string;  // Unique key to prevent double-billing
  requestId?: string;       // Original request ID for tracing
  model?: string;           // AI model used
  provider?: string;        // Provider name
  tier?: string;            // User's tier
  durationMs?: number;      // Request duration
}

// Credit costs per action
const CREDIT_COSTS: Record<ActionType, number> = {
  chat_10k_tokens: 1,
  image_create: 1,
  image_edit: 1,
  upscale: 1,
  video_second: 2,
  gogga_talk_min: 1,
};

export async function POST(request: NextRequest) {
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

    const body: DeductRequest = await request.json()
    const { 
      userId, 
      action, 
      quantity, 
      source,
      idempotencyKey,
      requestId,
      model,
      provider,
      tier,
      durationMs,
    } = body

    if (!userId || !action || !quantity || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, action, quantity, source' },
        { status: 400 }
      )
    }

    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotencyKey || 
      `${action}:${userId}:${Date.now()}:${requestId || Math.random().toString(36)}`

    // Check for duplicate (idempotency)
    const existingEvent = await prisma.usageEvent.findUnique({
      where: { idempotencyKey: finalIdempotencyKey },
    })

    if (existingEvent) {
      // Already processed - return success (idempotent)
      console.log(`[deduct-usage] Duplicate request detected: ${finalIdempotencyKey}`)
      return NextResponse.json({
        success: true,
        duplicate: true,
        eventId: existingEvent.id,
        message: 'Request already processed (idempotent)',
      })
    }

    // Calculate credits to deduct
    const creditsToDeduct = source === 'credits' 
      ? CREDIT_COSTS[action] * quantity 
      : 0

    // Atomic transaction: create event + update user
    const result = await prisma.$transaction(async (tx) => {
      // Get current user state for audit
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { 
          creditBalance: true,
          usageChatTokens: true,
          usageImages: true,
          usageImageEdits: true,
          usageUpscales: true,
          usageVideoSeconds: true,
          usageGoggaTalkMins: true,
        },
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Build update based on source
      const updateData: Record<string, unknown> = {}
      
      if (source === 'subscription') {
        // Increment usage counters
        switch (action) {
          case 'chat_10k_tokens':
            updateData.usageChatTokens = { increment: quantity * 10_000 }
            break
          case 'image_create':
            updateData.usageImages = { increment: quantity }
            break
          case 'image_edit':
            updateData.usageImageEdits = { increment: quantity }
            break
          case 'upscale':
            updateData.usageUpscales = { increment: quantity }
            break
          case 'video_second':
            updateData.usageVideoSeconds = { increment: quantity }
            break
          case 'gogga_talk_min':
            updateData.usageGoggaTalkMins = { increment: quantity }
            break
        }
      } else if (source === 'credits') {
        // Deduct from credit balance
        updateData.creditBalance = { decrement: creditsToDeduct }
      }
      // 'free' source = no deduction

      // Update user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData as Parameters<typeof tx.user.update>[0]['data'],
        select: {
          creditBalance: true,
          usageChatTokens: true,
          usageImages: true,
          usageImageEdits: true,
          usageUpscales: true,
          usageVideoSeconds: true,
          usageGoggaTalkMins: true,
        },
      })

      // Create usage event for audit trail
      const usageEvent = await tx.usageEvent.create({
        data: {
          userId,
          idempotencyKey: finalIdempotencyKey,
          actionType: action,
          quantity,
          source,
          creditsDeducted: creditsToDeduct,
          model: model || null,
          provider: provider || null,
          tier: tier || 'FREE',
          requestId: requestId || null,
          durationMs: durationMs || null,
          status: 'completed',
        },
      })

      return { user: updatedUser, event: usageEvent }
    })

    return NextResponse.json({
      success: true,
      duplicate: false,
      eventId: result.event.id,
      action,
      quantity,
      source,
      creditsDeducted: creditsToDeduct,
      newState: result.user,
    })
  } catch (error) {
    console.error('[deduct-usage] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
