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
import * as crypto from 'crypto';
import { prisma } from '@/lib/prisma';

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

// Credit pack amounts
const CREDIT_PACK_AMOUNTS: Record<number, number> = {
  200: 50000,    // R200 = 50K credits
  500: 150000,   // R500 = 150K credits
  1000: 350000,  // R1000 = 350K credits
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for whitelist check
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Verify IP is from PayFast (skip in development)
    if (
      process.env.NODE_ENV === 'production' &&
      !PAYFAST_IPS.includes(clientIp)
    ) {
      console.warn('PayFast ITN: Rejected - Invalid IP:', clientIp);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse form data from PayFast
    const formData = await request.formData();
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

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
        }),
      },
    });

    // Verify signature
    const isValidSignature = verifyPayFastSignature(data);
    if (!isValidSignature) {
      console.error('PayFast ITN: Invalid signature');
      await prisma.authLog.create({
        data: {
          email: data.email_address,
          action: 'payfast_itn_invalid_signature',
          ip: clientIp,
        },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Process based on payment status
    const paymentStatus = data.payment_status?.toUpperCase();
    const userEmail = data.email_address?.toLowerCase();

    if (!userEmail) {
      console.error('PayFast ITN: No email address');
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    // Find or create user
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: {},
      create: { email: userEmail },
    });

    // CRITICAL: Idempotency check - prevent double-processing of ITN
    // PayFast retries ITN on network issues, and malicious actors could replay
    const pfPaymentId = data.pf_payment_id;
    if (pfPaymentId) {
      const existingPayment = await prisma.processedPayment.findUnique({
        where: { pfPaymentId },
      });

      if (existingPayment) {
        console.log(`PayFast ITN: Duplicate payment ignored: ${pfPaymentId}`);
        await prisma.authLog.create({
          data: {
            email: userEmail,
            action: 'payfast_itn_duplicate_ignored',
            ip: clientIp,
            meta: JSON.stringify({ pf_payment_id: pfPaymentId }),
          },
        });
        // Still return 200 OK so PayFast doesn't retry
        return new NextResponse('OK', { status: 200 });
      }
    }

    // Determine tier from item name
    const itemName = data.item_name || '';
    const tier =
      Object.entries(TIER_MAPPING).find(([key]) =>
        itemName.toLowerCase().includes(key.toLowerCase())
      )?.[1] || 'JIVE';

    switch (paymentStatus) {
      case 'COMPLETE':
        // Check if this is a credit pack purchase (once-off)
        const paymentType = data.custom_str1 || 'subscription';

        if (paymentType === 'credit_pack') {
          // Credit pack purchase
          const packPrice = parseInt(data.custom_str2 || '0');
          const creditsToAdd = CREDIT_PACK_AMOUNTS[packPrice] || 0;

          if (creditsToAdd > 0) {
            // Get or create subscription record
            const subscription = await prisma.subscription.upsert({
              where: { userId: user.id },
              update: {
                credits: { increment: creditsToAdd },
              },
              create: {
                userId: user.id,
                tier: 'FREE',
                status: 'active',
                credits: creditsToAdd,
                creditsUsed: 0,
                monthlyCredits: 0,
                imagesUsed: 0,
                imagesLimit: 0,
                startedAt: new Date(),
              },
            });

            // Record the credit pack purchase
            await prisma.creditPurchase.create({
              data: {
                userId: user.id,
                packSize: packPrice.toString(),
                credits: creditsToAdd,
                pfPaymentId: data.pf_payment_id || null,
                status: 'complete',
              },
            });

            await prisma.authLog.create({
              data: {
                email: userEmail,
                action: 'credit_pack_purchased',
                ip: clientIp,
                meta: JSON.stringify({
                  pack_price: packPrice,
                  credits: creditsToAdd,
                  pf_payment_id: data.pf_payment_id,
                }),
              },
            });

            // Record payment as processed (idempotency)
            if (data.pf_payment_id) {
              await prisma.processedPayment.create({
                data: {
                  pfPaymentId: data.pf_payment_id,
                  type: 'credit_pack',
                  amount: Math.round(
                    parseFloat(data.amount_gross || '0') * 100
                  ), // cents
                  userId: user.id,
                },
              });
            }

            console.log(
              `Credit pack purchased: ${userEmail} → R${packPrice} (${creditsToAdd} credits)`
            );
          }
        } else if (paymentType === 'tokenization_setup') {
          // Tokenization setup - store token and create recurring schedule
          const tierFromCustom = data.custom_str2?.toUpperCase() || 'JIVE';
          const tierConfig = {
            JIVE: { monthlyCredits: 500000, imagesLimit: 200, price: 9900 }, // cents
            JIGGA: { monthlyCredits: 2000000, imagesLimit: 1000, price: 29900 },
          };
          const config =
            tierConfig[tierFromCustom as keyof typeof tierConfig] || tierConfig.JIVE;

          // Create/update subscription with token
          await prisma.subscription.upsert({
            where: { userId: user.id },
            update: {
              tier: tierFromCustom,
              status: 'active',
              payfastToken: data.token || null,
              startedAt: new Date(),
              nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              monthlyCredits: config.monthlyCredits,
              imagesLimit: config.imagesLimit,
              imagesUsed: 0,
              lastReset: new Date(),
            },
            create: {
              userId: user.id,
              tier: tierFromCustom,
              status: 'active',
              payfastToken: data.token || null,
              startedAt: new Date(),
              nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              credits: 0,
              creditsUsed: 0,
              monthlyCredits: config.monthlyCredits,
              imagesLimit: config.imagesLimit,
              imagesUsed: 0,
              lastReset: new Date(),
            },
          });

          // Create recurring schedule for programmatic billing
          if (data.token) {
            await prisma.recurringSchedule.create({
              data: {
                userId: user.id,
                tier: tierFromCustom,
                amount: config.price,
                token: data.token,
                frequency: 'monthly',
                nextChargeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                chargeCount: 1, // Initial payment already made
                maxCharges: 12, // 1 year
                status: 'active',
              },
            });
          }

          await prisma.authLog.create({
            data: {
              email: userEmail,
              action: 'tokenization_setup_complete',
              ip: clientIp,
              meta: JSON.stringify({ 
                tier: tierFromCustom, 
                pf_payment_id: data.pf_payment_id,
                has_token: !!data.token,
              }),
            },
          });

          console.log(`Tokenization setup complete: ${userEmail} → ${tierFromCustom} (token stored)`);
        } else {
          // Regular subscription purchase (PayFast auto-charges)
          const tierConfig = {
            JIVE: { monthlyCredits: 500000, imagesLimit: 200 },
            JIGGA: { monthlyCredits: 2000000, imagesLimit: 1000 },
          };
          const config =
            tierConfig[tier as keyof typeof tierConfig] || tierConfig.JIVE;

          await prisma.subscription.upsert({
            where: { userId: user.id },
            update: {
              tier,
              status: 'active',
              payfastToken: data.token || null,
              startedAt: new Date(),
              nextBilling: data.billing_date
                ? new Date(data.billing_date)
                : null,
              monthlyCredits: config.monthlyCredits,
              imagesLimit: config.imagesLimit,
              imagesUsed: 0,
              lastReset: new Date(),
            },
            create: {
              userId: user.id,
              tier,
              status: 'active',
              payfastToken: data.token || null,
              startedAt: new Date(),
              nextBilling: data.billing_date
                ? new Date(data.billing_date)
                : null,
              credits: 0,
              creditsUsed: 0,
              monthlyCredits: config.monthlyCredits,
              imagesLimit: config.imagesLimit,
              imagesUsed: 0,
              lastReset: new Date(),
            },
          });

          await prisma.authLog.create({
            data: {
              email: userEmail,
              action: 'subscription_activated',
              ip: clientIp,
              meta: JSON.stringify({ tier, pf_payment_id: data.pf_payment_id }),
            },
          });

          // Record payment as processed (idempotency)
          if (data.pf_payment_id) {
            await prisma.processedPayment.create({
              data: {
                pfPaymentId: data.pf_payment_id,
                type: 'subscription',
                amount: Math.round(parseFloat(data.amount_gross || '0') * 100), // cents
                userId: user.id,
              },
            });
          }

          console.log(`Subscription activated: ${userEmail} → ${tier}`);
        }
        break;

      case 'CANCELLED':
        await prisma.subscription.updateMany({
          where: { userId: user.id },
          data: {
            status: 'cancelled',
          },
        });

        await prisma.authLog.create({
          data: {
            email: userEmail,
            action: 'subscription_cancelled',
            ip: clientIp,
          },
        });

        // TODO: Send vcb_subscription_cancelled email
        console.log(`Subscription cancelled: ${userEmail}`);
        break;

      case 'FAILED':
        // Update subscription to past_due and track retry
        await prisma.subscription.updateMany({
          where: { userId: user.id },
          data: {
            status: 'past_due',
            paymentFailedAt: new Date(),
            retryCount: { increment: 1 },
          },
        });

        await prisma.authLog.create({
          data: {
            email: userEmail,
            action: 'payment_failed',
            ip: clientIp,
            meta: JSON.stringify({ reason: data.reason || 'unknown' }),
          },
        });

        // TODO: Send vcb_payment_failed email
        console.log(`Payment failed: ${userEmail}`);
        break;

      default:
        console.log(`PayFast ITN: Unknown status ${paymentStatus}`);
    }

    // PayFast expects 200 OK
    return new NextResponse('OK', { status: 200 });
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
