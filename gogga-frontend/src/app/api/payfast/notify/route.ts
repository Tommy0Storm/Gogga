/**
 * GOGGA - PayFast ITN (Instant Transaction Notification) Handler
 * 
 * POST /api/payfast/notify
 * 
 * Webhook endpoint for PayFast subscription notifications:
 * - Payment success/failure
 * - Subscription activation
 * - Subscription cancellation
 * 
 * Security:
 * - IP whitelist verification
 * - MD5 signature validation
 * - Connection logging for disputes
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'

// PayFast IP whitelist (sandbox + production)
const PAYFAST_IPS = [
  '197.97.145.144',
  '197.97.145.145',
  '197.97.145.146',
  '197.97.145.147',
  '197.97.145.148',
  '41.74.179.194',
  '41.74.179.195',
  '41.74.179.196',
  '41.74.179.197',
  '41.74.179.198',
  '41.74.179.199',
  // Sandbox IPs
  '196.33.227.224',
  '196.33.227.225',
]

// Tier mapping from PayFast payment names
const TIER_MAPPING: Record<string, string> = {
  'GOGGA JIVE': 'JIVE',
  'GOGGA JIGGA': 'JIGGA',
  'JIVE Subscription': 'JIVE',
  'JIGGA Subscription': 'JIGGA',
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for whitelist check
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    // Verify IP is from PayFast (skip in development)
    if (process.env.NODE_ENV === 'production' && !PAYFAST_IPS.includes(clientIp)) {
      console.warn('PayFast ITN: Rejected - Invalid IP:', clientIp)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse form data from PayFast
    const formData = await request.formData()
    const data: Record<string, string> = {}
    formData.forEach((value, key) => {
      data[key] = value.toString()
    })

    // Log the ITN request (for dispute investigation)
    await prisma.authLog.create({
      data: {
        email: data.email_address || null,
        action: 'payfast_itn_received',
        ip: clientIp,
        meta: JSON.stringify({
          payment_status: data.payment_status,
          item_name: data.item_name,
          m_payment_id: data.m_payment_id,
          pf_payment_id: data.pf_payment_id,
          token: data.token ? 'present' : 'absent', // Don't log actual token
        })
      }
    })

    // Verify signature
    const isValidSignature = verifyPayFastSignature(data)
    if (!isValidSignature) {
      console.error('PayFast ITN: Invalid signature')
      await prisma.authLog.create({
        data: {
          email: data.email_address,
          action: 'payfast_itn_invalid_signature',
          ip: clientIp,
        }
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Process based on payment status
    const paymentStatus = data.payment_status?.toUpperCase()
    const userEmail = data.email_address?.toLowerCase()

    if (!userEmail) {
      console.error('PayFast ITN: No email address')
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    // Find or create user
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: {},
      create: { email: userEmail }
    })

    // Determine tier from item name
    const itemName = data.item_name || ''
    const tier = Object.entries(TIER_MAPPING).find(([key]) => 
      itemName.toLowerCase().includes(key.toLowerCase())
    )?.[1] || 'JIVE'

    switch (paymentStatus) {
      case 'COMPLETE':
        // Activate or update subscription
        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            tier,
            status: 'active',
            payfastToken: data.token || null,
            startedAt: new Date(),
            nextBilling: data.billing_date ? new Date(data.billing_date) : null,
          },
          create: {
            userId: user.id,
            tier,
            status: 'active',
            payfastToken: data.token || null,
            startedAt: new Date(),
            nextBilling: data.billing_date ? new Date(data.billing_date) : null,
          }
        })

        await prisma.authLog.create({
          data: {
            email: userEmail,
            action: 'subscription_activated',
            ip: clientIp,
            meta: JSON.stringify({ tier, pf_payment_id: data.pf_payment_id })
          }
        })

        // TODO: Send vcb_subscription_activation_with_privacy email
        console.log(`Subscription activated: ${userEmail} → ${tier}`)
        break

      case 'CANCELLED':
        await prisma.subscription.updateMany({
          where: { userId: user.id },
          data: {
            status: 'cancelled',
          }
        })

        await prisma.authLog.create({
          data: {
            email: userEmail,
            action: 'subscription_cancelled',
            ip: clientIp,
          }
        })

        // TODO: Send vcb_subscription_cancelled email
        console.log(`Subscription cancelled: ${userEmail}`)
        break

      case 'FAILED':
        await prisma.authLog.create({
          data: {
            email: userEmail,
            action: 'payment_failed',
            ip: clientIp,
            meta: JSON.stringify({ reason: data.reason || 'unknown' })
          }
        })

        // TODO: Send vcb_payment_failed email
        console.log(`Payment failed: ${userEmail}`)
        break

      default:
        console.log(`PayFast ITN: Unknown status ${paymentStatus}`)
    }

    // PayFast expects 200 OK
    return new NextResponse('OK', { status: 200 })

  } catch (error) {
    console.error('PayFast ITN error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * Verify PayFast MD5 signature
 * CRITICAL: Use quote_plus (+ for spaces) not quote (%20)
 */
function verifyPayFastSignature(data: Record<string, string>): boolean {
  const passphrase = process.env.PAYFAST_PASSPHRASE

  // Build signature string (all fields except signature, in order received)
  const signatureFields = Object.entries(data)
    .filter(([key]) => key !== 'signature')
    .map(([key, value]) => {
      // Use encodeURIComponent then replace %20 with +
      const encoded = encodeURIComponent(value.trim()).replace(/%20/g, '+')
      return `${key}=${encoded}`
    })
    .join('&')

  // Append passphrase if set
  const stringToSign = passphrase 
    ? `${signatureFields}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : signatureFields

  // Generate MD5 hash
  const calculatedSignature = crypto.createHash('md5').update(stringToSign).digest('hex')

  // Compare with provided signature
  return calculatedSignature.toLowerCase() === (data.signature || '').toLowerCase()
}

// Handle GET for health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'payfast-itn' })
}
