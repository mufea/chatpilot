import { estimateTokens } from "@/lib/ai/http";
import { CHUNK_OVERLAP, CHUNK_SIZE } from "@/lib/knowledge/constants";

export type TextChunk = {
  content: string;
  chunkIndex: number;
  tokenCount: number;
};

export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): TextChunk[] {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const pieces: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).trim().length <= size) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) pieces.push(current);
    if (paragraph.length <= size) {
      current = paragraph;
      continue;
    }
    for (let i = 0; i < paragraph.length; i += size - overlap) {
      pieces.push(paragraph.slice(i, i + size));
    }
    current = "";
  }
  if (current) pieces.push(current);

  const merged: string[] = [];
  for (const piece of pieces) {
    const last = merged[merged.length - 1];
    if (last && last.length + piece.length + 2 <= size) {
      merged[merged.length - 1] = `${last}\n\n${piece}`;
    } else {
      merged.push(piece);
    }
  }

  return merged
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content, chunkIndex) => ({
      content,
      chunkIndex,
      tokenCount: estimateTokens(content),
    }));
}
