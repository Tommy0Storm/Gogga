/**
 * GOGGA Frontend - Token Models Pricing API
 * GET: List all model pricing for backend consumption
 * 
 * Note: This is a public read-only endpoint for the backend to fetch pricing.
 * Write operations are in the admin panel only.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const models = await prisma.modelPricing.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Failed to fetch model pricing:', error);
    // Return empty array if table doesn't exist or error occurs
    return NextResponse.json({ models: [] });
  }
}
