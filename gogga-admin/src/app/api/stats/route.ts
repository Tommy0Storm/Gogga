import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Count total users
    const totalUsers = await prisma.user.count();
    
    // Count active subscriptions (active, not FREE tier)
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: 'active',
        tier: {
          not: 'FREE',
        },
      },
    });
    
    // Count active vouchers (not voided, not redeemed, not expired)
    let pendingVouchers = 0;
    try {
      pendingVouchers = await prisma.voucher.count({
        where: {
          voided: false,
          redeemed: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });
    } catch {
      // Voucher table might not exist yet
      pendingVouchers = 0;
    }
    
    // Count recent auth errors (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrors = await prisma.authLog.count({
      where: {
        action: 'login_failed',
        createdAt: {
          gt: oneDayAgo,
        },
      },
    });
    
    return NextResponse.json({
      totalUsers,
      activeSubscriptions,
      pendingVouchers,
      recentErrors,
    });
  } catch (error) {
    console.error('Failed to load stats:', error);
    return NextResponse.json(
      {
        totalUsers: 0,
        activeSubscriptions: 0,
        pendingVouchers: 0,
        recentErrors: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
