import { PlatformRole } from "@prisma/client";
import { setPlatformRoleAction } from "@/app/actions/admin";
import { CreditAdjustForm } from "@/components/admin/credit-adjust-form";
import { PlanEditor } from "@/components/admin/plan-editor";
import { Button } from "@/components/ui/button";
import { getPlatformAnalytics, listPlatformAuditLogs } from "@/lib/analytics/service";
import { listOrganizations, listPlans, listUsers, listWebhookEvents } from "@/lib/admin/service";
import { getCurrentAuth } from "@/lib/auth/session";
import { collectConfigIssues } from "@/lib/config";
import { prisma } from "@/lib/db";
import type { PlanLimits } from "@/lib/plans";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");

  const [users, organizations, plans, webhooks, audit, analytics] = await Promise.all([
    listUsers(prisma, auth.user.platformRole),
    listOrganizations(prisma, auth.user.platformRole),
    listPlans(prisma, auth.user.platformRole),
    listWebhookEvents(prisma, auth.user.platformRole),
    listPlatformAuditLogs(prisma, auth.user.platformRole),
    getPlatformAnalytics(prisma, auth.user.platformRole),
  ]);
  const issues = collectConfigIssues();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Platform admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Privileged actions are authorized on the server. Secrets are never included in this view.
        </p>
      </div>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Configuration</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {issues.length ? (
            issues.map((issue) => (
              <li key={issue.key}>
                {issue.level.toUpperCase()} · {issue.key}: {issue.message}
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No configuration issues detected.</li>
          )}
        </ul>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Platform usage</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Organizations</dt>
            <dd className="text-2xl font-semibold">{analytics.organizations}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Messages</dt>
            <dd className="text-2xl font-semibold">{analytics.usage._count}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Credits used</dt>
            <dd className="text-2xl font-semibold">{analytics.credits._sum.lifetimeUsed ?? 0}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Credit balance</dt>
            <dd className="text-2xl font-semibold">{analytics.credits._sum.balance ?? 0}</dd>
          </div>
        </dl>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Users</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Verified</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-2">{user.name}</td>
                  <td>{user.deletedAt ? "deleted" : user.email}</td>
                  <td>{user.platformRole}</td>
                  <td>{user.emailVerifiedAt ? "yes" : "no"}</td>
                  <td>
                    {user.id !== auth.user.id && !user.deletedAt ? (
                      <form
                        action={async () => {
                          "use server";
                          await setPlatformRoleAction(
                            user.id,
                            user.platformRole === "SUPER_ADMIN"
                              ? PlatformRole.USER
                              : PlatformRole.SUPER_ADMIN,
                          );
                        }}
                      >
                        <Button type="submit" variant="ghost" size="sm">
                          {user.platformRole === "SUPER_ADMIN" ? "Demote" : "Promote"}
                        </Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Organizations</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {organizations.map((org) => (
            <li key={org.id} className="flex justify-between rounded-lg bg-muted px-3 py-2">
              <span>
                {org.name} · {org.owner.email}
                {org.deletedAt ? " · deleted" : ""}
              </span>
              <span>
                {org._count.members} members · {org.subscription?.plan.name ?? "no plan"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Configurable plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saving a plan updates server-side entitlements immediately. Checkout still requires a
            verified payment event.
          </p>
        </div>
        {plans.map((plan) => (
          <PlanEditor
            key={plan.id}
            plan={{
              id: plan.id,
              code: plan.code,
              name: plan.name,
              description: plan.description,
              monthlyPriceCents: plan.monthlyPriceCents,
              yearlyPriceCents: plan.yearlyPriceCents,
              monthlyCredits: plan.monthlyCredits,
              isActive: plan.isActive,
              stripeMonthlyPriceId: plan.stripeMonthlyPriceId,
              stripeYearlyPriceId: plan.stripeYearlyPriceId,
              limits: plan.limits as PlanLimits,
            }}
          />
        ))}
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Credit adjustments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Grants write an atomic ledger row. They never invent a successful Stripe or Midtrans charge.
        </p>
        <div className="mt-4 max-w-md">
          <CreditAdjustForm organizations={organizations.filter((org) => !org.deletedAt).map((org) => ({ id: org.id, name: org.name }))} />
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Webhook events</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {webhooks.length ? (
            webhooks.map((event) => (
              <li key={event.id} className="flex justify-between rounded-lg bg-muted px-3 py-2">
                <span>
                  {event.provider} · {event.eventType} · {event.status}
                </span>
                <span className="text-muted-foreground">{event.eventId}</span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No webhook events stored.</li>
          )}
        </ul>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Audit log</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {audit.length ? (
            audit.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-muted px-3 py-2">
                <span className="font-medium">{entry.action}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {entry.organization?.name ?? "platform"} · {entry.actor?.email ?? "system"}
                </span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No audit entries yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
