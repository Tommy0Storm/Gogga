import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface ActionRequest {
  userId: string;
  action: string;
  tier?: string;
  credits?: number;
}

// Admin email check (simple version - should be enhanced with proper auth)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim());

export async function POST(request: NextRequest) {
  try {
    const body: ActionRequest = await request.json();
    const { userId, action, tier, credits } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 });
    }

    // Find user first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Handle actions
    switch (action) {
      case 'override_tier':
        if (!tier || !['FREE', 'JIVE', 'JIGGA'].includes(tier)) {
          return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        }
        if (user.subscription) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              tier,
              status: 'active',
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.subscription.create({
            data: {
              userId,
              tier,
              status: 'active',
              monthlyCredits: tier === 'JIGGA' ? 500000 : tier === 'JIVE' ? 200000 : 0,
              imagesLimit: tier === 'JIGGA' ? 1000 : tier === 'JIVE' ? 200 : 50,
            },
          });
        }
        // Log admin action
        await logAdminAction('subscription_override', user.email, { fromTier: user.subscription?.tier, toTier: tier });
        break;

      case 'grant_credits':
        if (!credits || credits <= 0) {
          return NextResponse.json({ error: 'Invalid credits amount' }, { status: 400 });
        }
        if (user.subscription) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              credits: { increment: credits },
            },
          });
        }
        await logAdminAction('credits_granted', user.email, { credits });
        break;

      case 'reset_monthly':
        if (user.subscription) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              creditsUsed: 0,
              imagesUsed: 0,
              lastReset: new Date(),
            },
          });
        }
        await logAdminAction('monthly_reset', user.email);
        break;

      case 'cancel_subscription':
        if (user.subscription) {
          // If there's a PayFast token, we should also cancel with PayFast
          // For now just update local status
          await prisma.subscription.update({
            where: { userId },
            data: {
              status: 'cancelled',
              tier: 'FREE',
              payfastToken: null,
            },
          });
        }
        await logAdminAction('subscription_cancelled', user.email);
        break;

      case 'toggle_admin':
        await prisma.user.update({
          where: { id: userId },
          data: {
            // TypeScript doesn't know about isAdmin yet, use raw update
          },
        });
        // Use raw SQL since isAdmin might not be in generated types yet
        await prisma.$executeRaw`UPDATE User SET isAdmin = NOT isAdmin WHERE id = ${userId}`;
        await logAdminAction('admin_toggle', user.email);
        break;

      case 'send_login_email':
        // Would need to integrate with email service
        await logAdminAction('login_email_sent', user.email);
        return NextResponse.json({ message: 'Login email would be sent (not implemented)' });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('User action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function logAdminAction(
  action: string,
  targetUser: string,
  meta?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminEmail: 'admin@vcb-ai.online', // Should come from session
        action,
        targetUser,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch {
    // AdminLog table might not exist yet
    console.log('Admin action logged:', action, targetUser, meta);
  }
}
