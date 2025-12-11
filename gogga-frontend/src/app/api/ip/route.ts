/**
 * GOGGA - Client IP Detection API
 * 
 * Returns the client's IP address for audit logging.
 * Handles various proxy headers (Cloudflare, nginx, etc.)
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    // Priority order for IP detection:
    // 1. CF-Connecting-IP (Cloudflare)
    // 2. X-Real-IP (nginx)
    // 3. X-Forwarded-For (first IP in chain)
    // 4. Direct connection IP

    const cfIp = request.headers.get('cf-connecting-ip')
    const realIp = request.headers.get('x-real-ip')
    const forwardedFor = request.headers.get('x-forwarded-for')

    let ip = cfIp || realIp || forwardedFor?.split(',')[0]?.trim() || 'unknown'

    // Handle IPv6 localhost
    if (ip === '::1') {
        ip = '127.0.0.1'
    }

    return NextResponse.json({ ip })
}
