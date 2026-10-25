import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { verifyStripeSignature } from "@/lib/billing/stripe";
import { applyStripeEvent } from "@/lib/billing/webhooks";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const event = verifyStripeSignature(rawBody, request.headers.get("stripe-signature"));
    const result = await applyStripeEvent(prisma, event);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
