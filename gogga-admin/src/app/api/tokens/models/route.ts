/**
 * GOGGA Admin - Model Pricing API
 * GET: List all model pricing
 * PUT: Update model pricing
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const models = await prisma.modelPricing.findMany({
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Failed to fetch model pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch model pricing" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      inputPricePerM,
      outputPricePerM,
      imagePricePerUnit,
      allowedTiers,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Get old values for audit
    const oldModel = await prisma.modelPricing.findUnique({ where: { id } });
    if (!oldModel) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Update model
    const updated = await prisma.modelPricing.update({
      where: { id },
      data: {
        ...(inputPricePerM !== undefined && { inputPricePerM }),
        ...(outputPricePerM !== undefined && { outputPricePerM }),
        ...(imagePricePerUnit !== undefined && { imagePricePerUnit }),
        ...(allowedTiers !== undefined && { allowedTiers }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Create audit log
    await prisma.pricingAudit.create({
      data: {
        tableName: "ModelPricing",
        recordId: id,
        action: "UPDATE",
        previousValues: JSON.stringify({
          inputPricePerM: oldModel.inputPricePerM,
          outputPricePerM: oldModel.outputPricePerM,
          isActive: oldModel.isActive,
        }),
        newValues: JSON.stringify({
          inputPricePerM: updated.inputPricePerM,
          outputPricePerM: updated.outputPricePerM,
          isActive: updated.isActive,
        }),
        changedBy: "admin", // TODO: Get from session
      },
    });

    return NextResponse.json({ model: updated });
  } catch (error) {
    console.error("Failed to update model pricing:", error);
    return NextResponse.json(
      { error: "Failed to update model pricing" },
      { status: 500 }
    );
  }
}
