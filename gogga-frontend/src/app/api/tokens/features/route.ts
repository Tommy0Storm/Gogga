/**
 * GOGGA Frontend - Feature Costs API
 * GET: List all feature costs for backend consumption
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const features = await prisma.featureCost.findMany({
      where: { isBillable: true },
      orderBy: { displayName: 'asc' },
    });

    return NextResponse.json({ features });
  } catch (error) {
    console.error('Failed to fetch feature costs:', error);
    return NextResponse.json({ features: [] });
  }
}
