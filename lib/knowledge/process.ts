import { readFile } from "node:fs/promises";
import { JobStatus, Prisma, type PrismaClient } from "@prisma/client";
import { INGEST_JOB_TYPE } from "@/lib/knowledge/constants";
import { chunkText } from "@/lib/knowledge/chunk";
import { crawlSitemap, fetchPageText, type FetchImpl } from "@/lib/knowledge/crawl";
import { embedTexts, embeddingLiteral } from "@/lib/knowledge/embed";
import { ExtractError, extractFromBuffer } from "@/lib/knowledge/extract";
import { claimNextJob, failJob } from "@/lib/knowledge/jobs";
import { resolveStoredPath } from "@/lib/knowledge/storage";
import { SsrfError } from "@/lib/knowledge/ssrf";

export async function processDocument(
  db: PrismaClient,
  documentId: string,
  fetchImpl?: FetchImpl,
) {
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) throw new Error("Document not found.");

  await db.document.update({
    where: { id: document.id },
    data: { status: "PROCESSING", attempts: { increment: 1 }, errorMessage: null },
  });

  try {
    let text = document.extractedText?.trim() ?? "";
    let title = document.title;

    if (!text && document.storageKey) {
      const bytes = await readFile(resolveStoredPath(document.storageKey));
      text = await extractFromBuffer(bytes, document.sourceType, document.mimeType);
    } else if (!text && document.sourceUrl && document.sourceType === "SITEMAP") {
      const crawled = await crawlSitemap(document.sourceUrl, fetchImpl);
      text = crawled.text;
      title = crawled.title;
    } else if (!text && document.sourceUrl) {
      const page = await fetchPageText(document.sourceUrl, fetchImpl);
      text = page.text;
      title = page.title || title;
    } else if (text && (document.sourceType === "FAQ" || document.sourceType === "CSV")) {
      text = await extractFromBuffer(Buffer.from(text), document.sourceType, document.mimeType);
    }

    if (!text.trim()) {
      throw new ExtractError("No text was extracted from this source.");
    }

    const chunks = chunkText(text);
    if (!chunks.length) throw new ExtractError("The extracted text was empty after chunking.");

    const vectors = await embedTexts(db, document.organizationId, chunks.map((chunk) => chunk.content));
    await db.documentChunk.deleteMany({ where: { documentId: document.id } });

    for (const [index, chunk] of chunks.entries()) {
      const created = await db.documentChunk.create({
        data: {
          documentId: document.id,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          tokenCount: chunk.tokenCount,
          embedding: vectors[index],
          metadata: { title },
        },
      });
      const literal = embeddingLiteral(vectors[index] ?? []);
      await db.$executeRaw`UPDATE "DocumentChunk" SET "embeddingVec" = ${Prisma.raw(`'${literal}'::vector`)} WHERE id = ${created.id}`;
    }

    await db.document.update({
      where: { id: document.id },
      data: {
        status: "READY",
        extractedText: text,
        title,
        errorMessage: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof SsrfError || error instanceof ExtractError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Ingestion failed.";
    await db.document.update({
      where: { id: document.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 500) },
    });
    throw error;
  }
}

export async function processQueuedJobs(
  db: PrismaClient,
  input: { limit?: number; fetchImpl?: FetchImpl } = {},
) {
  const limit = input.limit ?? 10;
  let processed = 0;
  for (let i = 0; i < limit; i += 1) {
    const job = await claimNextJob(db);
    if (!job) break;
    if (job.type !== INGEST_JOB_TYPE) {
      await db.backgroundJob.update({
        where: { id: job.id },
        data: { status: JobStatus.FAILED, error: "Unknown job type.", finishedAt: new Date() },
      });
      continue;
    }
    const documentId = (job.payload as { documentId?: string }).documentId;
    if (!documentId) {
      await failJob(db, job.id, job.attempts, "Job payload is missing documentId.");
      continue;
    }
    try {
      await processDocument(db, documentId, input.fetchImpl);
      await db.backgroundJob.update({
        where: { id: job.id },
        data: { status: JobStatus.SUCCEEDED, error: null, finishedAt: new Date() },
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ingestion failed.";
      await failJob(db, job.id, job.attempts, message.slice(0, 500));
    }
  }
  return processed;
}

const scheduled = new Set<PrismaClient>();

export function scheduleJobProcessing(db: PrismaClient) {
  if (scheduled.has(db)) return;
  scheduled.add(db);
  setTimeout(() => {
    scheduled.delete(db);
    void processQueuedJobs(db).catch(() => undefined);
  }, 10);
}
