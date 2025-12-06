import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Get database file path from env
    const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
    const dbPath = dbUrl.replace('file:', '').replace(/^\.\.\//, '../');
    
    // Get file size
    let sizeBytes = 0;
    let sizeFormatted = 'Unknown';
    
    try {
      const fullPath = path.resolve(process.cwd(), dbPath);
      const stats = fs.statSync(fullPath);
      sizeBytes = stats.size;
      
      if (sizeBytes < 1024) {
        sizeFormatted = `${sizeBytes} B`;
      } else if (sizeBytes < 1024 * 1024) {
        sizeFormatted = `${(sizeBytes / 1024).toFixed(1)} KB`;
      } else {
        sizeFormatted = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    } catch {
      // File might not be accessible
    }

    // Get table counts
    const tables: { name: string; count: number }[] = [];

    // Core tables
    try {
      tables.push({ name: 'User', count: await prisma.user.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'LoginToken', count: await prisma.loginToken.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'AuthLog', count: await prisma.authLog.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'Subscription', count: await prisma.subscription.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'CreditPurchase', count: await prisma.creditPurchase.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'ProcessedPayment', count: await prisma.processedPayment.count() });
    } catch { /* */ }

    // Admin tables (might not exist yet)
    try {
      tables.push({ name: 'Voucher', count: await prisma.voucher.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'VoucherLog', count: await prisma.voucherLog.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'AdminLog', count: await prisma.adminLog.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'SubscriptionEvent', count: await prisma.subscriptionEvent.count() });
    } catch { /* */ }

    try {
      tables.push({ name: 'RecurringSchedule', count: await prisma.recurringSchedule.count() });
    } catch { /* */ }

    return NextResponse.json({
      type: 'sqlite',
      path: dbPath,
      sizeBytes,
      sizeFormatted,
      tables,
      lastVacuum: null, // Would need to track this separately
    });
  } catch (error) {
    console.error('Failed to get database info:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
