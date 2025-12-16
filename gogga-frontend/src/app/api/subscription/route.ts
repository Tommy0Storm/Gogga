/**
 * GOGGA - Subscription API Route
 * 
 * GET /api/subscription
 * 
 * Returns current user's subscription details including tier, credits, and usage.
 * 
 * Supports two auth modes:
 * 1. Session-based (for frontend): Uses NextAuth session
 * 2. Internal API key (for backend): Uses Authorization header with INTERNAL_API_KEY + email param
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * Subscription API response structure
 */
interface SubscriptionResponse {
  email: string;
  tier: string;
  status: string;
  credits: {
    total: number;
    used: number;
    available: number;
    purchased: number;
    monthly: number;
  };
  images: {
    used: number;
    limit: number;
  };
  nextBilling: Date | null;
  payfastToken: boolean;
}

export async function GET(request: NextRequest) {
  try {
    let userEmail: string | null = null

    // Check for internal API key (backend-to-frontend verification)
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY || 'dev-internal-key-change-in-production'
    
    if (authHeader === `Bearer ${expectedKey}`) {
      // Internal API call - get email from query param
      userEmail = request.nextUrl.searchParams.get('email');
      if (!userEmail) {
        return NextResponse.json(
          { error: 'Email parameter required for internal API' },
          { status: 400 }
        );
      }
    } else {
      // Session-based auth (frontend)
      const session = await auth();
      userEmail = session?.user?.email ?? null;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user with subscription
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        Subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract subscription data with proper null handling
    const sub = user.Subscription;

    // Build response with proper defaults
    const credits = sub?.credits ?? 0;
    const creditsUsed = sub?.creditsUsed ?? 0;
    const monthlyCredits = sub?.monthlyCredits ?? 0;
    const totalCredits = credits + monthlyCredits;
    const availableCredits = totalCredits - creditsUsed;

    const response: SubscriptionResponse = {
      email: user.email,
      tier: sub?.tier ?? 'FREE',
      status: sub?.status ?? 'active',
      credits: {
        total: totalCredits,
        used: creditsUsed,
        available: availableCredits,
        purchased: credits,
        monthly: monthlyCredits,
      },
      images: {
        used: sub?.imagesUsed ?? 0,
        limit: sub?.imagesLimit ?? 0,
      },
      nextBilling: sub?.nextBilling ?? null,
      payfastToken: Boolean(sub?.payfastToken),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Subscription API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
