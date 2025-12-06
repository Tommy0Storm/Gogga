import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    // Run SQLite VACUUM command
    await prisma.$executeRaw`VACUUM`;

    // Log admin action
    try {
      await prisma.adminLog.create({
        data: {
          adminEmail: 'admin@vcb-ai.online',
          action: 'database_vacuum',
          meta: JSON.stringify({ timestamp: new Date().toISOString() }),
        },
      });
    } catch {
      // AdminLog table might not exist
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vacuum failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
