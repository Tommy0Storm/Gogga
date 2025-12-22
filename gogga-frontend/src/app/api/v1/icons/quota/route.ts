/**
 * Icon Quota API Route - Proxies to backend
 * Uses https.Agent to bypass self-signed certificate validation
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
    const userId = searchParams.get('user_id');
    const tier = searchParams.get('tier');

    if (!userId || !tier) {
      return NextResponse.json(
        { error: 'Missing user_id or tier' },
        { status: 400 }
      );
    }

    const backendUrl = `${BACKEND_URL}/api/v1/icons/quota?tier=${tier}`;
    
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
          'X-User-Tier': tier,
          'X-User-ID': userId,
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
      req.end();
    });

    if (response.status !== 200) {
      console.error('[Icon Quota] Backend error:', response.status, response.data);
      return NextResponse.json(
        { error: 'Backend error', details: response.data },
        { status: response.status }
      );
    }

    return NextResponse.json(response.data);

  } catch (error) {
    console.error('[Icon Quota] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
