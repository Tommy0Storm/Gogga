/**
 * Chat Enhance API Route - Proxies to backend
 * 
 * Prompt enhancement endpoint for all tiers.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Standard timeout for enhance (30 seconds)
const ENHANCE_TIMEOUT_MS = 30_000;

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENHANCE_TIMEOUT_MS);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/chat/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Enhance API] Backend error:', response.status, errorText);
        return NextResponse.json(
          { error: 'Backend error', details: errorText },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      return NextResponse.json(data);
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[Enhance API] Request timeout after', ENHANCE_TIMEOUT_MS, 'ms');
        return NextResponse.json(
          { error: 'Request timeout', details: 'The enhancement took too long' },
          { status: 504 }
        );
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error('[Enhance API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
