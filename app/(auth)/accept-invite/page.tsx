import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/forms/accept-invite-form";
import { getCurrentAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const auth = await getCurrentAuth();
  const { token } = await searchParams;
  if (!auth) {
    redirect(`/sign-in?next=/accept-invite?token=${encodeURIComponent(token ?? "")}`);
  }

  return (
    <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Join a workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {auth.user.email}. Accepting will add this account to the invited organization.
      </p>
      <AcceptInviteForm token={token ?? ""} />
    </div>
  );
}
