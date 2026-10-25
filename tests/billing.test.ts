import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { registerUser } from "../lib/auth/service";
import { getOrganizationAnalytics } from "../lib/analytics/service";
import { grantCredits } from "../lib/billing/credits";
import { assertCanUseAi, getEntitlements } from "../lib/billing/entitlements";
import { BillingError } from "../lib/billing/errors";
import { signMidtransNotification, verifyMidtransSignature } from "../lib/billing/midtrans";
import { signStripePayload, verifyStripeSignature } from "../lib/billing/stripe";
import { startCheckout } from "../lib/billing/service";
import { applyMidtransNotification, applyStripeEvent } from "../lib/billing/webhooks";
import { reserveCredits, CreditError } from "../lib/ai/credits";
import { updatePlan, listPlans } from "../lib/admin/service";
import { PlatformRole } from "@prisma/client";
import { ensureDefaultPlans } from "../lib/org/service";
import { resetDb, testDb } from "./helpers";

const db = testDb();
const STRIPE_SECRET = "whsec_test_chatpilot";
const MIDTRANS_KEY = "midtrans-server-test";

before(async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
  process.env.MIDTRANS_SERVER_KEY = MIDTRANS_KEY;
});

after(async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.MIDTRANS_SERVER_KEY;
  await db.$disconnect();
});

async function workspace(email: string, name: string) {
  return registerUser(db, {
    name,
    email,
    password: "ValidPass1",
    organizationName: name,
  });
}

test("rejects tampered Stripe signatures and accepts a valid signed event", () => {
  const body = JSON.stringify({ id: "evt_sig", type: "ping", data: { object: {} } });
  const header = signStripePayload(body, STRIPE_SECRET, Math.floor(Date.now() / 1000));
  const event = verifyStripeSignature(body, header, STRIPE_SECRET);
  assert.equal(event.id, "evt_sig");
  assert.throws(
    () => verifyStripeSignature(body.replace("ping", "pong"), header, STRIPE_SECRET),
    /Invalid Stripe signature/,
  );
});

test("duplicate Stripe webhooks grant credits once and activate the plan", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("bill-dup@example.com", "Dup Org");
  const before = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  const event = {
    id: "evt_dup_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_dup",
        client_reference_id: owner.organization.id,
        amount_total: 3900,
        currency: "usd",
        customer: "cus_dup",
        subscription: "sub_dup",
        payment_intent: "pi_dup",
        metadata: { organizationId: owner.organization.id, planCode: "STARTER", interval: "MONTHLY" },
      },
    },
  };
  const first = await applyStripeEvent(db, event);
  const second = await applyStripeEvent(db, event);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  const payments = await db.payment.findMany({ where: { organizationId: owner.organization.id } });
  assert.equal(payments.length, 1);
  assert.equal(payments[0]?.status, "SUCCEEDED");
  const after = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  assert.equal((after?.balance ?? 0) - (before?.balance ?? 0), 3000);
  const entitlements = await getEntitlements(db, owner.organization.id);
  assert.equal(entitlements.planCode, "STARTER");
  assert.equal(entitlements.status, "ACTIVE");
  assert.equal(entitlements.canUseAi, true);
});

test("failed payments mark the subscription past due and do not grant credits", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("bill-fail@example.com", "Fail Org");
  const before = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  await applyStripeEvent(db, {
    id: "evt_fail_1",
    type: "invoice.payment_failed",
    data: {
      object: {
        id: "in_fail",
        amount_due: 3900,
        currency: "usd",
        metadata: { organizationId: owner.organization.id },
      },
    },
  });
  const subscription = await db.subscription.findUnique({ where: { organizationId: owner.organization.id } });
  assert.equal(subscription?.status, "PAST_DUE");
  const payment = await db.payment.findFirst({ where: { organizationId: owner.organization.id } });
  assert.equal(payment?.status, "FAILED");
  const after = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  assert.equal(after?.balance, before?.balance);
});

test("canceled subscriptions lose AI entitlement", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("bill-cancel@example.com", "Cancel Org");
  await applyStripeEvent(db, {
    id: "evt_cancel_1",
    type: "customer.subscription.deleted",
    data: { object: { metadata: { organizationId: owner.organization.id } } },
  });
  await assert.rejects(() => assertCanUseAi(db, owner.organization.id), /cannot use AI/);
});

test("Midtrans settlement and failure are signature-checked and isolated by tenant", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const alpha = await workspace("bill-mt-a@example.com", "Midtrans A");
  const beta = await workspace("bill-mt-b@example.com", "Midtrans B");
  const base = {
    order_id: `${alpha.organization.id}:PRO:MONTHLY`,
    status_code: "200",
    gross_amount: "990.00",
    transaction_status: "settlement",
    transaction_id: "mt_tx_1",
  };
  const payload = { ...base, signature_key: signMidtransNotification(base, MIDTRANS_KEY) };
  verifyMidtransSignature(payload, MIDTRANS_KEY);
  await applyMidtransNotification(db, payload, { verify: true });
  const alphaEnt = await getEntitlements(db, alpha.organization.id);
  const betaEnt = await getEntitlements(db, beta.organization.id);
  assert.equal(alphaEnt.planCode, "PRO");
  assert.equal(betaEnt.planCode, "FREE");
  const betaPayments = await db.payment.findMany({ where: { organizationId: beta.organization.id } });
  assert.equal(betaPayments.length, 0);

  const failBase = {
    order_id: `${beta.organization.id}:STARTER:MONTHLY`,
    status_code: "202",
    gross_amount: "390.00",
    transaction_status: "deny",
    transaction_id: "mt_tx_fail",
  };
  await applyMidtransNotification(
    db,
    { ...failBase, signature_key: signMidtransNotification(failBase, MIDTRANS_KEY) },
    { verify: true },
  );
  const betaAfter = await getEntitlements(db, beta.organization.id);
  assert.equal(betaAfter.status, "PAST_DUE");
  assert.equal(betaAfter.planCode, "FREE");
});

