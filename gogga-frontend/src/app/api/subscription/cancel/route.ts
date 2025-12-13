/**
 * GOGGA - Subscription Cancellation API
 * 
 * POST /api/subscription/cancel
 * 
 * Cancels the user's subscription:
 * 1. Calls PayFast API to stop recurring billing
 * 2. Updates database status to 'cancelled'
 * 3. User keeps access until nextBilling date (grace period)
 * 
 * CRITICAL: Must call PayFast API - just flipping DB status doesn't stop billing!
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user with subscription
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
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

    if (!user.subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      )
    }

    const { subscription } = user

    // Check if already cancelled
    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      return NextResponse.json(
        { error: 'Subscription is already cancelled' },
        { status: 400 }
      )
    }

    // Check if we have a PayFast token
    if (!subscription.payfastToken) {
      // No token means no recurring billing set up - just cancel in DB
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'cancelled',
        },
      })

      await prisma.authLog.create({
        data: {
          email: session.user.email,
          action: 'subscription_cancelled_no_token',
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Subscription cancelled',
        accessUntil: subscription.nextBilling,
      })
    }

    // Call PayFast API via backend to cancel recurring billing
    try {
      const cancelResponse = await fetch(
        `${BACKEND_URL}/api/v1/payments/cancel/${subscription.payfastToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!cancelResponse.ok) {
        const errorData = await cancelResponse.json().catch(() => ({}))
        console.error('PayFast cancellation failed:', errorData)
        
        // Even if PayFast fails, update our DB (user requested cancel)
        // They may need to contact PayFast directly
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'cancelled',
          },
        })

        await prisma.authLog.create({
          data: {
            email: session.user.email,
            action: 'subscription_cancelled_payfast_failed',
            ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
            meta: JSON.stringify({ error: errorData }),
          },
        })

        return NextResponse.json({
          success: true,
          warning: 'Subscription marked as cancelled, but PayFast API returned an error. Please contact support if you continue to be charged.',
          accessUntil: subscription.nextBilling,
        })
      }

      // PayFast cancellation successful - update DB
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'cancelled',
        },
      })

      await prisma.authLog.create({
        data: {
          email: session.user.email,
          action: 'subscription_cancelled',
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
          meta: JSON.stringify({ tier: subscription.tier }),
        },
      })

      // TODO: Send subscription_cancelled email

      return NextResponse.json({
        success: true,
        message: 'Subscription cancelled successfully',
        accessUntil: subscription.nextBilling,
        tier: subscription.tier,
      })

    } catch (fetchError) {
      console.error('Error calling backend cancel API:', fetchError)
      
      // Network error - still cancel in DB but warn user
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'cancelled',
        },
      })

      await prisma.authLog.create({
        data: {
          email: session.user.email,
          action: 'subscription_cancelled_network_error',
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
          meta: JSON.stringify({ error: String(fetchError) }),
        },
      })

      return NextResponse.json({
        success: true,
        warning: 'Subscription marked as cancelled, but could not reach payment provider. Please verify cancellation in your PayFast account.',
        accessUntil: subscription.nextBilling,
      })
    }

  } catch (error) {
    console.error('Subscription cancel error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
