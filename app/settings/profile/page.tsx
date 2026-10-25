import Link from "next/link";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/app/settings-nav";
import { DeleteAccountButton, PasswordForm, ProfileForm } from "@/components/forms/settings-forms";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentAuth } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export default async function ProfileSettingsPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");

  return (
    <div className="space-y-8">
      <SettingsNav current="/settings/profile" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">{auth.user.email}</p>
      </div>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Display name</h2>
        <div className="mt-4">
          <ProfileForm defaultName={auth.user.name} />
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Password</h2>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Export includes your profile, memberships, and connected login providers. It does not
          include other people&apos;s conversations.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/api/account/export" className={cn(buttonVariants({ variant: "outline" }))}>
            Download export
          </a>
          <Link href="/settings/organization" className={cn(buttonVariants({ variant: "ghost" }))}>
            Workspace settings
          </Link>
        </div>
      </section>
      <section className="rounded-2xl border border-destructive/30 bg-card p-6">
        <h2 className="font-semibold text-destructive">Delete account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This anonymizes your user, revokes sessions, and soft-deletes workspaces you solely own.
        </p>
        <div className="mt-4">
          <DeleteAccountButton />
        </div>
      </section>
    </div>
  );
}
