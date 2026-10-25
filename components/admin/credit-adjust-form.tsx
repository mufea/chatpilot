"use client";

import { useActionState } from "react";
import { adjustCreditsAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/validators";

export function CreditAdjustForm({
  organizations,
}: {
  organizations: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(adjustCreditsAction, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      {state.message ? (
        <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <select name="organizationId" className="h-9 w-full rounded-lg border bg-background px-2 text-sm" required>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <Input name="amount" type="number" defaultValue={100} />
      <Input name="reason" defaultValue="Support credit grant" />
      <Button type="submit" disabled={pending || organizations.length === 0}>
        {pending ? "Applying…" : "Adjust credits"}
      </Button>
    </form>
  );
}
