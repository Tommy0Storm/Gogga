import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Run SQLite tools and diagnostics using Prisma queries (no external binaries needed)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tool = searchParams.get('tool') || 'analyzer';

    if (tool === 'integrity') {
      // Run integrity check via Prisma raw query
      const result = await prisma.$queryRaw<{ integrity_check: string }[]>`
        PRAGMA integrity_check
      `;
      
      const checkResult = result[0]?.integrity_check || 'unknown';
      const isOk = checkResult === 'ok';

      return NextResponse.json({
        tool: 'integrity_check',
        status: isOk ? 'healthy' : 'issues_found',
        result: checkResult,
        timestamp: new Date().toISOString(),
      });
    }

    if (tool === 'analyzer') {
      // Get comprehensive database stats via PRAGMA queries
      const pageCount = await prisma.$queryRaw<{ page_count: bigint }[]>`PRAGMA page_count`;
      const pageSize = await prisma.$queryRaw<{ page_size: bigint }[]>`PRAGMA page_size`;
      const freelistCount = await prisma.$queryRaw<{ freelist_count: bigint }[]>`PRAGMA freelist_count`;
      const journalMode = await prisma.$queryRaw<{ journal_mode: string }[]>`PRAGMA journal_mode`;
      const autoVacuum = await prisma.$queryRaw<{ auto_vacuum: bigint }[]>`PRAGMA auto_vacuum`;
      
      // Get table stats
      const tables = await prisma.$queryRaw<{ name: string }[]>`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
        ORDER BY name
      `;

      const tableStats: { name: string; rowCount: number; }[] = [];
      for (const table of tables) {
        const count = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT COUNT(*) as count FROM "${table.name}"`
        );
        tableStats.push({
          name: table.name,
          rowCount: Number(count[0]?.count || 0),
        });
      }

      const pages = Number(pageCount[0]?.page_count || 0);
      const size = Number(pageSize[0]?.page_size || 4096);
      const freelist = Number(freelistCount[0]?.freelist_count || 0);
      const totalSize = pages * size;
      const usedSize = (pages - freelist) * size;
      const fragmentation = pages > 0 ? ((freelist / pages) * 100).toFixed(2) : '0.00';

      return NextResponse.json({
        tool: 'sqlite3_analyzer',
        analysis: {
          database_size: totalSize,
          database_size_formatted: formatBytes(totalSize),
          used_size: usedSize,
          used_size_formatted: formatBytes(usedSize),
          page_size: size,
          page_count: pages,
          freelist_count: freelist,
          fragmentation_percent: fragmentation,
          journal_mode: journalMode[0]?.journal_mode || 'unknown',
          auto_vacuum: autoVacuum[0]?.auto_vacuum || 0,
          table_count: tableStats.length,
          total_rows: tableStats.reduce((sum, t) => sum + t.rowCount, 0),
          tables: tableStats,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (tool === 'stats') {
      // Get various PRAGMA stats
      const pragmas = [
        'page_count',
        'page_size',
        'freelist_count',
        'journal_mode',
        'auto_vacuum',
        'cache_size',
        'busy_timeout',
        'encoding',
        'foreign_keys',
        'wal_autocheckpoint',
      ];

      const stats: Record<string, string | number> = {};

      for (const pragma of pragmas) {
        try {
          const result = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
            `PRAGMA ${pragma}`
          );
          if (result[0]) {
            const value = Object.values(result[0])[0];
            stats[pragma] = typeof value === 'bigint' ? Number(value) : String(value);
          }
        } catch {
          // Skip failed pragmas
        }
      }

      return NextResponse.json({
        tool: 'stats',
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Invalid tool specified. Use: integrity, analyzer, or stats' }, { status: 400 });
  } catch (error) {
    console.error('Tools error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Tool execution failed' },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
