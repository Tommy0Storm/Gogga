/**
 * SSE Stream Chat API Route - Proxies to backend streaming endpoint
 * 
 * Provides Server-Sent Events (SSE) streaming for live tool execution logs
 * during math calculations. Only available for JIVE/JIGGA tiers.
 */

import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Note: Removed 'dynamic = force-dynamic' as it conflicts with cacheComponents
// API routes are dynamic by default in Next.js 16

// Disable body size limit for streaming
export const maxDuration = 120; // 2 minutes max

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Forward request to backend SSE endpoint
    const response = await fetch(`${BACKEND_URL}/api/v1/chat/stream-with-tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Stream API] Backend error:', response.status, errorText);
      return new Response(
        `data: {"type": "error", "message": "${response.status}: ${errorText}"}\n\n`,
        {
          status: response.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }
    
    // Check if response body exists
    if (!response.body) {
      return new Response(
        'data: {"type": "error", "message": "No response body from backend"}\n\n',
        {
          status: 500,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        }
      );
    }
    
    // Stream the response directly through
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Stream API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      `data: {"type": "error", "message": "${message}"}\n\n`,
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
