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
 * Send magic link email via EmailJS API
 */
async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const magicLink = `${baseUrl}/api/auth/verify-token?token=${token}`
  
  // Log in development for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Auth Action] Magic link for ${email}: ${magicLink}`)
  }
  
  // Send via EmailJS REST API
  const EMAILJS_SERVICE_ID = 'service_q6alymo'
  const EMAILJS_TEMPLATE_ID = 'template_k9ugryd'
  const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send'
  
  const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim()
  const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim()
  
  if (!publicKey || !privateKey) {
    console.error('[sendMagicLinkEmail] Missing EmailJS credentials')
    throw new Error('Email service not configured')
  }
  
  const response = await fetch(EMAILJS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        email: email,
        token: token,
        magic_link: magicLink,
        expires_in: '1 hour',
        support_email: process.env.EMAIL_FROM?.trim() || 'hello@vcb-ai.online',
        app_name: 'GOGGA AI',
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[sendMagicLinkEmail] EmailJS error: ${response.status} - ${errorText}`)
    throw new Error(`Failed to send email: ${response.status}`)
  }
  
  console.log(`[sendMagicLinkEmail] Email sent successfully to: ${email}`)
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
