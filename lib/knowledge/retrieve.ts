import { Prisma, type PrismaClient } from "@prisma/client";
import { RETRIEVE_K } from "@/lib/knowledge/constants";
import { embedTexts, embeddingLiteral } from "@/lib/knowledge/embed";
import type { RetrievedChunk } from "@/lib/knowledge/types";

export async function retrieveForChatbot(
  db: PrismaClient,
  input: {
    organizationId: string;
    chatbotId: string;
    query: string;
    limit?: number;
  },
): Promise<RetrievedChunk[]> {
  const links = await db.chatbotKnowledgeBase.findMany({
    where: { chatbotId: input.chatbotId, knowledgeBase: { organizationId: input.organizationId } },
    select: { knowledgeBaseId: true },
  });
  if (!links.length) return [];

  const [queryVector] = await embedTexts(db, input.organizationId, [input.query]);
  if (!queryVector) return [];

  const limit = input.limit ?? RETRIEVE_K;
  const vectorSql = Prisma.raw(`'${embeddingLiteral(queryVector)}'::vector`);
  const kbIds = Prisma.join(links.map((item) => item.knowledgeBaseId));

  const rows = await db.$queryRaw<
    Array<{
      documentId: string;
      title: string;
      chunkIndex: number;
      content: string;
      knowledgeBaseId: string;
      score: number;
    }>
  >`
    SELECT
      d.id AS "documentId",
      d.title AS title,
      c."chunkIndex" AS "chunkIndex",
      c.content AS content,
      d."knowledgeBaseId" AS "knowledgeBaseId",
      (1 - (c."embeddingVec" <=> ${vectorSql}))::float AS score
    FROM "DocumentChunk" c
    INNER JOIN "Document" d ON d.id = c."documentId"
    WHERE d."organizationId" = ${input.organizationId}
      AND d.status = 'READY'
      AND d."knowledgeBaseId" IN (${kbIds})
      AND c."embeddingVec" IS NOT NULL
    ORDER BY c."embeddingVec" <=> ${vectorSql}
    LIMIT ${limit}
  `;

  return rows
    .filter((row) => Number.isFinite(row.score) && row.score > 0.05)
    .map((row) => ({
      documentId: row.documentId,
      title: row.title,
      chunkIndex: row.chunkIndex,
      content: row.content,
      snippet: row.content.slice(0, 280),
      knowledgeBaseId: row.knowledgeBaseId,
      score: row.score,
    }));
}
