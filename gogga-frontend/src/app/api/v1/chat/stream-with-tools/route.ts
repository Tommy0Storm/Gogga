/**
 * SSE Stream Chat API Route - Proxies to backend streaming endpoint
 * 
 * Provides Server-Sent Events (SSE) streaming for live tool execution logs
 * during math calculations. Only available for JIVE/JIGGA tiers.
 * 
 * Uses Node.js https module with custom agent to bypass self-signed cert verification.
 */

import { NextRequest } from 'next/server';
import https from 'https';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Create HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Note: Removed 'dynamic = force-dynamic' as it conflicts with cacheComponents
// API routes are dynamic by default in Next.js 16

// Disable body size limit for streaming
export const maxDuration = 120; // 2 minutes max

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bodyString = JSON.stringify(body);
    
    const url = new URL(`${BACKEND_URL}/api/v1/chat/stream-with-tools`);
    const isHttps = url.protocol === 'https:';
    
    // Create a ReadableStream that pipes from the backend SSE
    const stream = new ReadableStream({
      async start(controller) {
        const options: https.RequestOptions = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 8000),
          path: url.pathname,
          method: 'POST',
          agent: isHttps ? httpsAgent : undefined,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyString).toString(),
            'Accept': 'text/event-stream',
          },
        };
        
        const protocol = isHttps ? https : http;
        
        const req = protocol.request(options, (res) => {
          if (res.statusCode !== 200) {
            let errorData = '';
            res.on('data', (chunk) => { errorData += chunk; });
            res.on('end', () => {
              const safeError = errorData.replace(/"/g, "'").substring(0, 500);
              const errorEvent = `data: {"type": "error", "message": "HTTP ${res.statusCode}: ${safeError}"}\n\n`;
              controller.enqueue(new TextEncoder().encode(errorEvent));
              controller.close();
            });
            return;
          }
          
          res.on('data', (chunk: Buffer) => {
            controller.enqueue(chunk);
          });
          
          res.on('end', () => {
            controller.close();
          });
          
          res.on('error', (err) => {
            console.error('[Stream API] Response error:', err.message);
            const errorEvent = `data: {"type": "error", "message": "Stream error: ${err.message.replace(/"/g, "'")}"}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorEvent));
            controller.close();
          });
        });
        
        req.on('error', (err) => {
          console.error('[Stream API] Request error:', err.message);
          const errorEvent = `data: {"type": "error", "message": "Connection error: ${err.message.replace(/"/g, "'")}"}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorEvent));
          controller.close();
        });
        
        req.setTimeout(120000, () => {
          req.destroy();
          controller.enqueue(new TextEncoder().encode(
            `data: {"type": "error", "message": "Request timeout"}\n\n`
          ));
          controller.close();
        });
        
        req.write(bodyString);
        req.end();
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Stream API] Error:', error);
    const rawMessage = error instanceof Error ? error.message : 'Unknown error';
    const safeMessage = rawMessage.replace(/"/g, "'").substring(0, 500);
    return new Response(
      `data: {"type": "error", "message": "${safeMessage}"}\n\n`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}
