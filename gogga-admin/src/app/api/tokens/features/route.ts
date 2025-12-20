/**
 * GOGGA Admin - Feature Costs API
 * GET: List all feature costs
 * PUT: Update feature cost
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const features = await prisma.featureCost.findMany({
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json({ features });
  } catch (error) {
    console.error("Failed to fetch feature costs:", error);
    return NextResponse.json(
      { error: "Failed to fetch feature costs" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, costAmountUSD, tierOverrides, isBillable, cepoMultiplier } =
      body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Get old values for audit
    const oldFeature = await prisma.featureCost.findUnique({ where: { id } });
    if (!oldFeature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    // Update feature
    const updated = await prisma.featureCost.update({
      where: { id },
      data: {
        ...(costAmountUSD !== undefined && { costAmountUSD }),
        ...(tierOverrides !== undefined && { tierOverrides }),
        ...(isBillable !== undefined && { isBillable }),
        ...(cepoMultiplier !== undefined && { cepoMultiplier }),
      },
    });

    // Create audit log
    await prisma.pricingAudit.create({
      data: {
        tableName: "FeatureCost",
        recordId: id,
        action: "UPDATE",
        previousValues: JSON.stringify({
          costAmountUSD: oldFeature.costAmountUSD,
          isBillable: oldFeature.isBillable,
        }),
        newValues: JSON.stringify({
          costAmountUSD: updated.costAmountUSD,
          isBillable: updated.isBillable,
        }),
        changedBy: "admin", // TODO: Get from session
      },
    });

    return NextResponse.json({ feature: updated });
  } catch (error) {
    console.error("Failed to update feature cost:", error);
    return NextResponse.json(
      { error: "Failed to update feature cost" },
      { status: 500 }
    );
  }
}
