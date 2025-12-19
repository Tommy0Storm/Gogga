import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Pending Transactions Monitoring API
 * 
 * Returns subscriptions/payments that need attention:
 * - Pending payments (status = 'pending')
 * - Failed payments (status = 'past_due')
 * - Payment retries pending
 * - Subscriptions with payment failures
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'all';

  try {
    // Build status filter
    const statusFilter: string[] = [];
    if (status === 'all') {
      statusFilter.push('pending', 'past_due');
    } else if (status === 'pending') {
      statusFilter.push('pending');
    } else if (status === 'failed') {
      statusFilter.push('past_due');
    }

    // Get subscriptions with payment issues
    const subscriptions = await prisma.subscription.findMany({
      where: {
        OR: [
          { status: { in: statusFilter } },
          { paymentFailedAt: { not: null } },
          { retryCount: { gt: 0 } },
        ],
      },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // pending first
        { paymentFailedAt: 'desc' }, // most recent failures
        { updatedAt: 'desc' },
      ],
    });

    // Get pending credit purchases
    const creditPurchases = await prisma.creditPurchase.findMany({
      where: {
        status: { in: ['pending', 'failed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get processed payments for context (last 24h)
    const recentPayments = await prisma.processedPayment.findMany({
      orderBy: { processedAt: 'desc' },
      take: 20,
    });

    // Calculate stats
    const stats = {
      pendingSubscriptions: subscriptions.filter((s) => s.status === 'pending').length,
      failedPayments: subscriptions.filter((s) => s.status === 'past_due').length,
      retryPending: subscriptions.filter((s) => s.retryCount > 0 && s.status !== 'cancelled').length,
      pendingCredits: creditPurchases.filter((c) => c.status === 'pending').length,
    };

    // Transform data for response
    const transactions = subscriptions.map((s) => ({
      id: s.id,
      type: 'subscription',
      userId: s.userId,
      userEmail: s.User?.email || 'Unknown',
      tier: s.tier,
      status: s.status,
      retryCount: s.retryCount,
      paymentFailedAt: s.paymentFailedAt?.toISOString() || null,
      nextBilling: s.nextBilling?.toISOString() || null,
      hasPayfastToken: !!s.payfastToken,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      // Error details for troubleshooting
      errorDetails: getErrorDetails(s),
    }));

    // Add credit purchases to transactions
    const creditTransactions = creditPurchases.map((c) => ({
      id: c.id,
      type: 'credit_purchase',
      userId: c.userId,
      userEmail: null, // Would need join, but keeping it simple
      packSize: c.packSize,
      credits: c.credits,
      status: c.status,
      pfPaymentId: c.pfPaymentId,
      expiresAt: c.expiresAt?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
      errorDetails: c.status === 'pending' ? 'Awaiting PayFast confirmation' : null,
    }));

    return NextResponse.json({
      stats,
      transactions,
      creditTransactions,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        pfPaymentId: p.pfPaymentId,
        type: p.type,
        amount: p.amount,
        userId: p.userId,
        processedAt: p.processedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to load pending transactions:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to query pending transactions. Check database connection.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Retry failed payment or take action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, subscriptionId, userId, reason } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 });
    }

    switch (action) {
      case 'retry_payment': {
        // Reset retry count and mark for retry
        const updated = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'pending',
            retryCount: 0,
            paymentFailedAt: null,
          },
        });
        
        // Log the action
        await prisma.adminLog.create({
          data: {
            adminEmail: 'system', // Would be from session in real impl
            action: 'retry_payment',
            targetUser: userId,
            targetId: subscriptionId,
            meta: JSON.stringify({ reason: reason || 'Admin triggered retry' }),
          },
        });

        return NextResponse.json({ 
          success: true, 
          message: 'Payment marked for retry',
          subscription: updated,
        });
      }

      case 'cancel_subscription': {
        const cancelled = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'cancelled',
            payfastToken: null,
          },
        });

        await prisma.adminLog.create({
          data: {
            adminEmail: 'system',
            action: 'admin_cancel',
            targetUser: userId,
            targetId: subscriptionId,
            meta: JSON.stringify({ reason: reason || 'Admin cancellation' }),
          },
        });

        return NextResponse.json({ 
          success: true, 
          message: 'Subscription cancelled',
          subscription: cancelled,
        });
      }

      case 'reactivate': {
        const reactivated = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'active',
            retryCount: 0,
            paymentFailedAt: null,
          },
        });

        await prisma.adminLog.create({
          data: {
            adminEmail: 'system',
            action: 'admin_reactivate',
            targetUser: userId,
            targetId: subscriptionId,
            meta: JSON.stringify({ reason: reason || 'Admin reactivation' }),
          },
        });

        return NextResponse.json({ 
          success: true, 
          message: 'Subscription reactivated',
          subscription: reactivated,
        });
      }

      case 'clear_failure': {
        // Just clear the failure flags without changing status
        const cleared = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            paymentFailedAt: null,
            retryCount: 0,
          },
        });

        return NextResponse.json({ 
          success: true, 
          message: 'Failure flags cleared',
          subscription: cleared,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Transaction action failed:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to process transaction action',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper to get error details for troubleshooting
 */
function getErrorDetails(subscription: {
  status: string;
  retryCount: number;
  paymentFailedAt: Date | null;
  payfastToken: string | null;
  nextBilling: Date | null;
}): string | null {
  const issues: string[] = [];

  if (subscription.status === 'pending') {
    issues.push('Awaiting initial payment confirmation from PayFast');
  }

  if (subscription.status === 'past_due') {
    issues.push('Payment failed - subscription past due');
  }

  if (subscription.retryCount > 0) {
    issues.push(`Payment retry attempt ${subscription.retryCount}`);
  }

  if (subscription.paymentFailedAt) {
    const failedDate = new Date(subscription.paymentFailedAt);
    const daysSinceFailed = Math.floor(
      (Date.now() - failedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    issues.push(`Last failure: ${daysSinceFailed} day(s) ago`);
  }

  if (!subscription.payfastToken && subscription.status !== 'pending') {
    issues.push('No PayFast token - cannot auto-retry');
  }

  if (subscription.nextBilling) {
    const nextBillingDate = new Date(subscription.nextBilling);
    if (nextBillingDate < new Date()) {
      const daysOverdue = Math.floor(
        (Date.now() - nextBillingDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      issues.push(`${daysOverdue} day(s) overdue`);
    }
  }

  return issues.length > 0 ? issues.join('. ') : null;
}
