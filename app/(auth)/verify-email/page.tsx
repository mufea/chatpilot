import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailAction } from "@/app/actions/auth";
import { ResendVerificationForm } from "@/components/forms/resend-verification-form";
import { appConfig } from "@/lib/config";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const auth = await getCurrentAuth();
  const result = token ? await verifyEmailAction(token) : null;
  const latestEmail =
    appConfig.allowDevMailbox && auth
      ? await prisma.outboundEmail.findFirst({
          where: { to: auth.user.email, purpose: "email_verify" },
          orderBy: { createdAt: "desc" },
        })
      : null;

  return (
    <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      {result?.ok ? (
        <p className="mt-4 text-sm text-primary">{result.message}</p>
      ) : result?.message ? (
        <p className="mt-4 text-sm text-destructive">{result.message}</p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          We sent a verification link to {auth?.user.email ?? "your email"}. Open it to unlock
          publishing in later phases.
        </p>
      )}
      {auth && !auth.user.emailVerifiedAt ? <ResendVerificationForm /> : null}
      {latestEmail ? (
        <div className="mt-6 rounded-xl bg-muted p-4 text-sm">
          <p className="font-medium">Development mailbox</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{latestEmail.textBody}</pre>
        </div>
      ) : null}
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        Continue to dashboard
      </Link>
    </div>
  );
}
