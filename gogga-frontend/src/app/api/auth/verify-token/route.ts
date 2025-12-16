/**
 * GOGGA - Token Verification API Route
 * 
 * GET /api/auth/verify-token?token=xxx
 * 
 * Verifies the magic link token and signs in the user.
 */
import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/auth'

// Get proper base URL (not 0.0.0.0)
function getBaseUrl(request: NextRequest): string {
  // Use env var first
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  // Fallback to request origin, but fix 0.0.0.0
  const url = new URL(request.url)
  if (url.hostname === '0.0.0.0') {
    url.hostname = 'localhost'
  }
  return url.origin
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const baseUrl = getBaseUrl(request)
  
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid', baseUrl))
  }

  try {
    // Get client IP for logging
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    // Use NextAuth signIn with the email-token provider
    await signIn('email-token', {
      token,
      clientIp,
      redirect: false,
    })
    
    // Redirect to home on success
    return NextResponse.redirect(new URL('/', baseUrl))
  } catch (err) {
    console.error('[verify-token] Error:', err)
    
    // Check if it's an auth error (invalid/expired token)
    if (err instanceof Error && err.message.includes('CredentialsSignin')) {
      return NextResponse.redirect(new URL('/login?error=invalid', baseUrl))
    }
    
    return NextResponse.redirect(new URL('/login?error=verification_failed', baseUrl))
  }
}
