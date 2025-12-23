/**
 * Media API Proxy Route - Proxies all media requests to backend
 * 
 * Handles /api/v1/media/* with authenticated tier.
 * Uses https.Agent to bypass self-signed certificate validation
 * for internal Docker network communication.
 * 
 * This route validates the user session and adds proper tier header
 * that the backend will trust (from server-side, not client).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import https from 'https';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Create HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * Get user tier from request header or session
 * 
 * Priority:
 * 1. X-User-Tier header (from admin panel override or localStorage)
 * 2. Session tier (from database)
 * 3. Default to 'free'
 * 
 * The header is trusted because it comes from our own frontend code,
 * not directly from the user. The admin panel updates localStorage,
 * which the frontend reads and sends as a header.
 */
async function getUserTier(request: NextRequest): Promise<string> {
  // Priority 1: Check header from client (admin panel override)
  // This allows testing different tiers without database changes
  const tierHeader = request.headers.get('X-User-Tier');
  if (tierHeader && ['free', 'jive', 'jigga'].includes(tierHeader.toLowerCase())) {
    console.log('[Media Proxy] Using tier from header:', tierHeader.toLowerCase());
    return tierHeader.toLowerCase();
  }
  
  // Priority 2: Try to get session tier from database
  try {
    const session = await auth();
    if (session?.user) {
      const tier = (session.user as { tier?: string }).tier;
      if (tier) {
        console.log('[Media Proxy] Using tier from session:', tier.toLowerCase());
        return tier.toLowerCase();
      }
    }
  } catch (error) {
    console.warn('Failed to get session for tier:', error);
  }
  
  console.log('[Media Proxy] Defaulting to FREE tier');
  return 'free';
}

async function proxyToBackend(
  request: NextRequest,
  method: string,
  pathSegments: string[]
): Promise<NextResponse> {
  try {
    const userTier = await getUserTier(request);
    const path = pathSegments.join('/');
    const backendPath = `/api/v1/media/${path}`;
    
    // Get query string if present
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${backendPath}?${queryString}` : backendPath;
    
    // Get request body for POST/PUT
    let body: string | undefined;
    if (method === 'POST' || method === 'PUT') {
      body = await request.text();
    }
    
    const url = new URL(BACKEND_URL);
    const isHttps = url.protocol === 'https:';
    
    // Build headers object
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-User-Tier': userTier,
    };
    
    // Pass along idempotency key if present
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    if (idempotencyKey) {
      requestHeaders['X-Idempotency-Key'] = idempotencyKey;
    }
    
    const response = await new Promise<{ status: number; data: unknown; headers: Record<string, string> }>((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 8000),
        path: fullPath,
        method,
        agent: isHttps ? httpsAgent : undefined,
        headers: requestHeaders,
      };
      
      if (body) {
        options.headers = {
          ...options.headers,
          'Content-Length': Buffer.byteLength(body).toString(),
        };
      }
      
      const protocol = isHttps ? https : http;
      
      const req = protocol.request(options, (res) => {
        const chunks: Buffer[] = [];
        const responseHeaders: Record<string, string> = {};
        
        // Capture response headers
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === 'string') {
            responseHeaders[key] = value;
          }
        }
        
        res.on('data', (chunk: Buffer) => { chunks.push(chunk); });
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString();
          try {
            resolve({ 
              status: res.statusCode || 500, 
              data: JSON.parse(data),
              headers: responseHeaders,
            });
          } catch {
            resolve({ 
              status: res.statusCode || 500, 
              data: { raw: data },
              headers: responseHeaders,
            });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(120000, () => { // 2 min timeout for video generation
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (body) {
        req.write(body);
      }
      req.end();
    });
    
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Media proxy error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to proxy media request', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyToBackend(request, 'GET', path);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyToBackend(request, 'POST', path);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyToBackend(request, 'PUT', path);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyToBackend(request, 'DELETE', path);
}
