import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/usage
 * Returns comprehensive usage statistics for admin dashboard
 * Includes token usage, tool usage, and tier breakdown
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month"; // today, week, month, year, all

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "all":
      default:
        startDate = new Date(0);
    }

    // Get token usage aggregated by tier
    const tokenUsageByTier = await prisma.usage.groupBy({
      by: ["tier"],
      where: {
        createdAt: { gte: startDate },
      },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costCents: true,
      },
      _count: true,
    });

    // Get token usage totals
    const tokenTotals = await prisma.usage.aggregate({
      where: {
        createdAt: { gte: startDate },
      },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costCents: true,
      },
      _count: true,
    });

    // Get tool usage (if ToolUsage model exists and has data)
    let toolUsage: {
      toolName: string;
      callCount: number;
      successRate: number;
      avgDurationMs: number;
    }[] = [];
    try {
      const toolStats = await prisma.toolUsage.groupBy({
        by: ["toolName"],
        where: {
          date: { gte: startDate },
        },
        _sum: {
          callCount: true,
          successCount: true,
          failureCount: true,
          totalDurationMs: true,
        },
      });

      toolUsage = toolStats
        .map(
          (stat: {
            toolName: string;
            _sum: {
              callCount: number | null;
              successCount: number | null;
              failureCount: number | null;
              totalDurationMs: number | null;
            };
          }) => ({
            toolName: stat.toolName,
            callCount: stat._sum.callCount || 0,
            successRate: stat._sum.callCount
              ? Math.round(
                  ((stat._sum.successCount || 0) / stat._sum.callCount) * 100
                )
              : 0,
            avgDurationMs: stat._sum.callCount
              ? Math.round(
                  (stat._sum.totalDurationMs || 0) / stat._sum.callCount
                )
              : 0,
          })
        )
        .sort(
          (a: { callCount: number }, b: { callCount: number }) =>
            b.callCount - a.callCount
        );
    } catch {
      // ToolUsage table might not exist yet
      toolUsage = [];
    }

    // Get usage by provider
    const usageByProvider = await prisma.usage.groupBy({
      by: ["provider"],
      where: {
        createdAt: { gte: startDate },
      },
      _sum: {
        totalTokens: true,
        costCents: true,
      },
      _count: true,
    });

    // Get daily usage trend (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyUsageRaw = await prisma.$queryRaw<
      { date: string; totalTokens: number; requestCount: number }[]
    >`
      SELECT 
        date(createdAt) as date,
        SUM(totalTokens) as totalTokens,
        COUNT(*) as requestCount
      FROM Usage
      WHERE createdAt >= ${thirtyDaysAgo.toISOString()}
      GROUP BY date(createdAt)
      ORDER BY date DESC
      LIMIT 30
    `;

    // Get active users count
    const activeUsers = await prisma.usage.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: startDate },
      },
    });

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),

      // Token totals
      totals: {
        totalTokens: tokenTotals._sum.totalTokens || 0,
        promptTokens: tokenTotals._sum.promptTokens || 0,
        completionTokens: tokenTotals._sum.completionTokens || 0,
        costCents: tokenTotals._sum.costCents || 0,
        costZar: (((tokenTotals._sum.costCents || 0) / 100) * 18.5).toFixed(2), // Approx USD to ZAR
        requestCount: tokenTotals._count,
        activeUsers: activeUsers.length,
      },

      // Breakdown by tier
      byTier: tokenUsageByTier.map((tier) => ({
        tier: tier.tier,
        totalTokens: tier._sum.totalTokens || 0,
        promptTokens: tier._sum.promptTokens || 0,
        completionTokens: tier._sum.completionTokens || 0,
        costCents: tier._sum.costCents || 0,
        requestCount: tier._count,
      })),

      // Breakdown by provider
      byProvider: usageByProvider.map((provider) => ({
        provider: provider.provider,
        totalTokens: provider._sum.totalTokens || 0,
        costCents: provider._sum.costCents || 0,
        requestCount: provider._count,
      })),

      // Tool usage analytics
      toolUsage,

      // Daily trend
      dailyTrend: dailyUsageRaw.map((d) => ({
        date: d.date,
        totalTokens: Number(d.totalTokens),
        requestCount: Number(d.requestCount),
      })),
    });
  } catch (error) {
    console.error("Failed to load usage stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/usage/tool
 * Records a tool usage event (called by frontend/backend)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { toolName, tier, success, durationMs, userId } = body;

    if (!toolName || !tier) {
      return NextResponse.json(
        { error: "toolName and tier are required" },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build update object conditionally to avoid undefined values (Prisma 7 exactOptionalPropertyTypes)
    const updateData: Record<string, { increment: number }> = {
      callCount: { increment: 1 },
    };
    if (success) updateData.successCount = { increment: 1 };
    if (!success) updateData.failureCount = { increment: 1 };
    if (durationMs) updateData.totalDurationMs = { increment: durationMs };
    if (userId) updateData.uniqueUsers = { increment: 1 };

    // Upsert tool usage record for today/tool/tier
    await prisma.toolUsage.upsert({
      where: {
        date_toolName_tier: {
          date: today,
          toolName,
          tier,
        },
      },
      update: updateData,
      create: {
        date: today,
        toolName,
        tier,
        callCount: 1,
        successCount: success ? 1 : 0,
        failureCount: success ? 0 : 1,
        totalDurationMs: durationMs || 0,
        avgDurationMs: durationMs || 0,
        uniqueUsers: userId ? 1 : 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record tool usage:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
