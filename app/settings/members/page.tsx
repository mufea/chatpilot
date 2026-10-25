import { OrganizationRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { removeMemberAction, updateMemberRoleAction } from "@/app/actions/org";
import { SettingsNav } from "@/components/app/settings-nav";
import { InviteMemberForm } from "@/components/forms/settings-forms";
import { Button } from "@/components/ui/button";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { appConfig } from "@/lib/config";
import { canManageMembers } from "@/lib/org/access";

export default async function MembersPage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");

  const [members, invitations] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: auth.activeOrganization.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId: auth.activeOrganization.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const canManage = auth.activeMembership
    ? canManageMembers(auth.activeMembership.role)
    : false;

  const latestInviteEmail =
    appConfig.allowDevMailbox && invitations[0]
      ? await prisma.outboundEmail.findFirst({
          where: { to: invitations[0].email, purpose: "org_invite" },
          orderBy: { createdAt: "desc" },
        })
      : null;

  return (
    <div className="space-y-8">
      <SettingsNav current="/settings/members" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Owners and admins can invite people. Agents can view the roster only.
        </p>
      </div>
      {canManage ? (
        <section className="rounded-2xl border bg-card p-6">
          <InviteMemberForm />
          {latestInviteEmail ? (
            <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-3 text-xs">
              {latestInviteEmail.textBody}
            </pre>
          ) : null}
        </section>
      ) : null}
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Current members</h2>
        <ul className="mt-4 divide-y">
          {members.map((member) => (
            <li key={member.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{member.user.name}</p>
                <p className="text-sm text-muted-foreground">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && member.role !== "OWNER" ? (
                  <form
                    action={async (formData) => {
                      "use server";
                      await updateMemberRoleAction(
                        member.id,
                        String(formData.get("role")) as OrganizationRole,
                      );
                    }}
                  >
                    <select
                      name="role"
                      defaultValue={member.role}
                      className="h-8 rounded-lg border bg-background px-2 text-sm"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="AGENT">Agent</option>
                    </select>
                    <Button type="submit" variant="ghost" size="sm">
                      Update
                    </Button>
                  </form>
                ) : (
                  <span className="text-sm text-muted-foreground">{member.role}</span>
                )}
                {canManage && member.role !== "OWNER" ? (
                  <form
                    action={async () => {
                      "use server";
                      await removeMemberAction(member.id);
                    }}
                  >
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Pending invitations</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {invitations.length ? (
            invitations.map((invite) => (
              <li key={invite.id} className="flex justify-between rounded-lg bg-muted px-3 py-2">
                <span>{invite.email}</span>
                <span>{invite.role}</span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No pending invitations.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
