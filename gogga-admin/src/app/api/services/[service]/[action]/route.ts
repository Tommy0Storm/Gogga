import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '@/lib/prisma';

const execAsync = promisify(exec);

// Service control commands - abstract services, not Docker
const SERVICE_COMMANDS: Record<string, {
  start: string;
  stop: string;
  restart: string;
}> = {
  backend: {
    start: 'cd /home/ubuntu/Dev-Projects/Gogga/gogga-backend && nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/gogga-backend.log 2>&1 &',
    stop: 'pkill -f "uvicorn app.main:app" || true',
    restart: 'pkill -f "uvicorn app.main:app" || true; sleep 2; cd /home/ubuntu/Dev-Projects/Gogga/gogga-backend && nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/gogga-backend.log 2>&1 &',
  },
  cepo: {
    start: 'cd /home/ubuntu/Dev-Projects/Gogga/gogga-cepo && nohup python -m optillm --port 8080 > /tmp/gogga-cepo.log 2>&1 &',
    stop: 'pkill -f "optillm" || true',
    restart: 'pkill -f "optillm" || true; sleep 2; cd /home/ubuntu/Dev-Projects/Gogga/gogga-cepo && nohup python -m optillm --port 8080 > /tmp/gogga-cepo.log 2>&1 &',
  },
  frontend: {
    start: 'cd /home/ubuntu/Dev-Projects/Gogga/gogga-frontend && nohup pnpm dev:http > /tmp/gogga-frontend.log 2>&1 &',
    stop: 'pkill -f "next dev -H 0.0.0.0" 2>/dev/null || true; fuser -k 3000/tcp 2>/dev/null || true',
    restart: 'pkill -f "next dev -H 0.0.0.0" 2>/dev/null || true; fuser -k 3000/tcp 2>/dev/null || true; sleep 2; cd /home/ubuntu/Dev-Projects/Gogga/gogga-frontend && nohup pnpm dev:http > /tmp/gogga-frontend.log 2>&1 &',
  },
  admin: {
    start: 'cd /home/ubuntu/Dev-Projects/Gogga/gogga-admin && nohup npm run dev > /tmp/gogga-admin.log 2>&1 &',
    stop: 'pkill -f "next dev -H 0.0.0.0 -p 3100" || true; fuser -k 3100/tcp 2>/dev/null || true',
    restart: 'pkill -f "next dev -H 0.0.0.0 -p 3100" || true; fuser -k 3100/tcp 2>/dev/null || true; sleep 2; cd /home/ubuntu/Dev-Projects/Gogga/gogga-admin && nohup npm run dev > /tmp/gogga-admin.log 2>&1 &',
  },
};

// Check if user has service admin privileges
async function checkServiceAdminAuth(request: NextRequest): Promise<{ authorized: boolean; email?: string; error?: string }> {
  // Get admin email from header (set by auth middleware or session)
  const adminEmail = request.headers.get('x-admin-email');
  
  // Also check for internal API key for system calls
  const apiKey = request.headers.get('x-api-key');
  const internalKey = process.env.INTERNAL_API_KEY;
  
  if (apiKey && internalKey && apiKey === internalKey) {
    return { authorized: true, email: 'system' };
  }
  
  if (!adminEmail) {
    // For development, allow access but log warning
    console.warn('[ADMIN] No auth header - allowing for development');
    return { authorized: true, email: 'dev@localhost' };
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { isServiceAdmin: true, isAdmin: true },
    });
    
    if (!user) {
      return { authorized: false, error: 'User not found' };
    }
    
    // Must be either a service admin OR a full admin
    if (!user.isServiceAdmin && !user.isAdmin) {
      return { authorized: false, error: 'Insufficient permissions - requires service admin access' };
    }
    
    return { authorized: true, email: adminEmail };
  } catch (error) {
    console.error('[ADMIN] Auth check failed:', error);
    return { authorized: false, error: 'Auth check failed' };
  }
}

// This endpoint requires service admin privileges
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ service: string; action: string }> }
) {
  // Check authorization
  const auth = await checkServiceAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized', requiresAuth: true },
      { status: 403 }
    );
  }

  const { service, action } = await params;

  // Validate service
  if (!SERVICE_COMMANDS[service]) {
    return NextResponse.json(
      { error: `Unknown service: ${service}` },
      { status: 400 }
    );
  }

  // Validate action
  if (!['start', 'stop', 'restart'].includes(action)) {
    return NextResponse.json(
      { error: `Invalid action: ${action}. Must be start, stop, or restart.` },
      { status: 400 }
    );
  }

  const command = SERVICE_COMMANDS[service][action as 'start' | 'stop' | 'restart'];

  try {
    // Log the action for audit in database
    await prisma.adminLog.create({
      data: {
        adminEmail: auth.email || 'unknown',
        action: `service_${action}`,
        targetId: service,
        meta: JSON.stringify({ command, timestamp: new Date().toISOString() }),
      },
    });

    // Log to console
    console.log(`[ADMIN] Service action by ${auth.email}: ${action} ${service}`);
    console.log(`[ADMIN] Command: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      shell: '/bin/bash',
    });

    return NextResponse.json({
      success: true,
      service,
      action,
      actor: auth.email,
      output: stdout || 'Command executed successfully',
      stderr: stderr || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[ADMIN] Service action failed:`, error);
    
    return NextResponse.json(
      {
        success: false,
        service,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
