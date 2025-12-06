import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/vouchers/[id]/void - Void a voucher
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { reason } = body;

    // Find voucher
    const voucher = await prisma.voucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    if (voucher.redeemed) {
      return NextResponse.json(
        { error: 'Cannot void a redeemed voucher' },
        { status: 400 }
      );
    }

    if (voucher.voided) {
      return NextResponse.json(
        { error: 'Voucher is already voided' },
        { status: 400 }
      );
    }

    // Void the voucher
    await prisma.voucher.update({
      where: { id },
      data: {
        voided: true,
        voidedAt: new Date(),
        voidedBy: 'admin@vcb-ai.online', // Should come from session
        voidReason: reason,
      },
    });

    // Log action
    await prisma.voucherLog.create({
      data: {
        voucherId: id,
        action: 'voided',
        actor: 'admin@vcb-ai.online',
        meta: JSON.stringify({ reason }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to void voucher:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
