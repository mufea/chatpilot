import type { PrismaClient } from "@prisma/client";
import { geminiAdapter } from "@/lib/ai/adapters/gemini";
import { mockAdapter } from "@/lib/ai/adapters/mock";
import { openaiAdapter } from "@/lib/ai/adapters/openai";
import { resolveApiKey } from "@/lib/ai/credentials";
import { AIError } from "@/lib/ai/errors";
import { isAiMockMode } from "@/lib/ai/mode";
import { EMBEDDING_DIMENSIONS } from "@/lib/knowledge/constants";

export function padEmbedding(vector: number[], dimensions = EMBEDDING_DIMENSIONS) {
  const next = new Array(dimensions).fill(0);
  const limit = Math.min(vector.length, dimensions);
  for (let i = 0; i < limit; i += 1) next[i] = vector[i] ?? 0;
  return next;
}

export function embeddingLiteral(vector: number[]) {
  return `[${padEmbedding(vector).map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export async function embedTexts(db: PrismaClient, organizationId: string, texts: string[]) {
  if (!texts.length) return [] as number[][];
  if (isAiMockMode()) {
    const result = await mockAdapter.embed!(texts, "mock-key");
    return result.vectors.map((vector) => padEmbedding(vector));
  }

  const errors: string[] = [];
  for (const provider of ["openai", "gemini"] as const) {
    try {
      const resolved = await resolveApiKey(db, organizationId, provider);
      const adapter = provider === "openai" ? openaiAdapter : geminiAdapter;
      if (!adapter.embed) continue;
      const result = await adapter.embed(texts, resolved.apiKey);
      return result.vectors.map((vector) => padEmbedding(vector));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new AIError(
    "missing_credentials",
    `No embedding provider is configured. ${errors[0] ?? ""}`.trim(),
    false,
  );
}
