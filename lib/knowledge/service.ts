import { OrganizationRole, type Prisma, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { requireMembership } from "@/lib/org/service";
import { getOrganizationPlanLimits } from "@/lib/plans";

export class KnowledgeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const kbInclude = {
  documents: {
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
  _count: { select: { documents: true, chatbotLinks: true } },
} satisfies Prisma.KnowledgeBaseInclude;

export async function listKnowledgeBases(db: PrismaClient, organizationId: string) {
  return db.knowledgeBase.findMany({
    where: { organizationId },
    include: kbInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getKnowledgeBaseForOrg(db: PrismaClient, organizationId: string, knowledgeBaseId: string) {
  const kb = await db.knowledgeBase.findFirst({
    where: { id: knowledgeBaseId, organizationId },
    include: kbInclude,
  });
  if (!kb) throw new KnowledgeError("Knowledge base not found.", 404);
  return kb;
}

export async function createKnowledgeBase(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; name: string; description?: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const limits = await getOrganizationPlanLimits(db, input.organizationId);
  const existing = await db.knowledgeBase.count({ where: { organizationId: input.organizationId } });
  if (existing >= limits.knowledgeBases) {
    throw new KnowledgeError(`This plan allows ${limits.knowledgeBases} knowledge base${limits.knowledgeBases === 1 ? "" : "s"}.`);
  }
  const kb = await db.knowledgeBase.create({
    data: {
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
    },
    include: kbInclude,
  });
  await writeAuditLog(db, {
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: "knowledge.created",
    targetType: "knowledge_base",
    targetId: kb.id,
  });
  return kb;
}

export async function updateKnowledgeBase(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; knowledgeBaseId: string; name: string; description?: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  await getKnowledgeBaseForOrg(db, input.organizationId, input.knowledgeBaseId);
  return db.knowledgeBase.update({
    where: { id: input.knowledgeBaseId },
    data: { name: input.name.trim(), description: input.description?.trim() || null },
    include: kbInclude,
  });
}

export async function deleteKnowledgeBase(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; knowledgeBaseId: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  await getKnowledgeBaseForOrg(db, input.organizationId, input.knowledgeBaseId);
  await db.knowledgeBase.delete({ where: { id: input.knowledgeBaseId } });
}

export async function setChatbotKnowledgeBases(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; chatbotId: string; knowledgeBaseIds: string[] },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const chatbot = await db.chatbot.findFirst({
    where: { id: input.chatbotId, organizationId: input.organizationId, deletedAt: null },
  });
  if (!chatbot) throw new KnowledgeError("Chatbot not found.", 404);
  const unique = [...new Set(input.knowledgeBaseIds)];
  const owned = await db.knowledgeBase.findMany({
    where: { organizationId: input.organizationId, id: { in: unique } },
    select: { id: true },
  });
  if (owned.length !== unique.length) {
    throw new KnowledgeError("One or more knowledge bases do not belong to this workspace.");
  }
  await db.$transaction([
    db.chatbotKnowledgeBase.deleteMany({ where: { chatbotId: input.chatbotId } }),
    ...owned.map((kb) =>
      db.chatbotKnowledgeBase.create({
        data: { chatbotId: input.chatbotId, knowledgeBaseId: kb.id },
      }),
    ),
  ]);
}

export async function getDocumentForOrg(db: PrismaClient, organizationId: string, documentId: string) {
  const document = await db.document.findFirst({
    where: { id: documentId, organizationId },
    include: { knowledgeBase: true, chunks: { select: { id: true, chunkIndex: true } } },
  });
  if (!document) throw new KnowledgeError("Document not found.", 404);
  return document;
}
