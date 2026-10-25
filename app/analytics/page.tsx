import { redirect } from "next/navigation";
import { getOrganizationAnalytics, listOrganizationAuditLogs } from "@/lib/analytics/service";
import { getCurrentAuth } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";

export default async function AnalyticsPage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const organizationId = auth.activeOrganization.id;
  const [usage, entitlements, audit] = await Promise.all([
    getOrganizationAnalytics(prisma, { organizationId, actorUserId: auth.user.id }),
    getEntitlements(prisma, organizationId),
    listOrganizationAuditLogs(prisma, { organizationId, actorUserId: auth.user.id }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Usage is scoped to {auth.activeOrganization.name}. Another workspace id from the browser
          is not trusted.
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Messages (30d)", value: usage.totals.messages },
          { label: "Credits used", value: usage.totals.credits },
          { label: "Tokens", value: usage.totals.tokens },
          { label: "Remaining messages", value: entitlements.messagesRemaining },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold">{card.value}</p>
          </article>
        ))}
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Daily usage</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {usage.byDay.length ? (
            usage.byDay.map((row) => (
              <li key={row.date} className="flex justify-between rounded-lg bg-muted px-3 py-2">
                <span>{row.date}</span>
                <span>
                  {row.messages} messages · {row.credits} credits · {row.tokens} tokens
                </span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No usage in the last 30 days.</li>
          )}
        </ul>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Workspace audit</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {audit.length ? (
            audit.map((entry) => (
              <li key={entry.id} className="flex justify-between rounded-lg bg-muted px-3 py-2">
                <span>{entry.action}</span>
                <span className="text-muted-foreground">{entry.actor?.email ?? "system"}</span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No workspace audit events, or you need an admin role to read them.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
