"use client";

import { useActionState } from "react";
import { startCheckoutAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validators";

type PlanOption = {
  code: string;
  name: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
};

export function CheckoutForm({
  plans,
  stripeConfigured,
  midtransConfigured,
}: {
  plans: PlanOption[];
  stripeConfigured: boolean;
  midtransConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(startCheckoutAction, {} as FormState);
  const paid = plans.filter((plan) => plan.code !== "FREE");

  return (
    <form action={action} className="space-y-4">
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <label className="block space-y-1 text-sm">
        <span>Plan</span>
        <select name="planCode" className="h-9 w-full rounded-lg border bg-background px-2" defaultValue="STARTER">
          {paid.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Interval</span>
        <select name="interval" className="h-9 w-full rounded-lg border bg-background px-2" defaultValue="MONTHLY">
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Provider</span>
        <select name="provider" className="h-9 w-full rounded-lg border bg-background px-2" defaultValue="STRIPE">
          <option value="STRIPE">Stripe</option>
          <option value="MIDTRANS">Midtrans</option>
        </select>
      </label>
      <p className="text-xs text-muted-foreground">
        {stripeConfigured
          ? "Stripe keys are present. Checkout still requires a verified webhook before a plan change is trusted."
          : "Stripe is not configured. Starting checkout will fail closed instead of marking the workspace paid."}
        {" "}
        {midtransConfigured
          ? "Midtrans server key is present (optional)."
          : "Midtrans is optional and currently disabled."}
      </p>
      <Button type="submit" disabled={pending || paid.length === 0}>
        {pending ? "Starting checkout…" : "Start checkout"}
      </Button>
    </form>
  );
}
