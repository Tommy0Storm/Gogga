/**
 * GOGGA - Token Request API
 * 
 * POST /api/auth/request-token
 * 
 * Generates a one-time magic token and sends it via EmailJS.
 * Token expires in 15 minutes.
 * 
 * Request: { email: string }
 * Response: { ok: boolean, message?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import emailjs from '@emailjs/nodejs'
import prisma from '@/lib/prisma'

// EmailJS service ID (Outlook connected)
const EMAILJS_SERVICE_ID = 'service_q6alymo'
const EMAILJS_TEMPLATE_ID = 'template_magic_token'

// Token expiry: 15 minutes
const TOKEN_EXPIRY_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { ok: false, message: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, message: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

    // Store token in database
    await prisma.loginToken.create({
      data: {
        email: email.toLowerCase().trim(),
        token,
        expiresAt
      }
    })

    // Get IP for connection logging
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'

    // Log token request (connection logging for disputes)
    await prisma.authLog.create({
      data: {
        email: email.toLowerCase().trim(),
        action: 'token_requested',
        ip: ip.split(',')[0].trim(),
        meta: JSON.stringify({ 
          expires_in_minutes: 15,
          timestamp: new Date().toISOString()
        })
      }
    })

    // Build magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gogga.vcb-ai.online'
    const magicLink = `${baseUrl}/login?token=${token}`

    // Send email via EmailJS
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: email,
          token: token,
          magic_link: magicLink,
          expires_in: '15 minutes',
          support_email: process.env.EMAIL_FROM || 'hello@vcb-ai.online',
          app_name: 'GOGGA AI'
        },
        {
          publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
          privateKey: process.env.EMAILJS_PRIVATE_KEY || ''
        }
      )
    } catch (emailError) {
      console.error('EmailJS error:', emailError)
      // Don't expose email errors to client
      // Token is still valid - user can retry or check spam
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Check your email for a sign-in link' 
    })

  } catch (error) {
    console.error('Token request error:', error)
    return NextResponse.json(
      { ok: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
