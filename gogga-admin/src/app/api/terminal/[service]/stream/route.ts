import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync, readdirSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Detect if running inside Docker
const isRunningInDocker = existsSync('/.dockerenv');

// Local database path (relative to project root)
const LOCAL_DB_PATH = path.resolve(process.cwd(), '../gogga-frontend/prisma');

// Docker container names for each service
const SERVICE_CONFIG: Record<string, {
  containerName: string;
  description: string;
  isDatabase?: boolean;
}> = {
  backend: {
    containerName: 'gogga_api',
    description: 'FastAPI Backend (port 8000)',
  },
  cepo: {
    containerName: 'gogga_cepo',
    description: 'CePO Sidecar (port 8080)',
  },
  frontend: {
    containerName: 'gogga_ui',
    description: 'Next.js Frontend (port 3000)',
  },
  admin: {
    containerName: 'gogga_admin',
    description: 'Admin Panel (port 3100)',
  },
  sqlite: {
    containerName: 'gogga_admin',
    description: 'SQLite Database Info',
    isDatabase: true,
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  const { searchParams } = new URL(request.url);
  const lines = parseInt(searchParams.get('lines') || '50', 10);

  // Validate service
  if (!SERVICE_CONFIG[service]) {
    return NextResponse.json(
      { error: `Unknown service: ${service}` },
      { status: 400 }
    );
  }

  const config = SERVICE_CONFIG[service];

  try {
    let content = '';
    let status: 'running' | 'stopped' | 'unknown' = 'unknown';

    // Special handling for SQLite database info
    if (config.isDatabase) {
      status = 'running';
      try {
        // Get database info - support both local and Docker modes
        let fileInfo = '';
        
        if (isRunningInDocker) {
          // Docker mode: use docker exec
          const { stdout } = await execAsync(
            `docker exec ${config.containerName} sh -c "ls -la /app/prisma/*.db* 2>/dev/null"`,
            { timeout: 5000 }
          );
          fileInfo = stdout;
        } else {
          // Local mode: read from filesystem directly
          try {
            const files = readdirSync(LOCAL_DB_PATH).filter(f => f.endsWith('.db') || f.includes('.db-'));
            fileInfo = files.map(f => {
              const fullPath = path.join(LOCAL_DB_PATH, f);
              const stats = statSync(fullPath);
              const sizeKB = (stats.size / 1024).toFixed(1);
              const mtime = stats.mtime.toISOString().replace('T', ' ').slice(0, 19);
              return `${stats.mode.toString(8).slice(-3)} ${sizeKB}KB ${mtime} ${f}`;
            }).join('\n') || '[No database files found]';
          } catch {
            fileInfo = `[Local path: ${LOCAL_DB_PATH}]`;
          }
        }
        
        // Get database stats via our tools API (uses Prisma, no sqlite3 binary needed)
        let statsInfo = '';
        try {
          const statsRes = await fetch('http://localhost:3100/api/database/tools?tool=analyzer');
          if (statsRes.ok) {
            const data = await statsRes.json();
            const a = data.analysis || {};
            statsInfo = `
=== Database Analysis ===
Size: ${a.database_size_formatted || 'Unknown'}
Pages: ${a.page_count || 'Unknown'} (${a.page_size || 4096} bytes each)
Fragmentation: ${a.fragmentation_percent || 0}%
Journal Mode: ${a.journal_mode || 'Unknown'}
Tables: ${a.table_count || 0}
Total Rows: ${a.total_rows || 0}

=== Table Stats ===
${(a.tables || []).map((t: { name: string; rowCount: number }) => `${t.name}: ${t.rowCount} rows`).join('\n')}`;
          }
        } catch {
          statsInfo = '[Could not fetch database stats]';
        }

        // Get integrity status
        let integrityInfo = '';
        try {
          const intRes = await fetch('http://localhost:3100/api/database/tools?tool=integrity');
          if (intRes.ok) {
            const data = await intRes.json();
            integrityInfo = `\n\n=== Integrity Check ===\nStatus: ${data.status === 'healthy' ? '✓ Healthy' : '⚠ Issues Found'}\nResult: ${data.result}`;
          }
        } catch {
          integrityInfo = '\n\n=== Integrity Check ===\n[Check skipped]';
        }

        content = `=== SQLite Database Files ===
${fileInfo.trim()}
${statsInfo}${integrityInfo}

=== Last Updated ===
${new Date().toISOString()}`;
      } catch (err) {
        content = `[SQLite Info Error: ${err instanceof Error ? err.message : 'Unknown error'}]\n`;
        try {
          if (isRunningInDocker) {
            const { stdout } = await execAsync(`docker exec ${config.containerName} ls -la /app/prisma/ 2>&1`, { timeout: 5000 });
            content += `\n=== Files ===\n${stdout}`;
          } else {
            // Local mode fallback
            const files = readdirSync(LOCAL_DB_PATH);
            content += `\n=== Files in ${LOCAL_DB_PATH} ===\n${files.join('\n')}`;
          }
        } catch {
          content += '[Unable to access database files]';
        }
      }
      
      return NextResponse.json({
        service,
        containerName: config.containerName,
        description: config.description,
        status,
        content: content.trim(),
        lines,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if Docker container is running
    try {
      const { stdout: containerStatus } = await execAsync(
        `docker inspect --format='{{.State.Status}}' ${config.containerName} 2>/dev/null`,
        { timeout: 5000 }
      );
      const containerState = containerStatus.trim();
      status = containerState === 'running' ? 'running' : 'stopped';
    } catch {
      status = 'stopped';
    }

    // Get Docker container logs
    try {
      const { stdout, stderr } = await execAsync(
        `docker logs --tail ${lines} ${config.containerName} 2>&1`,
        { timeout: 10000 }
      );
      content = stdout || stderr || '[No logs available]';
    } catch (err) {
      content = `[Unable to fetch Docker logs: ${err instanceof Error ? err.message : 'Unknown error'}]`;
    }

    return NextResponse.json({
      service,
      containerName: config.containerName,
      description: config.description,
      status,
      content: content.trim(),
      lines,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      service,
      containerName: config.containerName,
      status: 'unknown',
      content: `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
      error: true,
      timestamp: new Date().toISOString(),
    });
  }
}
