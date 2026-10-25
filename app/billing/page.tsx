import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatPlanPrice } from "@/lib/plans";

export default async function BillingPage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: auth.activeOrganization.id },
    include: { plan: true },
  });
  const credits = await prisma.creditAccount.findUnique({
    where: { organizationId: auth.activeOrganization.id },
    include: { ledger: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Checkout, Stripe, and Midtrans webhooks are Phase 6. This screen shows the seeded plan
          and the credit ledger that already exists for your workspace.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Plan</dt>
            <dd className="font-medium">{subscription?.plan.name ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="font-medium">{subscription?.status ?? "n/a"}</dd>
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
