/**
 * Tools Execute API Route - Proxies to backend for tool execution
 * 
 * Handles generate_image tool with dual provider generation
 * (Pollinations.ai + AI Horde) with extended timeout for AI Horde polling.
 * Uses https.Agent to bypass self-signed certificate validation
 * for internal Docker network communication.
 */

import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Extended timeout for AI Horde (can take 60+ seconds)
const TOOL_TIMEOUT_MS = 120_000;

// Create HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Note: Removed 'dynamic = force-dynamic' as it conflicts with cacheComponents
// API routes are dynamic by default in Next.js 16

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const backendUrl = `${BACKEND_URL}/api/v1/tools/execute`;
    
    // Use native Node.js https/http for self-signed cert support
    const response = await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
      const url = new URL(backendUrl);
      const isHttps = url.protocol === 'https:';
      
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        agent: isHttps ? httpsAgent : undefined,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };
      
      const protocol = isHttps ? https : http;
      
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 500, data: { raw: data } });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(TOOL_TIMEOUT_MS, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(JSON.stringify(body));
      req.end();
    });
    
    if (response.status >= 400) {
      console.error('[Tools API] Backend error:', response.status, response.data);
      return NextResponse.json(
        { error: 'Backend error', details: response.data },
        { status: response.status }
      );
    }
    
    console.log('[Tools API] Backend response:', {
      success: (response.data as { success?: boolean })?.success,
      providers: (response.data as { result?: { providers?: string[] } })?.result?.providers,
      imageCount: (response.data as { result?: { image_count?: number } })?.result?.image_count
    });
    
    return NextResponse.json(response.data);
    
  } catch (error) {
    console.error('[Tools API] Error:', error);
    
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timeout', details: 'Tool execution took too long' },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
