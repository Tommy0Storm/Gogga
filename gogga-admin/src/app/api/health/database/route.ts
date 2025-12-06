import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Try a simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'online',
      type: 'sqlite',
      message: 'Database connection successful',
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return NextResponse.json(
      {
        status: 'offline',
        type: 'sqlite',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
