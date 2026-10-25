import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Create your workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You will verify your email before publishing chatbots. The workspace starts on the Free plan.
      </p>
      <div className="mt-6">
        <SignUpForm />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
