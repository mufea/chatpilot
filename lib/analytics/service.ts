import { OrganizationRole, type PrismaClient } from "@prisma/client";
import { requireMembership } from "@/lib/org/service";
import { assertPlatformAdmin } from "@/lib/admin/service";
import type { PlatformRole } from "@prisma/client";

export async function getOrganizationAnalytics(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; days?: number },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.AGENT);
  const days = input.days ?? 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const records = await db.usageRecord.findMany({
    where: { organizationId: input.organizationId, createdAt: { gte: from } },
    orderBy: { createdAt: "asc" },
  });
  const payments = await db.payment.findMany({
    where: { organizationId: input.organizationId, createdAt: { gte: from } },
  });
  const byDay = new Map<string, { messages: number; credits: number; tokens: number }>();
  const byChatbot = new Map<string, { messages: number; credits: number }>();
  for (const record of records) {
    const day = record.createdAt.toISOString().slice(0, 10);
    const dayRow = byDay.get(day) ?? { messages: 0, credits: 0, tokens: 0 };
    dayRow.messages += 1;
    dayRow.credits += record.credits;
    dayRow.tokens += record.inputTokens + record.outputTokens;
    byDay.set(day, dayRow);
    const botKey = record.chatbotId ?? "unknown";
    const botRow = byChatbot.get(botKey) ?? { messages: 0, credits: 0 };
    botRow.messages += 1;
    botRow.credits += record.credits;
    byChatbot.set(botKey, botRow);
  }
  return {
    organizationId: input.organizationId,
    from,
    totals: {
      messages: records.length,
      credits: records.reduce((sum, item) => sum + item.credits, 0),
      tokens: records.reduce((sum, item) => sum + item.inputTokens + item.outputTokens, 0),
      succeededPayments: payments.filter((item) => item.status === "SUCCEEDED").length,
      failedPayments: payments.filter((item) => item.status === "FAILED").length,
    },
    byDay: [...byDay.entries()].map(([date, value]) => ({ date, ...value })),
    byChatbot: [...byChatbot.entries()].map(([chatbotId, value]) => ({ chatbotId, ...value })),
  };
}

export async function getPlatformAnalytics(db: PrismaClient, actorRole: PlatformRole) {
  assertPlatformAdmin(actorRole);
  const [organizations, payments, usage, credits] = await Promise.all([
    db.organization.count({ where: { deletedAt: null } }),
    db.payment.groupBy({ by: ["status"], _count: true, _sum: { amountCents: true } }),
    db.usageRecord.aggregate({ _count: true, _sum: { credits: true, inputTokens: true, outputTokens: true } }),
    db.creditAccount.aggregate({ _sum: { balance: true, lifetimeUsed: true, lifetimeGranted: true } }),
  ]);
  return {
    organizations,
    payments,
    usage,
    credits,
  };
}

export async function listOrganizationAuditLogs(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  return db.auditLog.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { name: true, email: true } } },
  });
}

export async function listPlatformAuditLogs(db: PrismaClient, actorRole: PlatformRole) {
  assertPlatformAdmin(actorRole);
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      actor: { select: { name: true, email: true } },
      organization: { select: { name: true } },
    },
  });
}
