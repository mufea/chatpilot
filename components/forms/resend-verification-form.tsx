"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validators";

async function wrappedAction(): Promise<FormState> {
  return resendVerificationAction();
}

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(wrappedAction, {} as FormState);
  return (
    <form action={action} className="mt-6 space-y-3">
      {state.message ? (
        <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sending…" : "Resend verification email"}
      </Button>
    </form>
  );
}
