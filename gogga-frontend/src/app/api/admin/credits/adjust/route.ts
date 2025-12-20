/**
 * GOGGA - Admin Credit Adjustment API
 * 
 * POST /api/admin/credits/adjust
 * 
 * Allows admins to manually adjust user credits with full audit trail.
 * All adjustments are logged with reason, admin email, and IP address.
 * 
 * Requires admin session authentication.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

interface AdjustmentRequest {
  userId: string;
  amount: number;          // Positive to grant, negative to deduct
  reason: string;          // Required - audit trail
  adjustmentType?: string; // admin_grant, admin_deduct, system_refund
}

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

    const body: AdjustmentRequest = await request.json()
    const { userId, amount, reason, adjustmentType } = body

    // Validate inputs
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount === 0) {
      return NextResponse.json(
        { error: 'amount must be a non-zero number' },
        { status: 400 }
      )
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'reason is required and must be at least 10 characters for audit trail' },
        { status: 400 }
      )
    }

    // Determine adjustment type
    const finalAdjustmentType = adjustmentType || (amount > 0 ? 'admin_grant' : 'admin_deduct')

    // Atomic transaction: update balance + create audit record
    const result = await prisma.$transaction(async (tx) => {
      // Get current user state
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { 
          id: true,
          email: true,
          creditBalance: true,
        },
      })

      if (!user) {
        throw new Error('User not found')
      }

      const balanceBefore = user.creditBalance
      const balanceAfter = balanceBefore + amount

      // Update user credit balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: balanceAfter,
        },
        select: {
          id: true,
          email: true,
          creditBalance: true,
        },
      })

      // Create audit record
      const adjustment = await tx.creditAdjustment.create({
        data: {
          userId,
          amount,
          balanceBefore,
          balanceAfter,
          adjustmentType: finalAdjustmentType,
          reason: reason.trim(),
          adminEmail,
          adminIp,
        },
      })

      // Also log to AdminLog for unified audit trail
      await tx.adminLog.create({
        data: {
          adminEmail,
          action: finalAdjustmentType,
          targetUser: user.email,
          targetId: adjustment.id,
          meta: JSON.stringify({
            amount,
            balanceBefore,
            balanceAfter,
            reason: reason.trim(),
          }),
          ip: adminIp,
        },
      })

      return { user: updatedUser, adjustment }
    })

    return NextResponse.json({
      success: true,
      adjustment: {
        id: result.adjustment.id,
        userId: result.user.id,
        userEmail: result.user.email,
        amount,
        balanceBefore: result.adjustment.balanceBefore,
        balanceAfter: result.adjustment.balanceAfter,
        adjustmentType: finalAdjustmentType,
        reason: reason.trim(),
        adminEmail,
        createdAt: result.adjustment.createdAt,
      },
    })
  } catch (error) {
    console.error('[credit-adjust] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List credit adjustments for a user
export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const session = await auth()
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where = userId ? { userId } : {}

    const adjustments = await prisma.creditAdjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        user: {
          select: { email: true },
        },
      },
    })

    return NextResponse.json({
      adjustments: adjustments.map(adj => ({
        ...adj,
        userEmail: adj.user.email,
        user: undefined,
      })),
      total: adjustments.length,
    })
  } catch (error) {
    console.error('[credit-adjust] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
