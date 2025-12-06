import { NextResponse } from 'next/server';

const CEPO_URL = process.env.CEPO_URL || 'http://localhost:8080';

export async function GET() {
  try {
    const res = await fetch(`${CEPO_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    
    if (res.ok) {
      return NextResponse.json({
        status: 'online',
        url: CEPO_URL,
        message: 'CePO service is healthy',
      });
    }
    
    return NextResponse.json({
      status: 'offline',
      url: CEPO_URL,
      message: `CePO returned status ${res.status}`,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'offline',
      url: CEPO_URL,
      message: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}
