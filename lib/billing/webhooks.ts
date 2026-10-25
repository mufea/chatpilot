import {
  BillingInterval,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { grantCredits } from "@/lib/billing/credits";
import { BillingError } from "@/lib/billing/errors";
import {
  midtransFailure,
  midtransSuccess,
  type MidtransNotification,
  verifyMidtransSignature,
} from "@/lib/billing/midtrans";
import type { StripeEvent } from "@/lib/billing/stripe";

export type WebhookApplyResult = {
  duplicate: boolean;
  status: string;
};

async function claimWebhook(
  db: PrismaClient,
  input: { provider: string; eventId: string; eventType: string; digest: string },
) {
  const existing = await db.webhookEvent.findUnique({
    where: { provider_eventId: { provider: input.provider, eventId: input.eventId } },
  });
  if (existing) return { duplicate: true };
  try {
    await db.webhookEvent.create({
      data: {
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        payloadDigest: input.digest,
        status: "processing",
      },
    });
    return { duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { duplicate: true };
    }
    throw error;
  }
}

async function finishWebhook(db: PrismaClient, provider: string, eventId: string, status: string, errorMessage?: string) {
  await db.webhookEvent.update({
    where: { provider_eventId: { provider, eventId } },
    data: { status, processedAt: new Date(), errorMessage },
  });
}

async function activatePlan(
  db: PrismaClient,
  input: {
    organizationId: string;
    planCode: string;
    interval: BillingInterval;
    provider: PaymentProvider;
    providerCustomerId?: string | null;
    providerSubscriptionId?: string | null;
    amountCents: number;
    currency: string;
    providerPaymentId: string;
    eventId: string;
    periodStart?: Date;
    periodEnd?: Date;
  },
) {
  const plan = await db.plan.findUnique({ where: { code: input.planCode } });
  if (!plan || !plan.isActive) {
    throw new BillingError(`Plan ${input.planCode} is not available.`, 400, "plan_unavailable");
  }
  const now = new Date();
  const periodStart = input.periodStart ?? now;
  const periodEnd =
    input.periodEnd ??
    new Date(now.getTime() + (input.interval === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000);

  const subscription = await db.subscription.upsert({
    where: { organizationId: input.organizationId },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      billingInterval: input.interval,
      provider: input.provider,
      providerCustomerId: input.providerCustomerId ?? undefined,
      providerSubscriptionId: input.providerSubscriptionId ?? undefined,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
    create: {
      organizationId: input.organizationId,
      planId: plan.id,
      status: "ACTIVE",
      billingInterval: input.interval,
      provider: input.provider,
      providerCustomerId: input.providerCustomerId,
      providerSubscriptionId: input.providerSubscriptionId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  await db.payment.upsert({
    where: { idempotencyKey: `pay:${input.provider}:${input.eventId}` },
    update: { status: PaymentStatus.SUCCEEDED, failureReason: null },
    create: {
      organizationId: input.organizationId,
      subscriptionId: subscription.id,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      status: PaymentStatus.SUCCEEDED,
      amountCents: input.amountCents,
      currency: input.currency,
      idempotencyKey: `pay:${input.provider}:${input.eventId}`,
      rawEventId: input.eventId,
    },
  });

  if (plan.monthlyCredits > 0) {
    await grantCredits(db, {
      organizationId: input.organizationId,
      amount: plan.monthlyCredits,
      reason: `${plan.name} credits`,
      idempotencyKey: `grant:${input.provider}:${input.eventId}`,
      type: "PURCHASE",
    });
  }

  await writeAuditLog(db, {
    organizationId: input.organizationId,
    action: "billing.payment.succeeded",
    targetType: "subscription",
    targetId: subscription.id,
    metadata: { planCode: plan.code, provider: input.provider, eventId: input.eventId },
  });
}

async function failPayment(
  db: PrismaClient,
  input: {
    organizationId: string;
    provider: PaymentProvider;
    eventId: string;
    amountCents: number;
    currency: string;
    reason: string;
    providerPaymentId?: string;
  },
) {
  const subscription = await db.subscription.findUnique({ where: { organizationId: input.organizationId } });
  if (subscription) {
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: "PAST_DUE" },
    });
  }
  await db.payment.upsert({
    where: { idempotencyKey: `pay:${input.provider}:${input.eventId}` },
    update: { status: PaymentStatus.FAILED, failureReason: input.reason },
    create: {
      organizationId: input.organizationId,
      subscriptionId: subscription?.id,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      status: PaymentStatus.FAILED,
      amountCents: input.amountCents,
      currency: input.currency,
      idempotencyKey: `pay:${input.provider}:${input.eventId}`,
      rawEventId: input.eventId,
      failureReason: input.reason,
    },
  });
  await writeAuditLog(db, {
    organizationId: input.organizationId,
    action: "billing.payment.failed",
    targetType: "organization",
    targetId: input.organizationId,
    metadata: { provider: input.provider, eventId: input.eventId, reason: input.reason },
  });
}

export async function applyStripeEvent(db: PrismaClient, event: StripeEvent): Promise<WebhookApplyResult> {
  const claim = await claimWebhook(db, {
    provider: "stripe",
    eventId: event.id,
    eventType: event.type,
    digest: event.id,
  });
  if (claim.duplicate) {
    return { duplicate: true, status: "duplicate" };
  }
  try {
    const object = event.data.object;
    if (event.type === "checkout.session.completed") {
      const metadata = (object.metadata ?? {}) as Record<string, string>;
      const organizationId = metadata.organizationId || String(object.client_reference_id || "");
      const planCode = metadata.planCode;
      if (!organizationId || !planCode) {
        throw new BillingError("Stripe checkout metadata is missing organization or plan.", 400);
      }
      const amount = Number(object.amount_total ?? 0);
      await activatePlan(db, {
        organizationId,
        planCode,
        interval: metadata.interval === "YEARLY" ? "YEARLY" : "MONTHLY",
        provider: "STRIPE",
        providerCustomerId: typeof object.customer === "string" ? object.customer : null,
        providerSubscriptionId: typeof object.subscription === "string" ? object.subscription : null,
        amountCents: amount,
        currency: String(object.currency ?? "usd").toUpperCase(),
        providerPaymentId: String(object.payment_intent || object.id),
        eventId: event.id,
      });
    } else if (event.type === "invoice.payment_failed") {
      const metadata = ((object.subscription_details as { metadata?: Record<string, string> } | undefined)?.metadata ??
        (object.metadata as Record<string, string> | undefined) ??
        {}) as Record<string, string>;
      const organizationId = metadata.organizationId || "";
      if (!organizationId) {
        throw new BillingError("Failed invoice is missing organization metadata.", 400);
      }
      await failPayment(db, {
        organizationId,
        provider: "STRIPE",
        eventId: event.id,
        amountCents: Number(object.amount_due ?? 0),
        currency: String(object.currency ?? "usd").toUpperCase(),
        reason: String(object.last_finalization_error ?? "invoice.payment_failed"),
        providerPaymentId: typeof object.id === "string" ? object.id : event.id,
      });
    } else if (event.type === "customer.subscription.deleted") {
      const metadata = (object.metadata ?? {}) as Record<string, string>;
      const organizationId = metadata.organizationId;
      if (organizationId) {
        await db.subscription.updateMany({
          where: { organizationId },
          data: { status: "CANCELED", cancelAtPeriodEnd: false },
        });
      }
    }
    await finishWebhook(db, "stripe", event.id, "processed");
    return { duplicate: false, status: "processed" };
  } catch (error) {
    await finishWebhook(db, "stripe", event.id, "failed", error instanceof Error ? error.message : "failed");
    throw error;
  }
}

export async function applyMidtransNotification(
  db: PrismaClient,
  payload: MidtransNotification,
  options?: { verify?: boolean },
): Promise<WebhookApplyResult> {
  if (options?.verify !== false) {
    verifyMidtransSignature(payload);
  }
  const claim = await claimWebhook(db, {
    provider: "midtrans",
    eventId: payload.transaction_id || payload.order_id,
    eventType: payload.transaction_status,
    digest: payload.signature_key,
  });
  if (claim.duplicate) {
    return { duplicate: true, status: "duplicate" };
  }
  try {
    const [organizationId, planCode, interval] = payload.order_id.split(":");
    if (!organizationId || !planCode) {
      throw new BillingError("Midtrans order id must be organizationId:planCode:interval.", 400);
    }
    const amountCents = Math.round(Number(payload.gross_amount) * 100);
    if (midtransSuccess(payload.transaction_status, payload.fraud_status)) {
      await activatePlan(db, {
        organizationId,
        planCode,
        interval: interval === "YEARLY" ? "YEARLY" : "MONTHLY",
        provider: "MIDTRANS",
        amountCents,
        currency: "IDR",
        providerPaymentId: payload.transaction_id || payload.order_id,
        eventId: payload.transaction_id || payload.order_id,
      });
    } else if (midtransFailure(payload.transaction_status)) {
      await failPayment(db, {
        organizationId,
        provider: "MIDTRANS",
        eventId: payload.transaction_id || payload.order_id,
        amountCents,
        currency: "IDR",
        reason: payload.transaction_status,
        providerPaymentId: payload.transaction_id,
      });
    }
    await finishWebhook(db, "midtrans", payload.transaction_id || payload.order_id, "processed");
    return { duplicate: false, status: "processed" };
  } catch (error) {
    await finishWebhook(
      db,
      "midtrans",
      payload.transaction_id || payload.order_id,
      "failed",
      error instanceof Error ? error.message : "failed",
    );
    throw error;
  }
}

