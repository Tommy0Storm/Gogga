import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        Subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch recent vouchers redeemed by this user
    let recentVouchers: {
      code: string;
      type: string;
      redeemedAt: Date | null;
    }[] = [];
    try {
      recentVouchers = await prisma.voucher.findMany({
        where: { redeemedBy: email },
        select: {
          code: true,
          type: true,
          redeemedAt: true,
        },
        orderBy: { redeemedAt: "desc" },
        take: 10,
      });
    } catch {
      // Voucher table might not exist
    }

    // Fetch recent auth logs
    const recentAuth = await prisma.authLog.findMany({
      where: { email },
      select: {
        action: true,
        ip: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      isAdmin: (user as { isAdmin?: boolean }).isAdmin || false,
      subscription: user.Subscription
        ? {
            tier: user.Subscription.tier,
            status: user.Subscription.status,
            credits: user.Subscription.credits,
            creditsUsed: user.Subscription.creditsUsed,
            monthlyCredits: user.Subscription.monthlyCredits,
            imagesUsed: user.Subscription.imagesUsed,
            imagesLimit: user.Subscription.imagesLimit,
            startedAt: user.Subscription.startedAt?.toISOString() || null,
            nextBilling: user.Subscription.nextBilling?.toISOString() || null,
            payfastToken: user.Subscription.payfastToken,
          }
        : null,
      recentVouchers: recentVouchers.map((v) => ({
        code: v.code,
        type: v.type,
        redeemedAt: v.redeemedAt?.toISOString() || "",
      })),
      recentAuth: recentAuth.map((a) => ({
        action: a.action,
        ip: a.ip,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("User lookup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
