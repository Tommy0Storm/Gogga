/**
 * GOGGA - Token Request API
 * 
 * POST /api/auth/request-token
 * 
 * Generates a one-time magic token and sends it via EmailJS REST API.
 * Token expires in 15 minutes.
 * 
 * Request: { email: string }
 * Response: { ok: boolean, message?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto';
import prisma from '@/lib/prisma'

// EmailJS configuration - uses env vars with Outlook service fallback
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_53ldd2p'
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_hhsckmm'
const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

// Token expiry: 15 minutes
const TOKEN_EXPIRY_MS = 15 * 60 * 1000

/**
 * Send email using EmailJS REST API (server-side compatible)
 */
async function sendEmailJS(
  templateParams: Record<string, string>,
  publicKey: string,
  privateKey: string
): Promise<void> {
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
      template_params: templateParams,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`EmailJS API error: ${response.status} - ${errorText}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { ok: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    // Store token in database
    await prisma.loginToken.create({
      data: {
        email: email.toLowerCase().trim(),
        token,
        expiresAt,
      },
    });

    // Get IP for connection logging
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Log token request (connection logging for disputes)
    await prisma.authLog.create({
      data: {
        email: email.toLowerCase().trim(),
        action: 'token_requested',
        ip: ip.split(',')[0]?.trim() || 'unknown',
        meta: JSON.stringify({
          expires_in_minutes: 15,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // Build magic link URL
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || 'https://gogga.vcb-ai.online';
    const magicLink = `${baseUrl}/login?token=${token}`;

    // Send email via EmailJS REST API
    try {
      await sendEmailJS(
        {
          email: email,  // Template uses {{email}} for recipient
          token: token,
          magic_link: magicLink,
          expires_in: '15 minutes',
          support_email: process.env.EMAIL_FROM || 'hello@vcb-ai.online',
          app_name: 'GOGGA AI',
        },
        process.env.EMAILJS_PUBLIC_KEY || '',
        process.env.EMAILJS_PRIVATE_KEY || ''
      );
      console.log('Email sent successfully to:', email);
    } catch (emailError) {
      console.error('EmailJS error:', emailError);
      // Don't expose email errors to client
      // Token is still valid - user can retry or check spam
    }

    return NextResponse.json({
      ok: true,
      message: 'Check your email for a sign-in link',
    });
  } catch (error) {
    console.error('Token request error:', error)
    return NextResponse.json(
      { ok: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
