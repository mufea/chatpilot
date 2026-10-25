import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; password?: string; oauth?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">Use the email and password for your ChatPilot workspace.</p>
      {params.reset ? (
        <p className="mt-4 text-sm text-primary">Password updated. Sign in with your new password.</p>
      ) : null}
      {params.password ? (
        <p className="mt-4 text-sm text-primary">Password changed. Sign in again to continue.</p>
      ) : null}
      {params.oauth ? (
        <p className="mt-4 text-sm text-destructive">Google sign-in could not be completed ({params.oauth}).</p>
      ) : null}
      <div className="mt-6">
        <SignInForm />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
