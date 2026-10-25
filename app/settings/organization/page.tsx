import { redirect } from "next/navigation";
import { CreateOrganizationForm, RenameOrganizationForm } from "@/components/forms/settings-forms";
import { getCurrentAuth } from "@/lib/auth/session";

export default async function OrganizationSettingsPage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Slug <code>{auth.activeOrganization.slug}</code> · role {auth.activeMembership?.role}
        </p>
      </div>
      <section className="rounded-2xl border bg-card p-6">
        <RenameOrganizationForm defaultName={auth.activeOrganization.name} />
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Create another workspace</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You become the owner of the new organization. Plan limits will apply in Phase 6.
        </p>
        <div className="mt-4">
          <CreateOrganizationForm />
        </div>
      </section>
    </div>
  );
}
