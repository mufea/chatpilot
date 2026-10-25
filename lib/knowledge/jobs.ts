import { JobStatus, type PrismaClient } from "@prisma/client";
import { INGEST_JOB_TYPE, MAX_JOB_ATTEMPTS } from "@/lib/knowledge/constants";

export async function enqueueIngestJob(
  db: PrismaClient,
  documentId: string,
  delayMs = 0,
) {
  return db.backgroundJob.create({
    data: {
      type: INGEST_JOB_TYPE,
      status: JobStatus.QUEUED,
      payload: { documentId },
      runAt: new Date(Date.now() + delayMs),
    },
  });
}

export async function claimNextJob(db: PrismaClient) {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE "BackgroundJob"
    SET status = 'RUNNING',
        "startedAt" = NOW(),
        attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "BackgroundJob"
      WHERE status = 'QUEUED'
        AND "runAt" <= NOW()
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
  `;
  if (!rows[0]) return null;
  return db.backgroundJob.findUnique({ where: { id: rows[0].id } });
}

export function retryDelayMs(attempts: number) {
  return Math.min(60_000, 2 ** Math.max(0, attempts - 1) * 1000);
}

export async function failJob(db: PrismaClient, jobId: string, attempts: number, error: string) {
  if (attempts < MAX_JOB_ATTEMPTS) {
    await db.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.QUEUED,
        error,
        runAt: new Date(Date.now() + retryDelayMs(attempts)),
        finishedAt: null,
      },
    });
    return;
  }
  await db.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.FAILED,
      error,
      finishedAt: new Date(),
    },
  });
}
