"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestResetAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/lib/client-flags";
import type { FormState } from "@/lib/validators";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <ul className="text-xs text-destructive">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, {} as FormState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" required />
        <FieldError errors={state.errors?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError errors={state.errors?.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="organizationName">Workspace name</Label>
        <Input id="organizationName" name="organizationName" placeholder="North Harbor Books" />
        <FieldError errors={state.errors?.organizationName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
        <FieldError errors={state.errors?.password} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating workspace…" : "Create account"}
      </Button>
      {appConfig.googleOAuthEnabled ? (
        <a
          href="/api/auth/google"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          Continue with Google
        </a>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Google sign-in is available when OAuth credentials are configured.
        </p>
      )}
    </form>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, {} as FormState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError errors={state.errors?.email} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            Forgot password
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
        <FieldError errors={state.errors?.password} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {appConfig.googleOAuthEnabled ? (
        <a
          href="/api/auth/google"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          Continue with Google
        </a>
      ) : null}
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestResetAction, {} as FormState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError errors={state.errors?.email} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {} as FormState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        <FieldError errors={state.errors?.password} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
