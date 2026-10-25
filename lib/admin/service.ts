import { PlatformRole, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { isPlatformAdmin } from "@/lib/org/access";

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
