import { DocumentSourceType } from "@prisma/client";
import { MAX_EXTRACT_CHARS } from "@/lib/knowledge/constants";

export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractError";
  }
}

function decodeText(buffer: Buffer) {
  if (buffer.includes(0)) {
    throw new ExtractError("Binary files must be PDF or DOCX.");
  }
  return buffer.toString("utf8").replace(/\u0000/g, "");
}

function collapse(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_EXTRACT_CHARS);
}

export function htmlToText(html: string) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
  return collapse(stripped);
}

export function extractFaq(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pairs: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const qa = line.match(/^q:\s*(.+)$/i);
    if (qa) {
      const next = lines[i + 1]?.match(/^a:\s*(.+)$/i);
      if (next) {
        pairs.push(`Question: ${qa[1]}\nAnswer: ${next[1]}`);
        i += 1;
        continue;
      }
    }
    const pipe = line.split("|").map((part) => part.trim());
    if (pipe.length === 2 && pipe[0] && pipe[1]) {
      pairs.push(`Question: ${pipe[0]}\nAnswer: ${pipe[1]}`);
      continue;
    }
    pairs.push(line);
  }
  return collapse(pairs.join("\n\n"));
}

export function extractCsv(text: string) {
  return collapse(
    text
      .split(/\r?\n/)
      .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")).filter(Boolean).join(" — "))
      .filter(Boolean)
      .join("\n"),
  );
}

export async function extractFromBuffer(
  buffer: Buffer,
  sourceType: DocumentSourceType,
  mimeType?: string | null,
) {
  if (sourceType === "PDF" || mimeType === "application/pdf") {
    const imported = (await import("pdf-parse")) as unknown as {
      default?: (data: Buffer) => Promise<{ text: string }>;
    };
    const pdfParse = imported.default;
    if (!pdfParse) throw new ExtractError("PDF parser is unavailable.");
    const parsed = await pdfParse(buffer);
    const text = collapse(parsed.text ?? "");
    if (!text) throw new ExtractError("No text could be extracted from the PDF.");
    return text;
  }
  if (sourceType === "DOCX") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = collapse(result.value ?? "");
    if (!text) throw new ExtractError("No text could be extracted from the Word document.");
    return text;
  }
  const raw = decodeText(buffer);
  if (sourceType === "FAQ") return extractFaq(raw);
  if (sourceType === "CSV") return extractCsv(raw);
  if (sourceType === "URL" || sourceType === "SITEMAP") return htmlToText(raw);
  return collapse(raw);
}

export function sniffSourceType(filename: string, mimeType?: string | null): DocumentSourceType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "PDF";
  if (lower.endsWith(".docx")) return "DOCX";
  if (lower.endsWith(".csv")) return "CSV";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "MARKDOWN";
  if (lower.endsWith(".txt") || mimeType === "text/plain") return "TXT";
  return null;
}
