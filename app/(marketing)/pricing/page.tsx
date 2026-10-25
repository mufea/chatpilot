import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_PLANS, formatPlanPrice } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Pricing that stays configurable</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        These are the initial ChatPilot plans. Amounts, limits, and features live in the database
        so an administrator can change them later. Checkout is not live in Phase 1.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {DEFAULT_PLANS.map((plan) => (
          <article
            key={plan.code}
            className={cn(
              "flex flex-col rounded-2xl border bg-card p-6",
              plan.highlighted && "border-primary shadow-lg",
            )}
          >
            <p className="text-sm font-medium text-primary">{plan.name}</p>
            <p className="mt-3 text-3xl font-semibold">
              {formatPlanPrice(plan.monthlyPriceCents, plan.currency)}
              {plan.monthlyPriceCents > 0 ? (
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              ) : null}
            </p>
            {plan.yearlyPriceCents > 0 ? (
              <p className="text-xs text-muted-foreground">
                or {formatPlanPrice(plan.yearlyPriceCents, plan.currency)} billed yearly
              </p>
            ) : null}
            <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className={cn(buttonVariants(), "mt-6")}>
              {plan.monthlyPriceCents === 0 ? "Start free" : "Create a workspace"}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
