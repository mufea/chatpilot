import { DocumentSourceType, OrganizationRole, type PrismaClient } from "@prisma/client";
import { ALLOWED_UPLOADS, MAX_UPLOAD_BYTES } from "@/lib/knowledge/constants";
import { enqueueIngestJob } from "@/lib/knowledge/jobs";
import { KnowledgeError, getKnowledgeBaseForOrg } from "@/lib/knowledge/service";
import { storeUpload } from "@/lib/knowledge/storage";
import { assertPublicHttpUrl } from "@/lib/knowledge/ssrf";
import { requireMembership } from "@/lib/org/service";
import { getOrganizationPlanLimits } from "@/lib/plans";

async function assertDocumentCapacity(db: PrismaClient, organizationId: string, knowledgeBaseId: string) {
  const limits = await getOrganizationPlanLimits(db, organizationId);
  const count = await db.document.count({ where: { knowledgeBaseId, organizationId } });
  if (count >= limits.documentsPerKnowledgeBase) {
    throw new KnowledgeError(
      `This plan allows ${limits.documentsPerKnowledgeBase} documents per knowledge base.`,
    );
  }
}

export async function addPastedDocument(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    knowledgeBaseId: string;
    title: string;
    text: string;
    faq?: boolean;
  },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  await getKnowledgeBaseForOrg(db, input.organizationId, input.knowledgeBaseId);
  await assertDocumentCapacity(db, input.organizationId, input.knowledgeBaseId);
  const text = input.text.trim();
  if (text.length < 8) throw new KnowledgeError("Paste at least a short paragraph of text.");
  const document = await db.document.create({
    data: {
      organizationId: input.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      title: input.title.trim() || (input.faq ? "FAQ" : "Pasted text"),
      sourceType: input.faq ? DocumentSourceType.FAQ : DocumentSourceType.PASTED_TEXT,
      extractedText: text,
      mimeType: "text/plain",
      byteSize: Buffer.byteLength(text),
      status: "PENDING",
    },
  });
  await enqueueIngestJob(db, document.id);
  return document;
}

export async function addUrlDocument(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    knowledgeBaseId: string;
    url: string;
    sitemap?: boolean;
  },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  await getKnowledgeBaseForOrg(db, input.organizationId, input.knowledgeBaseId);
  await assertDocumentCapacity(db, input.organizationId, input.knowledgeBaseId);
  const parsed = await assertPublicHttpUrl(input.url);
  const document = await db.document.create({
    data: {
      organizationId: input.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      title: parsed.hostname,
      sourceType: input.sitemap ? DocumentSourceType.SITEMAP : DocumentSourceType.URL,
      sourceUrl: parsed.toString(),
      status: "PENDING",
    },
  });
  await enqueueIngestJob(db, document.id);
  return document;
}

export async function addUploadedDocument(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    knowledgeBaseId: string;
    filename: string;
    mimeType?: string | null;
    bytes: Buffer;
  },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  await getKnowledgeBaseForOrg(db, input.organizationId, input.knowledgeBaseId);
  await assertDocumentCapacity(db, input.organizationId, input.knowledgeBaseId);
  if (input.bytes.length === 0) throw new KnowledgeError("The file is empty.");
  if (input.bytes.length > MAX_UPLOAD_BYTES) {
    throw new KnowledgeError("Files larger than 8 MB are not accepted.");
  }
  const ext = `.${input.filename.split(".").pop()?.toLowerCase() ?? ""}`;
  const allowed = ALLOWED_UPLOADS[ext];
  if (!allowed) {
    throw new KnowledgeError("Upload a .txt, .md, .csv, .pdf, or .docx file.");
  }
  const document = await db.document.create({
    data: {
      organizationId: input.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      title: input.filename.replace(/\.[^.]+$/, "") || input.filename,
      sourceType: allowed.sourceType,
      mimeType: input.mimeType || allowed.mime[0],
      byteSize: input.bytes.length,
      status: "PENDING",
    },
  });
  const storageKey = await storeUpload({
    organizationId: input.organizationId,
    documentId: document.id,
    filename: input.filename,
    bytes: input.bytes,
  });
  const updated = await db.document.update({
    where: { id: document.id },
    data: { storageKey },
  });
  await enqueueIngestJob(db, document.id);
  return updated;
}

export async function retryDocument(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; documentId: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const document = await db.document.findFirst({
    where: { id: input.documentId, organizationId: input.organizationId },
  });
  if (!document) throw new KnowledgeError("Document not found.", 404);
  if (document.status !== "FAILED" && document.status !== "PENDING") {
    throw new KnowledgeError("Only failed or pending documents can be retried.");
  }
  await db.document.update({
    where: { id: document.id },
    data: { status: "PENDING", errorMessage: null },
  });
  await enqueueIngestJob(db, document.id);
  return document;
}

export async function deleteDocument(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; documentId: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const document = await db.document.findFirst({
    where: { id: input.documentId, organizationId: input.organizationId },
  });
  if (!document) throw new KnowledgeError("Document not found.", 404);
  await db.document.delete({ where: { id: document.id } });
}
