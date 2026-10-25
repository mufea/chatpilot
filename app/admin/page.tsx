import { PlatformRole } from "@prisma/client";
import { setPlatformRoleAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { listOrganizations, listPlans, listUsers } from "@/lib/admin/service";
import { getCurrentAuth } from "@/lib/auth/session";
import { collectConfigIssues } from "@/lib/config";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");

  const [users, organizations, plans] = await Promise.all([
    listUsers(prisma, auth.user.platformRole),
    listOrganizations(prisma, auth.user.platformRole),
    listPlans(prisma, auth.user.platformRole),
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
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Plans</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {plans.map((plan) => (
            <li key={plan.id} className="flex justify-between rounded-lg bg-muted px-3 py-2">
              <span>
                {plan.name} ({plan.code})
              </span>
              <span>
                {(plan.monthlyPriceCents / 100).toFixed(0)} {plan.currency} / mo
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
