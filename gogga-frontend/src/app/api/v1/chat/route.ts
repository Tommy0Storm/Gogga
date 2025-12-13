/**
 * Chat API Route - Proxies to backend with extended timeout
 * 
 * The Next.js rewrite doesn't support extended timeouts for long-running
 * requests like Cerebras thinking mode (can take 60+ seconds).
 * This route explicitly handles the proxy with proper timeout.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Extended timeout for AI responses (2 minutes)
const AI_TIMEOUT_MS = 120_000;

// Note: Removed 'dynamic = force-dynamic' as it conflicts with cacheComponents
// API routes are dynamic by default in Next.js 16

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/chat`, {
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
        console.error('[Chat API] Backend error:', response.status, errorText);
        return NextResponse.json(
          { error: 'Backend error', details: errorText },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      
      // Log full response for debugging
      console.log('[Chat API] Backend response keys:', Object.keys(data));
      console.log('[Chat API] Has tool_calls:', !!data.tool_calls, 'count:', data.tool_calls?.length);
      console.log('[Chat API] Response length:', data.response?.length);
      
      // Log tool calls for debugging
      if (data.tool_calls?.length) {
        console.log('[Chat API] Tool calls in response:', data.tool_calls.length);
      }
      
      return NextResponse.json(data);
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[Chat API] Request timeout after', AI_TIMEOUT_MS, 'ms');
        return NextResponse.json(
          { error: 'Request timeout', details: 'The AI took too long to respond' },
          { status: 504 }
        );
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
