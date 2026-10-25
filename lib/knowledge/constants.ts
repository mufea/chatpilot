export const EMBEDDING_DIMENSIONS = 1536;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_EXTRACT_CHARS = 400_000;
export const MAX_FETCH_BYTES = 2 * 1024 * 1024;
export const MAX_SITEMAP_PAGES = 8;
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;
export const RETRIEVE_K = 5;
export const MAX_JOB_ATTEMPTS = 3;
export const INGEST_JOB_TYPE = "ingest_document";

export const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".faq"]);
export const ALLOWED_UPLOADS: Record<string, { sourceType: "PDF" | "TXT" | "MARKDOWN" | "DOCX" | "CSV"; mime: string[] }> = {
  ".txt": { sourceType: "TXT", mime: ["text/plain"] },
  ".md": { sourceType: "MARKDOWN", mime: ["text/markdown", "text/plain"] },
  ".markdown": { sourceType: "MARKDOWN", mime: ["text/markdown", "text/plain"] },
  ".csv": { sourceType: "CSV", mime: ["text/csv", "text/plain"] },
  ".pdf": { sourceType: "PDF", mime: ["application/pdf"] },
  ".docx": {
    sourceType: "DOCX",
    mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  },
};
