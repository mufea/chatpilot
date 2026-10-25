import { OrganizationRole, type PrismaClient } from "@prisma/client";
import { appConfig } from "@/lib/config";
import { writeAuditLog } from "@/lib/audit";
import { BillingError } from "@/lib/billing/errors";
import { createMidtransSnap, isMidtransConfigured } from "@/lib/billing/midtrans";
import { createStripeCheckoutSession, isStripeConfigured } from "@/lib/billing/stripe";
import { requireMembership } from "@/lib/org/service";

export function billingProviderStatus() {
  return {
    stripeConfigured: isStripeConfigured(),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    midtransConfigured: isMidtransConfigured(),
    liveVerified: false,
  };
}

export async function listActivePlans(db: PrismaClient) {
  return db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function startCheckout(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    actorEmail: string;
    planCode: string;
    interval: "MONTHLY" | "YEARLY";
    provider: "STRIPE" | "MIDTRANS";
    fetchImpl?: typeof fetch;
  },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const plan = await db.plan.findUnique({ where: { code: input.planCode } });
  if (!plan || !plan.isActive || plan.code === "FREE") {
    throw new BillingError("Choose a paid plan to start checkout.");
  }
  const amountCents = input.interval === "YEARLY" ? plan.yearlyPriceCents : plan.monthlyPriceCents;
  if (amountCents <= 0) {
    throw new BillingError("That plan has no paid price configured.");
  }

  await writeAuditLog(db, {
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: "billing.checkout.started",
    targetType: "plan",
    targetId: plan.id,
    metadata: { provider: input.provider, interval: input.interval, configured: true },
  });

  if (input.provider === "STRIPE") {
    const priceId = input.interval === "YEARLY" ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId;
    return createStripeCheckoutSession({
      organizationId: input.organizationId,
      planCode: plan.code,
      planName: plan.name,
      interval: input.interval,
      amountCents,
      currency: plan.currency,
      successUrl: `${appConfig.appUrl}/billing?checkout=success`,
      cancelUrl: `${appConfig.appUrl}/billing?checkout=cancel`,
      customerEmail: input.actorEmail,
      stripePriceId: priceId,
      fetchImpl: input.fetchImpl,
    });
  }

  const orderId = `${input.organizationId}:${plan.code}:${input.interval}:${Date.now()}`;
  return createMidtransSnap({
    orderId,
    amountCents,
    planName: plan.name,
    customerEmail: input.actorEmail,
    organizationId: input.organizationId,
    planCode: plan.code,
    fetchImpl: input.fetchImpl,
  });
}

export async function listOrganizationPayments(db: PrismaClient, organizationId: string) {
  return db.payment.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}
