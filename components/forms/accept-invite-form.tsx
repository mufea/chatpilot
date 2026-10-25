"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/app/actions/org";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validators";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, {} as FormState);

  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <Button type="submit" disabled={pending || !token}>
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
    </form>
  );
}
