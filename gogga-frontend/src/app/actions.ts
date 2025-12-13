'use server'

/**
 * Server Actions for Authentication
 * Next.js 16 pattern using Server Actions for passwordless auth
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db-server'
import crypto from 'crypto'

/**
 * Generate a secure random token for magic links
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Send magic link email (placeholder - implement with your email service)
 */
async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const magicLink = `${process.env.NEXTAUTH_URL}/api/auth/callback/email?token=${token}`
  
  // TODO: Implement actual email sending with your service (SendGrid, Resend, etc.)
  console.log(`[Auth Action] Magic link for ${email}: ${magicLink}`)
  
  // In development, log the link for testing
  if (process.env.NODE_ENV === 'development') {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  🔐 MAGIC LINK (Development)                              ║
╠════════════════════════════════════════════════════════════╣
║  Email: ${email.padEnd(48)}║
║  Link:  ${magicLink.substring(0, 48).padEnd(48)}║
╚════════════════════════════════════════════════════════════╝
    `)
  }
}

/**
 * Request a magic link for passwordless authentication
 * @param email - User's email address
 */
export async function requestMagicLink(email: string) {
  try {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { error: 'Invalid email address' }
    }

    // Generate secure token
    const token = generateSecureToken()
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour

    // Store token in database
    await db.loginToken.create({
      data: {
        email: email.toLowerCase(),
        token,
        expiresAt,
      },
    })

    // Send email
    await sendMagicLinkEmail(email, token)

    // Revalidate and redirect
    revalidatePath('/login')
    return { success: true }
  } catch (error) {
    console.error('[requestMagicLink] Error:', error)
    return { error: 'Failed to send magic link. Please try again.' }
  }
}

/**
 * Verify a magic link token and create user session
 * @param token - Magic link token from URL
 */
export async function verifyToken(token: string) {
  try {
    // Find valid token
    const loginToken = await db.loginToken.findUnique({
      where: { 
        token,
        expiresAt: { gt: new Date() }
      },
    })

    if (!loginToken) {
      redirect('/login?error=invalid')
      return
    }

    // Get or create user
    let user = await db.user.findUnique({
      where: { email: loginToken.email },
    })

    if (!user) {
      user = await db.user.create({
        data: {
          email: loginToken.email,
          isTester: false,
        },
      })
    }

    // Clean up token
    await db.loginToken.delete({
      where: { token },
    })

    // Revalidate and redirect to app
    revalidatePath('/')
    redirect('/chat')
  } catch (error) {
    console.error('[verifyToken] Error:', error)
    redirect('/login?error=verification_failed')
  }
}

/**
 * Sign out user (for use with Server Actions)
 */
export async function signOutAction() {
  try {
    // NextAuth signOut will handle session cleanup
    revalidatePath('/')
    redirect('/login')
  } catch (error) {
    console.error('[signOutAction] Error:', error)
    return { error: 'Failed to sign out' }
  }
}
