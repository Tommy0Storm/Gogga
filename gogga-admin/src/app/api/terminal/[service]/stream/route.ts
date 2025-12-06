import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
        // Get database info from the filesystem
        const { stdout: fileInfo } = await execAsync(
          `docker exec ${config.containerName} sh -c "ls -la /app/prisma/*.db* 2>/dev/null"`,
          { timeout: 5000 }
        );
        
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
          const { stdout } = await execAsync(`docker exec ${config.containerName} ls -la /app/prisma/ 2>&1`, { timeout: 5000 });
          content += `\n=== Files ===\n${stdout}`;
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
