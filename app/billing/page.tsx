import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { getCurrentAuth } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/entitlements";
import { billingProviderStatus, listActivePlans, listOrganizationPayments } from "@/lib/billing/service";
import { prisma } from "@/lib/db";
import { formatPlanPrice } from "@/lib/plans";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const organizationId = auth.activeOrganization.id;
  const [{ checkout }, entitlements, subscription, credits, payments, plans] = await Promise.all([
    searchParams,
    getEntitlements(prisma, organizationId),
    prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    }),
    prisma.creditAccount.findUnique({
      where: { organizationId },
      include: { ledger: { orderBy: { createdAt: "desc" }, take: 12 } },
    }),
    listOrganizationPayments(prisma, organizationId),
    listActivePlans(prisma),
  ]);
  const providers = billingProviderStatus();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entitlements are enforced on the server. A browser redirect never upgrades a plan. Credits
          move through an atomic ledger with idempotent keys.
        </p>
        {checkout === "success" ? (
          <p className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            Checkout returned here. The plan changes only after a verified webhook is stored.
          </p>
        ) : null}
        {checkout === "cancel" ? (
          <p className="mt-3 rounded-xl border px-3 py-2 text-sm text-muted-foreground">
            Checkout was canceled. Nothing was charged and the plan is unchanged.
          </p>
        ) : null}
        <dl className="mt-6 grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Plan</dt>
            <dd className="font-medium">{subscription?.plan.name ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="font-medium">{subscription?.status ?? "n/a"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Messages this period</dt>
            <dd className="font-medium">
              {entitlements.messagesUsed} / {entitlements.limits.monthlyMessages}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Monthly price</dt>
            <dd className="font-medium">
              {subscription
                ? formatPlanPrice(subscription.plan.monthlyPriceCents, subscription.plan.currency)
                : "n/a"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Upgrade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live payment capture is not claimed unless Stripe or Midtrans keys exist and a signed
            webhook is processed. Failed payments mark the subscription past due and grant no credits.
          </p>
          <div className="mt-4">
            <CheckoutForm
              plans={plans.map((plan) => ({
                code: plan.code,
                name: plan.name,
                monthlyPriceCents: plan.monthlyPriceCents,
                yearlyPriceCents: plan.yearlyPriceCents,
              }))}
              stripeConfigured={providers.stripeConfigured}
              midtransConfigured={providers.midtransConfigured}
            />
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Payments</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {payments.length ? (
              payments.map((payment) => (
                <li key={payment.id} className="flex justify-between rounded-lg bg-muted px-3 py-2">
                  <span>
                    {payment.provider} · {payment.status}
                    {payment.failureReason ? ` · ${payment.failureReason}` : ""}
                  </span>
                  <span>{(payment.amountCents / 100).toFixed(2)}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No verified payments yet.</li>
            )}
          </ul>
        </section>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Credit ledger</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Balance {credits?.balance ?? 0} · granted {credits?.lifetimeGranted ?? 0} · used{" "}
          {credits?.lifetimeUsed ?? 0}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {credits?.ledger.length ? (
            credits.ledger.map((entry) => (
              <li key={entry.id} className="flex justify-between rounded-lg bg-muted px-3 py-2">
                <span>
                  {entry.type} · {entry.reason}
                </span>
                <span>
                  {entry.amount} → {entry.balanceAfter}
                </span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No ledger entries yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
