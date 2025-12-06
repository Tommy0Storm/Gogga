import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch recent vouchers redeemed by this user
    let recentVouchers: { code: string; type: string; redeemedAt: Date | null }[] = [];
    try {
      recentVouchers = await prisma.voucher.findMany({
        where: { redeemedBy: email },
        select: {
          code: true,
          type: true,
          redeemedAt: true,
        },
        orderBy: { redeemedAt: 'desc' },
        take: 10,
      });
    } catch {
      // Voucher table might not exist
    }

    // Fetch recent auth logs
    const recentAuth = await prisma.authLog.findMany({
      where: { email },
      select: {
        action: true,
        ip: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      isAdmin: (user as { isAdmin?: boolean }).isAdmin || false,
      subscription: user.subscription
        ? {
            tier: user.subscription.tier,
            status: user.subscription.status,
            credits: user.subscription.credits,
            creditsUsed: user.subscription.creditsUsed,
            monthlyCredits: user.subscription.monthlyCredits,
            imagesUsed: user.subscription.imagesUsed,
            imagesLimit: user.subscription.imagesLimit,
            startedAt: user.subscription.startedAt?.toISOString() || null,
            nextBilling: user.subscription.nextBilling?.toISOString() || null,
            payfastToken: user.subscription.payfastToken,
          }
        : null,
      recentVouchers: recentVouchers.map((v) => ({
        code: v.code,
        type: v.type,
        redeemedAt: v.redeemedAt?.toISOString() || '',
      })),
      recentAuth: recentAuth.map((a) => ({
        action: a.action,
        ip: a.ip,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('User lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
