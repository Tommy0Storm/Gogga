import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/vouchers/[id] - Hard delete a voucher
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  try {
    // Find voucher
    const voucher = await prisma.voucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    if (voucher.redeemed) {
      return NextResponse.json(
        { error: 'Cannot delete a redeemed voucher' },
        { status: 400 }
      );
    }

    // Log before delete
    await prisma.voucherLog.create({
      data: {
        voucherId: id,
        action: 'deleted',
        actor: 'admin@vcb-ai.online',
        meta: JSON.stringify({ code: voucher.code, type: voucher.type }),
      },
    });

    // Delete the voucher
    await prisma.voucher.delete({
      where: { id },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminEmail: 'admin@vcb-ai.online',
        action: 'voucher_deleted',
        meta: JSON.stringify({ code: voucher.code, type: voucher.type }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete voucher:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
