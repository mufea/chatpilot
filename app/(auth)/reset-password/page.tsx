import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      {!token ? (
        <p className="mt-4 text-sm text-destructive">This reset link is missing a token.</p>
      ) : (
        <div className="mt-6">
          <ResetPasswordForm token={token} />
        </div>
      )}
    </div>
  );
}
