/**
 * GOGGA Internal API - Recent Usage Records
 * GET: Fetch usage records from the past N hours for reconciliation
 * 
 * Protected by internal API key - not for public use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key-change-in-production';

export async function GET(request: NextRequest) {
  // Verify internal API key
  const apiKey = request.headers.get('X-Internal-Key');
  if (apiKey !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    
    // Default to past hour if no cutoff provided
    const cutoff = since 
      ? new Date(since) 
      : new Date(Date.now() - 60 * 60 * 1000);

    const records = await prisma.usage.findMany({
      where: {
        createdAt: { gte: cutoff },
      },
      select: {
        id: true,
        userId: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costCents: true,
        model: true,
        provider: true,
        tier: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to prevent huge responses
    });

    return NextResponse.json({ 
      records,
      count: records.length,
      since: cutoff.toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch recent usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage records' },
      { status: 500 }
    );
  }
}
