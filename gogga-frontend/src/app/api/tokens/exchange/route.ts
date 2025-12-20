/**
 * GOGGA Frontend - Exchange Rates API
 * GET: List all exchange rates for backend consumption
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Exchange rates don't have isActive - return all
    const rates = await prisma.exchangeRate.findMany({
      orderBy: [{ fromCurrency: 'asc' }, { toCurrency: 'asc' }],
    });

    return NextResponse.json({ rates });
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    return NextResponse.json({ rates: [] });
  }
}
