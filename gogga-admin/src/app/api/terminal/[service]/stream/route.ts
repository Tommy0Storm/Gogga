import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, statSync, readdirSync, readFileSync } from "fs";
import path from "path";

const execAsync = promisify(exec);

// Detect if running inside Docker
const isRunningInDocker = existsSync("/.dockerenv");

// Project root for local dev
const PROJECT_ROOT = path.resolve(process.cwd(), "..");

// Local database path (relative to project root)
const LOCAL_DB_PATH = path.resolve(process.cwd(), "../gogga-frontend/prisma");

// Docker container names for each service
const SERVICE_CONFIG: Record<
  string,
  {
    containerName: string;
    description: string;
    isDatabase?: boolean;
    localLogCmd?: string; // Command to get logs in local dev mode
    localPort?: number; // Port to check for health
  }
> = {
  backend: {
    containerName: "gogga_api",
    description: "FastAPI Backend (port 8000)",
    localLogCmd: "journalctl -u gogga-backend --no-pager -n",
    localPort: 8000,
  },
  python: {
    containerName: "gogga_api",
    description: "Python Backend (uvicorn)",
    localPort: 8000,
  },
  cepo: {
    containerName: "gogga_cepo_worker",
    description: "CePO Sidecar on Worker (port 8080)",
    localPort: 8080,
  },
  frontend: {
    containerName: "gogga_ui",
    description: "Next.js Frontend (port 3000)",
    localPort: 3000,
  },
  admin: {
    containerName: "gogga_admin",
    description: "Admin Panel (port 3100)",
    localPort: 3100,
  },
  sqlite: {
    containerName: "gogga_admin",
    description: "SQLite Database Info",
    isDatabase: true,
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  const { searchParams } = new URL(request.url);
  const lines = parseInt(searchParams.get("lines") || "50", 10);

  // Validate service
  if (!SERVICE_CONFIG[service]) {
    return NextResponse.json(
      { error: `Unknown service: ${service}` },
      { status: 400 }
    );
  }

  const config = SERVICE_CONFIG[service];

  try {
    let content = "";
    let status: "running" | "stopped" | "unknown" = "unknown";

    // Special handling for SQLite database info
    if (config.isDatabase) {
      status = "running";
      try {
        // Get database info - support both local and Docker modes
        let fileInfo = "";

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
            const files = readdirSync(LOCAL_DB_PATH).filter(
              (f) => f.endsWith(".db") || f.includes(".db-")
            );
            fileInfo =
              files
                .map((f) => {
                  const fullPath = path.join(LOCAL_DB_PATH, f);
                  const stats = statSync(fullPath);
                  const sizeKB = (stats.size / 1024).toFixed(1);
                  const mtime = stats.mtime
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 19);
                  return `${stats.mode
                    .toString(8)
                    .slice(-3)} ${sizeKB}KB ${mtime} ${f}`;
                })
                .join("\n") || "[No database files found]";
          } catch {
            fileInfo = `[Local path: ${LOCAL_DB_PATH}]`;
          }
        }

        // Get database stats via our tools API (uses Prisma, no sqlite3 binary needed)
        let statsInfo = "";
        try {
          const statsRes = await fetch(
            "http://localhost:3100/api/database/tools?tool=analyzer"
          );
          if (statsRes.ok) {
            const data = await statsRes.json();
            const a = data.analysis || {};
            statsInfo = `
=== Database Analysis ===
Size: ${a.database_size_formatted || "Unknown"}
Pages: ${a.page_count || "Unknown"} (${a.page_size || 4096} bytes each)
Fragmentation: ${a.fragmentation_percent || 0}%
Journal Mode: ${a.journal_mode || "Unknown"}
Tables: ${a.table_count || 0}
Total Rows: ${a.total_rows || 0}

=== Table Stats ===
${(a.tables || [])
  .map(
    (t: { name: string; rowCount: number }) => `${t.name}: ${t.rowCount} rows`
  )
  .join("\n")}`;
          }
        } catch {
          statsInfo = "[Could not fetch database stats]";
        }

        // Get integrity status
        let integrityInfo = "";
        try {
          const intRes = await fetch(
            "http://localhost:3100/api/database/tools?tool=integrity"
          );
          if (intRes.ok) {
            const data = await intRes.json();
            integrityInfo = `\n\n=== Integrity Check ===\nStatus: ${
              data.status === "healthy" ? "✓ Healthy" : "⚠ Issues Found"
            }\nResult: ${data.result}`;
          }
        } catch {
          integrityInfo = "\n\n=== Integrity Check ===\n[Check skipped]";
        }

        content = `=== SQLite Database Files ===
${fileInfo.trim()}
${statsInfo}${integrityInfo}

=== Last Updated ===
${new Date().toISOString()}`;
      } catch (err) {
        content = `[SQLite Info Error: ${
          err instanceof Error ? err.message : "Unknown error"
        }]\n`;
        try {
          if (isRunningInDocker) {
            const { stdout } = await execAsync(
              `docker exec ${config.containerName} ls -la /app/prisma/ 2>&1`,
              { timeout: 5000 }
            );
            content += `\n=== Files ===\n${stdout}`;
          } else {
            // Local mode fallback
            const files = readdirSync(LOCAL_DB_PATH);
            content += `\n=== Files in ${LOCAL_DB_PATH} ===\n${files.join(
              "\n"
            )}`;
          }
        } catch {
          content += "[Unable to access database files]";
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
    let isDockerAvailable = false;
    try {
      const { stdout: containerStatus } = await execAsync(
        `docker inspect --format='{{.State.Status}}' ${config.containerName} 2>/dev/null`,
        { timeout: 5000 }
      );
      const containerState = containerStatus.trim();
      status = containerState === "running" ? "running" : "stopped";
      isDockerAvailable = status === "running";
    } catch {
      status = "stopped";
    }

    // In local dev mode, check if the port is responding
    if (!isDockerAvailable && config.localPort) {
      try {
        const res = await fetch(`http://localhost:${config.localPort}`, {
          method: "HEAD",
          signal: AbortSignal.timeout(2000),
        });
        status = "running";
      } catch {
        // Port not responding - try checking for process
        try {
          const { stdout } = await execAsync(
            `lsof -i :${config.localPort} -t 2>/dev/null | head -1`,
            { timeout: 2000 }
          );
          if (stdout.trim()) {
            status = "running";
          }
        } catch {
          status = "stopped";
        }
      }
    }

    // Get logs - prefer Docker, fallback to local dev output
    if (isDockerAvailable) {
      // Get Docker container logs
      try {
        const { stdout, stderr } = await execAsync(
          `docker logs --tail ${lines} ${config.containerName} 2>&1`,
          { timeout: 10000 }
        );
        content = stdout || stderr || "[No logs available]";
      } catch (err) {
        content = `[Unable to fetch Docker logs: ${
          err instanceof Error ? err.message : "Unknown error"
        }]`;
      }
    } else {
      // Local dev mode - get process info and recent activity
      content = await getLocalDevLogs(service, config, lines);
    }

    return NextResponse.json({
      service,
      containerName: config.containerName,
      description: config.description,
      status,
      content: content.trim(),
      lines,
      timestamp: new Date().toISOString(),
      mode: isDockerAvailable ? "docker" : "local",
    });
  } catch (error) {
    return NextResponse.json({
      service,
      containerName: config.containerName,
      status: "unknown",
      content: `[Error: ${
        error instanceof Error ? error.message : "Unknown error"
      }]`,
      error: true,
      timestamp: new Date().toISOString(),
    });
  }
}

// Helper function to get logs in local dev mode
async function getLocalDevLogs(
  service: string,
  config: (typeof SERVICE_CONFIG)[string],
  lines: number
): Promise<string> {
  const logLines: string[] = [];

  logLines.push(`=== ${config.description} ===`);
  logLines.push(`Mode: Local Development`);
  logLines.push(`Time: ${new Date().toISOString()}`);
  logLines.push("");

  // Check if process is running
  if (config.localPort) {
    try {
      const { stdout } = await execAsync(
        `lsof -i :${config.localPort} 2>/dev/null | grep LISTEN | head -5`,
        { timeout: 3000 }
      );
      if (stdout.trim()) {
        logLines.push(`=== Process on port ${config.localPort} ===`);
        logLines.push(stdout.trim());
        logLines.push("");
      }
    } catch {
      logLines.push(`[No process found on port ${config.localPort}]`);
    }
  }

  // Service-specific log sources
  try {
    switch (service) {
      case "backend":
      case "python": {
        // Try to get uvicorn process info
        const { stdout } = await execAsync(
          `ps aux | grep -E "uvicorn|python.*app" | grep -v grep | head -5`,
          { timeout: 3000 }
        );
        if (stdout.trim()) {
          logLines.push("=== Backend Processes ===");
          logLines.push(stdout.trim());
        }

        // Check backend health endpoint
        try {
          const healthRes = await fetch(
            `${process.env.BACKEND_URL || "http://backend:8000"}/health`,
            {
              signal: AbortSignal.timeout(2000),
            }
          );
          if (healthRes.ok) {
            const health = await healthRes.json();
            logLines.push("");
            logLines.push("=== Health Status ===");
            logLines.push(JSON.stringify(health, null, 2));
          }
        } catch {
          logLines.push("");
          logLines.push("[Backend health endpoint not responding]");
        }
        break;
      }

      case "frontend": {
        // Check Next.js process
        const { stdout } = await execAsync(
          `ps aux | grep -E "next.*3000|node.*next" | grep -v grep | head -3`,
          { timeout: 3000 }
        );
        if (stdout.trim()) {
          logLines.push("=== Frontend Processes ===");
          logLines.push(stdout.trim());
        }

        // Try to get Next.js status
        try {
          const res = await fetch("http://localhost:3000", {
            method: "HEAD",
            signal: AbortSignal.timeout(2000),
          });
          logLines.push("");
          logLines.push(`=== Frontend Status ===`);
          logLines.push(`Response: ${res.status} ${res.statusText}`);
        } catch {
          logLines.push("");
          logLines.push("[Frontend not responding on port 3000]");
        }
        break;
      }

      case "admin": {
        // This is us - just show current process info
        logLines.push("=== Admin Panel Status ===");
        logLines.push("Status: Running (this process)");
        logLines.push(`PID: ${process.pid}`);
        logLines.push(`Node: ${process.version}`);
        logLines.push(
          `Memory: ${Math.round(
            process.memoryUsage().heapUsed / 1024 / 1024
          )}MB`
        );
        break;
      }

      case "cepo": {
        // CePO sidecar was removed - OptiLLM now runs in-process
        logLines.push("=== CePO / OptiLLM Status ===");
        logLines.push("");
        logLines.push("The CePO sidecar container has been DEPRECATED.");
        logLines.push(
          "OptiLLM prompt enhancements now run directly in the Python backend."
        );
        logLines.push("");
        logLines.push("=== Enhancement Techniques (by Tier) ===");
        logLines.push("");
        logLines.push("FREE Tier:");
        logLines.push("  • SPL (Structured Prompt Language)");
        logLines.push("  • Re-Read prompting");
        logLines.push("");
        logLines.push("JIVE Tier:");
        logLines.push("  • All FREE techniques");
        logLines.push("  • Chain-of-Thought Reflection");
        logLines.push("");
        logLines.push("JIGGA Tier:");
        logLines.push("  • All JIVE techniques");
        logLines.push("  • Planning & step decomposition");
        logLines.push("  • Empathy-aware responses");
        logLines.push("");
        logLines.push("=== Location ===");
        logLines.push("Backend file: app/services/optillm_enhancements.py");
        logLines.push("");
        logLines.push("See Serena memory: optillm_enhancements");
        break;
      }
    }
  } catch (err) {
    logLines.push(
      `[Error getting ${service} info: ${
        err instanceof Error ? err.message : "Unknown"
      }]`
    );
  }

  logLines.push("");
  logLines.push("---");
  logLines.push("Note: Full logs available in Docker mode or terminal output");

  return logLines.join("\n");
}
