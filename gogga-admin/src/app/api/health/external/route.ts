import { NextResponse } from 'next/server';

interface APIHealth {
  name: string;
  status: 'online' | 'offline' | 'unknown';
  latency?: number;
}

async function checkAPI(
  name: string,
  url: string,
  timeout = 5000
): Promise<APIHealth> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
    const latency = Date.now() - start;
    return {
      name,
      status: res.ok ? 'online' : 'offline',
      latency,
    };
  } catch {
    return { name, status: 'offline' };
  }
}

export async function GET() {
  try {
    // Check external APIs in parallel
    const checks = await Promise.all([
      // Cerebras - check their API status page
      checkAPI('Cerebras', 'https://api.cerebras.ai'),
      
      // OpenRouter
      checkAPI('OpenRouter', 'https://openrouter.ai/api/v1/models'),
      
      // DeepInfra
      checkAPI('DeepInfra', 'https://api.deepinfra.com/v1/openai/models'),
      
      // PayFast - check sandbox/production endpoint
      checkAPI(
        'PayFast',
        process.env.PAYFAST_ENV === 'production'
          ? 'https://www.payfast.co.za/eng/process'
          : 'https://sandbox.payfast.co.za/eng/process'
      ),
    ]);

    return NextResponse.json({ apis: checks });
  } catch (error) {
    console.error('Failed to check external APIs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
