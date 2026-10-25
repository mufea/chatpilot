import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { applyMidtransNotification } from "@/lib/billing/webhooks";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid Midtrans notification." }, { status: 400 });
  }
  try {
    const result = await applyMidtransNotification(prisma, payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Notification processing failed." }, { status: 500 });
  }
}