test("monthly message entitlements and analytics stay on one tenant", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const alpha = await workspace("bill-an-a@example.com", "Analytics A");
  const beta = await workspace("bill-an-b@example.com", "Analytics B");
  await db.plan.update({
    where: { code: "FREE" },
    data: { limits: { chatbots: 1, knowledgeBases: 1, monthlyMessages: 1, teamMembers: 1, documentsPerKnowledgeBase: 5 } },
  });
  await db.usageRecord.create({
    data: {
      organizationId: alpha.organization.id,
      provider: "mock",
      model: "mock-chat",
      inputTokens: 10,
      outputTokens: 10,
      credits: 1,
      requestId: "usage-a-1",
    },
  });
  await assert.rejects(() => assertCanUseAi(db, alpha.organization.id), /monthly message limit/);
  await assertCanUseAi(db, beta.organization.id);
  const alphaUsage = await getOrganizationAnalytics(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
  });
  const betaUsage = await getOrganizationAnalytics(db, {
    organizationId: beta.organization.id,
    actorUserId: beta.user.id,
  });
  assert.equal(alphaUsage.totals.messages, 1);
  assert.equal(betaUsage.totals.messages, 0);
  await assert.rejects(
    () =>
      getOrganizationAnalytics(db, {
        organizationId: alpha.organization.id,
        actorUserId: beta.user.id,
      }),
    /do not have access/,
  );
});

test("concurrent credit grants with the same idempotency key apply once", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("bill-conc@example.com", "Concurrent Org");
  const before = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      grantCredits(db, {
        organizationId: owner.organization.id,
        amount: 50,
        reason: "Idempotent grant",
        idempotencyKey: "grant:same-key",
      }),
    ),
  );
  assert.equal(results.filter((item) => !item.duplicate).length, 1);
  const after = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  assert.equal((after?.balance ?? 0) - (before?.balance ?? 0), 50);
});

test("concurrent reservations still serialize against the ledger", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("bill-res@example.com", "Reserve Org");
  await db.creditAccount.update({
    where: { organizationId: owner.organization.id },
    data: { balance: 2, lifetimeUsed: 0 },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, index) => reserveCredits(db, owner.organization.id, `bill-res-${index}`, 1)),
  );
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 2);
  assert.ok(results.some((item) => item.status === "rejected" && item.reason instanceof CreditError));
});

test("checkout fails closed when Stripe is not configured", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("bill-nocheckout@example.com", "No Checkout Org");
  const previous = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    await assert.rejects(
      () =>
        startCheckout(db, {
          organizationId: owner.organization.id,
          actorUserId: owner.user.id,
          actorEmail: owner.user.email,
          planCode: "STARTER",
          interval: "MONTHLY",
          provider: "STRIPE",
        }),
      (error: unknown) => error instanceof BillingError && error.code === "not_configured",
    );
  } finally {
    if (previous) process.env.STRIPE_SECRET_KEY = previous;
  }
});

test("only platform admins can edit plans", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const user = await workspace("bill-admin@example.com", "Admin Plan Org");
  const plans = await db.plan.findMany();
  await assert.rejects(
    () =>
      updatePlan(db, {
        actorUserId: user.user.id,
        actorRole: PlatformRole.USER,
        planId: plans[0]!.id,
        name: "Hacked",
        description: "nope",
        monthlyPriceCents: 1,
        yearlyPriceCents: 1,
        monthlyCredits: 1,
        isActive: true,
        limits: { chatbots: 99, knowledgeBases: 99, monthlyMessages: 99, teamMembers: 99, documentsPerKnowledgeBase: 99 },
      }),
    /administrator/,
  );
  await db.user.update({ where: { id: user.user.id }, data: { platformRole: PlatformRole.SUPER_ADMIN } });
  const updated = await updatePlan(db, {
    actorUserId: user.user.id,
    actorRole: PlatformRole.SUPER_ADMIN,
    planId: plans.find((item) => item.code === "STARTER")!.id,
    name: "Starter Plus",
    description: "Edited by admin",
    monthlyPriceCents: 4900,
    yearlyPriceCents: 49000,
    monthlyCredits: 4000,
    isActive: true,
    limits: { chatbots: 4, knowledgeBases: 4, monthlyMessages: 4000, teamMembers: 4, documentsPerKnowledgeBase: 40 },
  });
  assert.equal(updated.name, "Starter Plus");
  const listed = await listPlans(db, PlatformRole.SUPER_ADMIN);
  assert.equal(listed.find((item) => item.code === "STARTER")?.monthlyCredits, 4000);
});
