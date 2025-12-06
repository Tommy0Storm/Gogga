import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Get database schema information
 */
export async function GET() {
  try {
    // Get all tables
    const tables = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
      ORDER BY name
    `;

    const schema: {
      name: string;
      columns: { name: string; type: string; notnull: number; pk: number }[];
      indexes: { name: string; unique: number; columns: string }[];
      rowCount: number;
    }[] = [];

    for (const table of tables) {
      // Get columns - convert all numeric fields from BigInt
      const columnsRaw = await prisma.$queryRawUnsafe<
        { name: string; type: string; notnull: bigint; pk: bigint }[]
      >(`PRAGMA table_info("${table.name}")`);
      
      const columns = columnsRaw.map(col => ({
        name: col.name,
        type: col.type,
        notnull: Number(col.notnull),
        pk: Number(col.pk),
      }));

      // Get indexes - convert BigInt to number
      const indexesRaw = await prisma.$queryRawUnsafe<
        { name: string; unique: bigint }[]
      >(`PRAGMA index_list("${table.name}")`);

      // Get index columns
      const indexDetails = await Promise.all(
        indexesRaw.map(async (idx) => {
          const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(
            `PRAGMA index_info("${idx.name}")`
          );
          return {
            name: idx.name,
            unique: Number(idx.unique),
            columns: cols.map((c) => c.name).join(', '),
          };
        })
      );

      // Get row count
      const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM "${table.name}"`
      );
      const rowCount = Number(countResult[0]?.count || 0);

      schema.push({
        name: table.name,
        columns,
        indexes: indexDetails,
        rowCount,
      });
    }

    // Get database stats
    const dbStats = await prisma.$queryRaw<{ page_count: bigint }[]>`
      PRAGMA page_count
    `;
    const pageSize = await prisma.$queryRaw<{ page_size: bigint }[]>`
      PRAGMA page_size
    `;

    const totalPages = Number(dbStats[0]?.page_count || 0);
    const pageSizeBytes = Number(pageSize[0]?.page_size || 4096);
    const totalSize = totalPages * pageSizeBytes;

    return NextResponse.json({
      tables: schema,
      stats: {
        tableCount: schema.length,
        totalRows: schema.reduce((sum, t) => sum + t.rowCount, 0),
        totalPages,
        pageSize: pageSizeBytes,
        estimatedSize: totalSize,
        estimatedSizeFormatted: formatBytes(totalSize),
      },
    });
  } catch (error) {
    console.error('Schema fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch schema' },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
