/**
 * Tools List API Route - Proxies to backend for tool listing
 * 
 * Handles GET /api/v1/tools with tier-based filtering.
 * Uses https.Agent to bypass self-signed certificate validation
 * for internal Docker network communication.
 */

import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Create HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier') || 'free';
    
    const backendUrl = `${BACKEND_URL}/api/v1/tools?tier=${tier}`;
    
    // Use native Node.js https for self-signed cert support
    const response = await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
      const url = new URL(backendUrl);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'GET',
        agent: url.protocol === 'https:' ? httpsAgent : undefined,
        headers: {
          'Accept': 'application/json',
        },
      };
      
      const protocol = url.protocol === 'https:' ? https : require('http');
      
      const req = protocol.request(options, (res: import('http').IncomingMessage) => {
        let data = '';
        res.on('data', (chunk: Buffer | string) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 500, data: { raw: data } });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
    
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Tools list proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
