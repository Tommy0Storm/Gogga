/**
 * Tools List API Route - Proxies to backend for tool listing
 * 
 * Handles GET /api/v1/tools with tier-based filtering.
 * Uses https.Agent to bypass self-signed certificate validation
 * for internal Docker network communication.
 */

import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Create HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

async function fetchTools(tier: string, retryCount = 0): Promise<{ status: number; data: unknown }> {
  const MAX_RETRIES = 2;
  const backendUrl = `${BACKEND_URL}/api/v1/tools?tier=${tier}`;
  
  try {
    return await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
      const url = new URL(backendUrl);
      const isHttps = url.protocol === 'https:';
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 8000),
        path: url.pathname + url.search,
        method: 'GET',
        agent: isHttps ? httpsAgent : undefined,
        headers: {
          'Accept': 'application/json',
        },
      };
      
      const protocol = isHttps ? https : http;
      
      const req = protocol.request(options, (res: http.IncomingMessage) => {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable = errorMessage.includes('socket hang up') || 
                       errorMessage.includes('ECONNRESET') ||
                       errorMessage.includes('ECONNREFUSED') ||
                       errorMessage.includes('Request timeout');
    
    if (isRetryable && retryCount < MAX_RETRIES) {
      console.warn(`[Tools API] Retrying after error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, errorMessage);
      await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
      return fetchTools(tier, retryCount + 1);
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier') || 'free';
    
    const response = await fetchTools(tier);
    
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Tools list proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
