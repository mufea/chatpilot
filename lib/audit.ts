import type { Prisma, PrismaClient } from "@prisma/client";

export async function writeAuditLog(
  db: PrismaClient,
  entry: {
    actorUserId?: string | null;
    organizationId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string | null;
  },
) {
  await db.auditLog.create({
    data: {
      actorUserId: entry.actorUserId ?? undefined,
      organizationId: entry.organizationId ?? undefined,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? undefined,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? undefined,
    },
  });
}
