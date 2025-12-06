import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

// Generate a random voucher code
function generateCode(): string {
  return 'GGG-' + randomBytes(4).toString('hex').toUpperCase();
}

// GET /api/vouchers - List vouchers with filter
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filter = searchParams.get('filter') || 'all';

  try {
    let whereClause = {};

    switch (filter) {
      case 'active':
        whereClause = {
          voided: false,
          redeemed: false,
          expiresAt: { gt: new Date() },
        };
        break;
      case 'redeemed':
        whereClause = { redeemed: true };
        break;
      case 'voided':
        whereClause = { voided: true };
        break;
      case 'expired':
        whereClause = {
          voided: false,
          redeemed: false,
          expiresAt: { lt: new Date() },
        };
        break;
    }

    const vouchers = await prisma.voucher.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      vouchers: vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        type: v.type,
        value: v.value,
        createdBy: v.createdBy,
        createdAt: v.createdAt.toISOString(),
        expiresAt: v.expiresAt.toISOString(),
        voided: v.voided,
        voidedAt: v.voidedAt?.toISOString() || null,
        voidedBy: v.voidedBy,
        redeemed: v.redeemed,
        redeemedAt: v.redeemedAt?.toISOString() || null,
        redeemedBy: v.redeemedBy,
        batchId: v.batchId,
      })),
    });
  } catch (error) {
    console.error('Failed to load vouchers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/vouchers - Create vouchers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, count = 1, expiryDays = 30 } = body;

    if (!type) {
      return NextResponse.json({ error: 'Type is required' }, { status: 400 });
    }

    if (count < 1 || count > 100) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Calculate value based on type
    let value = 0;
    if (type === 'R200') value = 50000;
    else if (type === 'R500') value = 150000;
    else if (type === 'R1000') value = 350000;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const batchId = count > 1 ? randomBytes(8).toString('hex') : null;

    // Create vouchers
    const vouchers = [];
    for (let i = 0; i < count; i++) {
      const voucher = await prisma.voucher.create({
        data: {
          code: generateCode(),
          type,
          value,
          createdBy: 'admin@vcb-ai.online', // Should come from session
          expiresAt,
          batchId,
        },
      });
      vouchers.push(voucher);

      // Log creation
      await prisma.voucherLog.create({
        data: {
          voucherId: voucher.id,
          action: 'created',
          actor: 'admin@vcb-ai.online',
          meta: JSON.stringify({ type, expiryDays, batchId }),
        },
      });
    }

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminEmail: 'admin@vcb-ai.online',
        action: 'voucher_create',
        meta: JSON.stringify({ type, count, expiryDays, batchId }),
      },
    });

    return NextResponse.json({
      success: true,
      count: vouchers.length,
      batchId,
      codes: vouchers.map((v) => v.code),
    });
  } catch (error) {
    console.error('Failed to create vouchers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
