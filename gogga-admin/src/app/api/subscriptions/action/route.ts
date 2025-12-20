import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface ActionRequest {
  userId: string;
  action: string;
  tier?: string;
  credits?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ActionRequest = await request.json();
    const { userId, action, tier, credits } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: "userId and action required" },
        { status: 400 }
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { User: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    switch (action) {
      case "override_tier":
        if (!tier || !["FREE", "JIVE", "JIGGA"].includes(tier)) {
          return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
        }

        // Log subscription event
        try {
          await prisma.subscriptionEvent.create({
            data: {
              subscriptionId: subscription.id,
              userId,
              event: "admin_override",
              fromTier: subscription.tier,
              toTier: tier,
              actor: "admin@vcb-ai.online",
              meta: JSON.stringify({ reason: "Admin override" }),
            },
          });
        } catch {
          // SubscriptionEvent table might not exist
        }

        await prisma.subscription.update({
          where: { userId },
          data: {
            tier,
            status: "active",
            monthlyCredits:
              tier === "JIGGA" ? 500000 : tier === "JIVE" ? 200000 : 0,
            imagesLimit: tier === "JIGGA" ? 1000 : tier === "JIVE" ? 200 : 50,
          },
        });
        break;

      case "grant_credits":
        if (!credits || credits <= 0) {
          return NextResponse.json(
            { error: "Invalid credits" },
            { status: 400 }
          );
        }
        await prisma.subscription.update({
          where: { userId },
          data: {
            credits: { increment: credits },
          },
        });
        break;

      case "reset_monthly":
        await prisma.subscription.update({
          where: { userId },
          data: {
            creditsUsed: 0,
            imagesUsed: 0,
            lastReset: new Date(),
          },
        });
        break;

      case "cancel":
        // If PayFast token exists, should also cancel with PayFast
        // For now just update local status
        await prisma.subscription.update({
          where: { userId },
          data: {
            status: "cancelled",
            tier: "FREE",
            payfastToken: null,
          },
        });

        try {
          await prisma.subscriptionEvent.create({
            data: {
              subscriptionId: subscription.id,
              userId,
              event: "cancelled",
              fromTier: subscription.tier,
              toTier: "FREE",
              actor: "admin@vcb-ai.online",
            },
          });
        } catch {
          // Ignore if table doesn't exist
        }
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Log admin action
    try {
      await prisma.adminLog.create({
        data: {
          adminEmail: "admin@vcb-ai.online",
          action: `subscription_${action}`,
          targetUser: subscription.User.email,
          targetId: subscription.id,
          meta: JSON.stringify({ tier, credits }),
        },
      });
    } catch {
      // Ignore if table doesn't exist
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
