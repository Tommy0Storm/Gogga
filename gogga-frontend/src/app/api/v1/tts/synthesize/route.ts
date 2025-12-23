/**
 * TTS Synthesize API Route - Proxies to backend for speech synthesis
 * 
 * Handles POST /api/v1/tts/synthesize with text-to-speech conversion.
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

interface TTSRequest {
  text: string;
  voice_name?: string;
  language_code?: string;
  speaking_rate?: number;
  pitch?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: TTSRequest = await request.json();
    
    if (!body.text?.trim()) {
      return NextResponse.json(
        { detail: 'No text provided' },
        { status: 400 }
      );
    }
    
    const backendUrl = `${BACKEND_URL}/api/v1/tts/synthesize`;
    
    // Use native Node.js http/https for self-signed cert support
    const response = await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
      const url = new URL(backendUrl);
      const isHttps = url.protocol === 'https:';
      const protocol = isHttps ? https : http;
      
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        agent: isHttps ? httpsAgent : undefined,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      };
      
      const req = protocol.request(options, (res) => {
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
      req.setTimeout(60000, () => {  // 60s timeout for TTS
        req.destroy(new Error('Request timeout'));
      });
      
      req.write(JSON.stringify(body));
      req.end();
    });
    
    return NextResponse.json(response.data, { status: response.status });
    
  } catch (error) {
    console.error('[TTS API] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'TTS synthesis failed' },
      { status: 500 }
    );
  }
}
