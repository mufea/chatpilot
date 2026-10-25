"use server";

import { redirect } from "next/navigation";
import { BillingError } from "@/lib/billing/errors";
import { startCheckout } from "@/lib/billing/service";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { checkoutSchema, type FormState } from "@/lib/validators";

export async function startCheckoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");

  const parsed = checkoutSchema.safeParse({
    planCode: formData.get("planCode"),
    interval: formData.get("interval"),
    provider: formData.get("provider"),
  });
  if (!parsed.success) {
    return { message: "Choose a paid plan, interval, and payment provider." };
  }

  try {
    const result = await startCheckout(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
      ...parsed.data,
    });
    const url = "url" in result ? result.url : "redirectUrl" in result ? result.redirectUrl : "";
    if (!url) {
      return { message: "Checkout did not return a redirect URL." };
    }
    redirect(url);
  } catch (error) {
    if (error instanceof BillingError) {
      return { message: error.message };
    }
    throw error;
  }
}
