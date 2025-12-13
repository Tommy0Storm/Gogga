/**
 * Tools Execute API Route - Proxies to backend for tool execution
 * 
 * Handles generate_image tool with dual provider generation
 * (Pollinations.ai + AI Horde) with extended timeout for AI Horde polling.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Extended timeout for AI Horde (can take 60+ seconds)
const TOOL_TIMEOUT_MS = 120_000;

// Note: Removed 'dynamic = force-dynamic' as it conflicts with cacheComponents
// API routes are dynamic by default in Next.js 16

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/tools/execute`, {
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
        console.error('[Tools API] Backend error:', response.status, errorText);
        return NextResponse.json(
          { error: 'Backend error', details: errorText },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      
      console.log('[Tools API] Backend response:', {
        success: data.success,
        providers: data.result?.providers,
        imageCount: data.result?.image_count
      });
      
      return NextResponse.json(data);
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[Tools API] Request timeout after', TOOL_TIMEOUT_MS, 'ms');
        return NextResponse.json(
          { error: 'Request timeout', details: 'Tool execution took too long' },
          { status: 504 }
        );
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error('[Tools API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
