import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Download a database backup file
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('name');

    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    // Sanitize filename to prevent directory traversal
    const safeName = path.basename(filename);
    if (!safeName.endsWith('.db')) {
      return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 });
    }

    const backupsDir = path.join(process.cwd(), 'backups');
    const filePath = path.join(backupsDir, safeName);

    // Ensure the file is in the backups directory
    if (!filePath.startsWith(backupsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);

    // Return as downloadable file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Content-Length': stats.size.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    );
  }
}
