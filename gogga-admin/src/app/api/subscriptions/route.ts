import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tier = searchParams.get('tier');
  const status = searchParams.get('status');

  try {
    const whereClause: Record<string, unknown> = {};

    if (tier) {
      whereClause.tier = tier;
    }

    if (status) {
      whereClause.status = status;
    }

    const subscriptions = await prisma.subscription.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userEmail: s.user.email,
        tier: s.tier,
        status: s.status,
        credits: s.credits,
        creditsUsed: s.creditsUsed,
        monthlyCredits: s.monthlyCredits,
        imagesUsed: s.imagesUsed,
        imagesLimit: s.imagesLimit,
        startedAt: s.startedAt?.toISOString() || null,
        nextBilling: s.nextBilling?.toISOString() || null,
        lastReset: s.lastReset?.toISOString() || null,
        payfastToken: s.payfastToken ? '••••' + s.payfastToken.slice(-4) : null,
      })),
    });
  } catch (error) {
    console.error('Failed to load subscriptions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
