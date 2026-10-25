"use server";

import { PlatformRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { adjustOrganizationCredits, setUserPlatformRole, updatePlan } from "@/lib/admin/service";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { adminCreditSchema, adminPlanSchema, type FormState } from "@/lib/validators";

export async function setPlatformRoleAction(userId: string, role: PlatformRole) {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  await setUserPlatformRole(prisma, {
    actorUserId: auth.user.id,
    actorRole: auth.user.platformRole,
    userId,
    role,
  });
}

export async function updatePlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  const parsed = adminPlanSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    description: formData.get("description"),
    monthlyPriceCents: formData.get("monthlyPriceCents"),
    yearlyPriceCents: formData.get("yearlyPriceCents"),
    monthlyCredits: formData.get("monthlyCredits"),
    isActive: formData.get("isActive"),
    stripeMonthlyPriceId: formData.get("stripeMonthlyPriceId"),
    stripeYearlyPriceId: formData.get("stripeYearlyPriceId"),
    chatbots: formData.get("chatbots"),
    knowledgeBases: formData.get("knowledgeBases"),
    monthlyMessages: formData.get("monthlyMessages"),
    teamMembers: formData.get("teamMembers"),
    documentsPerKnowledgeBase: formData.get("documentsPerKnowledgeBase"),
  });
  if (!parsed.success) {
    return { message: "Plan fields are invalid." };
  }
  await updatePlan(prisma, {
    actorUserId: auth.user.id,
    actorRole: auth.user.platformRole,
    planId: parsed.data.planId,
    name: parsed.data.name,
    description: parsed.data.description,
    monthlyPriceCents: parsed.data.monthlyPriceCents,
    yearlyPriceCents: parsed.data.yearlyPriceCents,
    monthlyCredits: parsed.data.monthlyCredits,
    isActive: parsed.data.isActive === "on",
    stripeMonthlyPriceId: parsed.data.stripeMonthlyPriceId,
    stripeYearlyPriceId: parsed.data.stripeYearlyPriceId,
    limits: {
      chatbots: parsed.data.chatbots,
      knowledgeBases: parsed.data.knowledgeBases,
      monthlyMessages: parsed.data.monthlyMessages,
      teamMembers: parsed.data.teamMembers,
      documentsPerKnowledgeBase: parsed.data.documentsPerKnowledgeBase,
    },
  });
  return { ok: true, message: "Plan saved. Entitlements now use these limits." };
}

export async function adjustCreditsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  const parsed = adminCreditSchema.safeParse({
    organizationId: formData.get("organizationId"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { message: "Credit adjustment is invalid." };
  }
  const result = await adjustOrganizationCredits(prisma, {
    actorUserId: auth.user.id,
    actorRole: auth.user.platformRole,
    ...parsed.data,
  });
  return { ok: true, message: `Balance is now ${result.balanceAfter}.` };
}
