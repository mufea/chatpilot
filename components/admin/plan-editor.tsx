"use client";

import { useActionState } from "react";
import { updatePlanAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/validators";
import type { PlanLimits } from "@/lib/plans";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  monthlyCredits: number;
  isActive: boolean;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  limits: PlanLimits;
};

export function PlanEditor({ plan }: { plan: PlanRow }) {
  const [state, action, pending] = useActionState(updatePlanAction, {} as FormState);
  const limits = plan.limits;
  return (
    <form action={action} className="space-y-3 rounded-xl border p-4">
      <input type="hidden" name="planId" value={plan.id} />
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">
          {plan.code} · {plan.name}
        </p>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="isActive" defaultChecked={plan.isActive} />
          Active
        </label>
      </div>
      {state.message ? (
        <p className={state.ok ? "text-xs text-primary" : "text-xs text-destructive"}>{state.message}</p>
      ) : null}
      <Input name="name" defaultValue={plan.name} />
      <Input name="description" defaultValue={plan.description} />
      <div className="grid gap-2 sm:grid-cols-3">
        <Input name="monthlyPriceCents" type="number" defaultValue={plan.monthlyPriceCents} />
        <Input name="yearlyPriceCents" type="number" defaultValue={plan.yearlyPriceCents} />
        <Input name="monthlyCredits" type="number" defaultValue={plan.monthlyCredits} />
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <Input name="chatbots" type="number" defaultValue={limits.chatbots} />
        <Input name="knowledgeBases" type="number" defaultValue={limits.knowledgeBases} />
        <Input name="monthlyMessages" type="number" defaultValue={limits.monthlyMessages} />
        <Input name="teamMembers" type="number" defaultValue={limits.teamMembers} />
        <Input name="documentsPerKnowledgeBase" type="number" defaultValue={limits.documentsPerKnowledgeBase} />
      </div>
      <Input name="stripeMonthlyPriceId" defaultValue={plan.stripeMonthlyPriceId ?? ""} placeholder="Stripe monthly price id" />
      <Input name="stripeYearlyPriceId" defaultValue={plan.stripeYearlyPriceId ?? ""} placeholder="Stripe yearly price id" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save plan"}
      </Button>
    </form>
  );
}
