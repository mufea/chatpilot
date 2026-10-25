import { PlatformRole, Prisma, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { grantCredits } from "@/lib/billing/credits";
import { isPlatformAdmin } from "@/lib/org/access";
import type { PlanLimits } from "@/lib/plans";

export class AdminError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}

export function assertPlatformAdmin(platformRole: PlatformRole) {
  if (!isPlatformAdmin(platformRole)) {
    throw new AdminError("Platform administrator access is required.");
  }
}

export async function listUsers(db: PrismaClient, actorRole: PlatformRole) {
  assertPlatformAdmin(actorRole);
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      emailVerifiedAt: true,
      createdAt: true,
      deletedAt: true,
      _count: { select: { memberships: true } },
    },
  });
}

export async function listOrganizations(db: PrismaClient, actorRole: PlatformRole) {
  assertPlatformAdmin(actorRole);
  return db.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      owner: { select: { email: true, name: true } },
      _count: { select: { members: true, chatbots: true } },
      subscription: { include: { plan: true } },
    },
  });
}

export async function setUserPlatformRole(
  db: PrismaClient,
  input: { actorUserId: string; actorRole: PlatformRole; userId: string; role: PlatformRole },
) {
  assertPlatformAdmin(input.actorRole);
  if (input.userId === input.actorUserId) {
    throw new AdminError("You cannot change your own platform role.");
  }
  const user = await db.user.update({
    where: { id: input.userId },
    data: { platformRole: input.role },
  });
  await writeAuditLog(db, {
    actorUserId: input.actorUserId,
    action: "admin.user.role",
    targetType: "user",
    targetId: user.id,
    metadata: { role: input.role },
  });
  return user;
}

export async function listPlans(db: PrismaClient, actorRole: PlatformRole) {
  assertPlatformAdmin(actorRole);
  return db.plan.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function updatePlan(
  db: PrismaClient,
  input: {
    actorUserId: string;
    actorRole: PlatformRole;
    planId: string;
    name: string;
    description: string;
    monthlyPriceCents: number;
    yearlyPriceCents: number;
    monthlyCredits: number;
    isActive: boolean;
    stripeMonthlyPriceId?: string | null;
    stripeYearlyPriceId?: string | null;
    limits: PlanLimits;
  },
) {
  assertPlatformAdmin(input.actorRole);
  const plan = await db.plan.update({
    where: { id: input.planId },
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      monthlyPriceCents: input.monthlyPriceCents,
      yearlyPriceCents: input.yearlyPriceCents,
      monthlyCredits: input.monthlyCredits,
      isActive: input.isActive,
      stripeMonthlyPriceId: input.stripeMonthlyPriceId?.trim() || null,
      stripeYearlyPriceId: input.stripeYearlyPriceId?.trim() || null,
      limits: input.limits as unknown as Prisma.InputJsonValue,
    },
  });
  await writeAuditLog(db, {
    actorUserId: input.actorUserId,
    action: "admin.plan.updated",
    targetType: "plan",
    targetId: plan.id,
    metadata: { code: plan.code },
  });
  return plan;
}

export async function adjustOrganizationCredits(
  db: PrismaClient,
  input: {
    actorUserId: string;
    actorRole: PlatformRole;
    organizationId: string;
    amount: number;
    reason: string;
  },
) {
  assertPlatformAdmin(input.actorRole);
  const organization = await db.organization.findUnique({ where: { id: input.organizationId } });
  if (!organization) {
    throw new AdminError("Organization not found.", 404);
  }
  const result = await grantCredits(db, {
    organizationId: input.organizationId,
    amount: input.amount,
    reason: input.reason || "Admin credit adjustment",
    idempotencyKey: `admin:${input.organizationId}:${input.amount}:${Date.now()}:${input.actorUserId}`,
    type: input.amount > 0 ? "ADJUSTMENT" : "ADJUSTMENT",
    actorUserId: input.actorUserId,
  });
  await writeAuditLog(db, {
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: "admin.credits.adjusted",
    targetType: "organization",
    targetId: input.organizationId,
    metadata: { amount: input.amount },
  });
  return result;
}

export async function listWebhookEvents(db: PrismaClient, actorRole: PlatformRole) {
  assertPlatformAdmin(actorRole);
  return db.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 });
}
