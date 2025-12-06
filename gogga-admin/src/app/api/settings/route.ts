import { NextResponse } from 'next/server';

// Track process start time for uptime calculation
const startTime = Date.now();

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds % 60}s`;
}

export async function GET() {
  try {
    const uptime = Date.now() - startTime;

    return NextResponse.json({
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      nodeVersion: process.version,
      buildTime: process.env.BUILD_TIME || null,
      gitCommit: process.env.GIT_COMMIT?.slice(0, 8) || null,
      services: {
        backendUrl: process.env.BACKEND_URL || 'http://localhost:8000',
        cepoUrl: process.env.CEPO_URL || 'http://localhost:8080',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        databaseUrl: process.env.DATABASE_URL ? 'file:***' : 'file:./prisma/dev.db',
        payfastEnv: process.env.PAYFAST_ENV || 'sandbox',
      },
      uptime: {
        admin: formatUptime(uptime),
      },
    });
  } catch (error) {
    console.error('Failed to get settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
