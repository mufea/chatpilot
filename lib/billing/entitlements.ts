import type { PrismaClient, SubscriptionStatus } from "@prisma/client";
import { BillingError } from "@/lib/billing/errors";
import { DEFAULT_PLANS, type PlanLimits } from "@/lib/plans";

const USABLE: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

export type Entitlements = {
  organizationId: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus | "NONE";
  limits: PlanLimits;
  monthlyCredits: number;
  features: string[];
  canUseAi: boolean;
  canCreateResources: boolean;
  canRemoveBranding: boolean;
  messagesUsed: number;
  messagesRemaining: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
};

function periodBounds(subscription?: {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}) {
  const now = new Date();
  const start = subscription?.currentPeriodStart ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end =
    subscription?.currentPeriodEnd ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function getEntitlements(db: PrismaClient, organizationId: string): Promise<Entitlements> {
  const subscription = await db.subscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });
  const plan = subscription?.plan;
  const limits = (plan?.limits as PlanLimits | undefined) ?? DEFAULT_PLANS[0]!.limits;
  const { start, end } = periodBounds(subscription ?? undefined);
  const messagesUsed = await db.usageRecord.count({
    where: {
      organizationId,
      createdAt: { gte: start, lt: end },
    },
  });
  const features = Array.isArray(plan?.features) ? (plan.features as string[]) : [];
  const status = subscription?.status ?? "NONE";
  const canUseAi = status === "NONE" ? false : USABLE.includes(status);
  return {
    organizationId,
    planCode: plan?.code ?? "FREE",
    planName: plan?.name ?? "Free",
    status,
    limits,
    monthlyCredits: plan?.monthlyCredits ?? DEFAULT_PLANS[0]!.monthlyCredits,
    features,
    canUseAi,
    canCreateResources: canUseAi,
    canRemoveBranding: features.some((item) => /branding|white-label/i.test(item)),
    messagesUsed,
    messagesRemaining: Math.max(0, limits.monthlyMessages - messagesUsed),
    currentPeriodStart: start,
    currentPeriodEnd: end,
  };
}

export async function assertCanUseAi(db: PrismaClient, organizationId: string) {
  const entitlements = await getEntitlements(db, organizationId);
  if (!entitlements.canUseAi) {
    throw new BillingError("This workspace cannot use AI until billing is active.", 402, "subscription_inactive");
  }
  if (entitlements.messagesRemaining <= 0) {
    throw new BillingError("This workspace has reached its monthly message limit.", 402, "message_limit");
  }
  return entitlements;
}

export async function assertCanCreateResource(
  db: PrismaClient,
  organizationId: string,
  kind: "chatbots" | "knowledgeBases" | "teamMembers" | "documentsPerKnowledgeBase",
  currentCount: number,
) {
  const entitlements = await getEntitlements(db, organizationId);
  if (!entitlements.canCreateResources) {
    throw new BillingError("This workspace cannot add resources while billing is inactive.", 402, "subscription_inactive");
  }
  const limit = entitlements.limits[kind];
  if (currentCount >= limit) {
    throw new BillingError(`This plan allows ${limit} ${kind === "teamMembers" ? "team members" : kind}.`, 402, "plan_limit");
  }
  return entitlements;
}
