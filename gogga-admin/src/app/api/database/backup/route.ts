import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Create a database backup
 */
export async function POST() {
  try {
    const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
    const dbPath = dbUrl.replace('file:', '').replace(/^\.\//, '');
    const fullPath = path.resolve(process.cwd(), dbPath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
    }

    // Create backups directory
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `gogga-backup-${timestamp}.db`;
    const backupPath = path.join(backupsDir, backupName);

    // Copy the database file
    fs.copyFileSync(fullPath, backupPath);

    // Get file size
    const stats = fs.statSync(backupPath);
    const sizeFormatted =
      stats.size < 1024 * 1024
        ? `${(stats.size / 1024).toFixed(1)} KB`
        : `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;

    return NextResponse.json({
      success: true,
      backup: {
        name: backupName,
        path: backupPath,
        size: stats.size,
        sizeFormatted,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backup failed' },
      { status: 500 }
    );
  }
}

/**
 * List available backups
 */
export async function GET() {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');

    if (!fs.existsSync(backupsDir)) {
      return NextResponse.json({ backups: [] });
    }

    const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.db'));

    const backups = files.map((filename) => {
      const filePath = path.join(backupsDir, filename);
      const stats = fs.statSync(filePath);
      return {
        name: filename,
        size: stats.size,
        sizeFormatted:
          stats.size < 1024 * 1024
            ? `${(stats.size / 1024).toFixed(1)} KB`
            : `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
        createdAt: stats.mtime.toISOString(),
      };
    });

    // Sort by date, newest first
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ backups });
  } catch (error) {
    console.error('List backups error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list backups' },
      { status: 500 }
    );
  }
}
