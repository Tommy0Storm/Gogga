/**
 * GOGGA Admin - Exchange Rates API
 * GET: List all exchange rates
 * PUT: Update exchange rate
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }],
    });

    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Failed to fetch exchange rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, rate } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Get old values for audit
    const oldRate = await prisma.exchangeRate.findUnique({ where: { id } });
    if (!oldRate) {
      return NextResponse.json(
        { error: "Exchange rate not found" },
        { status: 404 }
      );
    }

    // Update exchange rate
    const updated = await prisma.exchangeRate.update({
      where: { id },
      data: {
        ...(rate !== undefined && { rate }),
      },
    });

    // Create audit log
    await prisma.pricingAudit.create({
      data: {
        tableName: "ExchangeRate",
        recordId: id,
        action: "UPDATE",
        previousValues: JSON.stringify({
          rate: oldRate.rate,
        }),
        newValues: JSON.stringify({
          rate: updated.rate,
        }),
        changedBy: "admin", // TODO: Get from session
      },
    });

    return NextResponse.json({ rate: updated });
  } catch (error) {
    console.error("Failed to update exchange rate:", error);
    return NextResponse.json(
      { error: "Failed to update exchange rate" },
      { status: 500 }
    );
  }
}
