/**
 * Icon Generation API Route - Proxies to backend
 * Uses https.Agent to bypass self-signed certificate validation
 */

import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Create HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both snake_case (from frontend) and camelCase
    const userId = body.user_id || body.userId;
    const tier = body.tier;
    const prompt = body.prompt;
    const lighting = body.lighting;
    const complexity = body.complexity;
    const backing = body.backing;

    console.log('[Icon Generate] Request:', { userId, tier, promptLength: prompt?.length });

    if (!userId || !tier || !prompt) {
      console.error('[Icon Generate] Missing fields:', { userId: !!userId, tier: !!tier, prompt: !!prompt });
      return NextResponse.json(
        { error: 'Missing required fields', detail: `userId: ${!!userId}, tier: ${!!tier}, prompt: ${!!prompt}` },
        { status: 400 }
      );
    }

    const backendUrl = `${BACKEND_URL}/api/v1/icons/generate`;
    const requestBody = JSON.stringify({ prompt, lighting, complexity, backing });
    
    // Use native Node.js https for self-signed cert support
    const response = await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
      const url = new URL(backendUrl);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        agent: url.protocol === 'https:' ? httpsAgent : undefined,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
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
      req.write(requestBody);
      req.end();
    });

    if (response.status !== 200) {
      console.error('[Icon Generate] Backend error:', response.status, response.data);
      return NextResponse.json(
        { error: 'Backend error', details: response.data },
        { status: response.status }
      );
    }

    return NextResponse.json(response.data);

  } catch (error) {
    console.error('[Icon Generate] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
