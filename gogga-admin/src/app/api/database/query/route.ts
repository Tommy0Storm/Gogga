import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Execute raw SQL query on the database
 * WARNING: This is a powerful admin tool - use with caution!
 */
export async function POST(request: NextRequest) {
  try {
    const { query, readOnly = true } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Basic safety checks
    const queryLower = query.toLowerCase().trim();
    const dangerousKeywords = ['drop database', 'drop schema', 'truncate database'];
    
    for (const keyword of dangerousKeywords) {
      if (queryLower.includes(keyword)) {
        return NextResponse.json(
          { error: `Dangerous operation blocked: ${keyword}` },
          { status: 403 }
        );
      }
    }

    // Check if it's a read-only query
    const isReadQuery = queryLower.startsWith('select') || 
                        queryLower.startsWith('pragma') ||
                        queryLower.startsWith('explain');

    if (readOnly && !isReadQuery) {
      return NextResponse.json(
        { error: 'Only SELECT, PRAGMA, and EXPLAIN queries allowed in read-only mode' },
        { status: 403 }
      );
    }

    const startTime = Date.now();

    // Execute the query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    
    if (isReadQuery) {
      result = await prisma.$queryRawUnsafe(query);
    } else {
      result = await prisma.$executeRawUnsafe(query);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      query,
      result: isReadQuery ? result : { affectedRows: result },
      rowCount: Array.isArray(result) ? result.length : (typeof result === 'number' ? result : 0),
      duration: `${duration}ms`,
      isReadQuery,
    });
  } catch (error) {
    console.error('Query execution error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Query execution failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
