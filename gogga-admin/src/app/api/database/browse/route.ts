import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Browse table data with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const orderBy = searchParams.get('orderBy') || 'id';
    const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
    const search = searchParams.get('search');

    if (!table) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 });
    }

    // Validate table name (prevent SQL injection)
    const validTables = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `;
    const tableNames = validTables.map((t) => t.name);

    if (!tableNames.includes(table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    // Get columns to validate orderBy
    const columns = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("${table}")`
    );
    const columnNames = columns.map((c) => c.name);

    const safeOrderBy = columnNames.includes(orderBy) ? orderBy : columnNames[0] || 'rowid';

    // Build query
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "${table}"`
    );
    const totalRows = Number(countResult[0]?.count || 0);

    // Get data with pagination
    let query = `SELECT * FROM "${table}"`;
    
    if (search && search.trim()) {
      // Search across all text columns
      const textColumns = columns.filter((c) => 
        c.name.toLowerCase().includes('text') || 
        c.name.toLowerCase().includes('varchar') ||
        c.name === 'id' ||
        c.name === 'email' ||
        c.name === 'name'
      );
      
      if (textColumns.length > 0) {
        const searchConditions = columnNames
          .map((col) => `CAST("${col}" AS TEXT) LIKE '%${search.replace(/'/g, "''")}%'`)
          .join(' OR ');
        query += ` WHERE ${searchConditions}`;
      }
    }

    query += ` ORDER BY "${safeOrderBy}" ${order} LIMIT ${limit} OFFSET ${offset}`;

    const rows = await prisma.$queryRawUnsafe(query);

    return NextResponse.json({
      table,
      columns: columnNames,
      rows,
      pagination: {
        page,
        limit,
        totalRows,
        totalPages: Math.ceil(totalRows / limit),
      },
      orderBy: safeOrderBy,
      order,
    });
  } catch (error) {
    console.error('Table browse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to browse table' },
      { status: 500 }
    );
  }
}

/**
 * Update a row in a table
 */
export async function PUT(request: NextRequest) {
  try {
    const { table, id, data } = await request.json();

    if (!table || !id || !data) {
      return NextResponse.json(
        { error: 'Table, id, and data are required' },
        { status: 400 }
      );
    }

    // Validate table name
    const validTables = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `;
    if (!validTables.some((t) => t.name === table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    // Build UPDATE query
    const updates = Object.entries(data)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => {
        if (value === null) return `"${key}" = NULL`;
        if (typeof value === 'string') return `"${key}" = '${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return `"${key}" = ${value ? 1 : 0}`;
        return `"${key}" = ${value}`;
      })
      .join(', ');

    if (!updates) {
      return NextResponse.json({ error: 'No data to update' }, { status: 400 });
    }

    const query = `UPDATE "${table}" SET ${updates} WHERE id = '${id}'`;
    const result = await prisma.$executeRawUnsafe(query);

    return NextResponse.json({
      success: true,
      affectedRows: result,
    });
  } catch (error) {
    console.error('Row update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update row' },
      { status: 500 }
    );
  }
}

/**
 * Delete a row from a table
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    if (!table || !id) {
      return NextResponse.json(
        { error: 'Table and id are required' },
        { status: 400 }
      );
    }

    // Validate table name
    const validTables = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `;
    if (!validTables.some((t) => t.name === table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    const query = `DELETE FROM "${table}" WHERE id = '${id}'`;
    const result = await prisma.$executeRawUnsafe(query);

    return NextResponse.json({
      success: true,
      affectedRows: result,
    });
  } catch (error) {
    console.error('Row delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete row' },
      { status: 500 }
    );
  }
}
