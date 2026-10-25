import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateToken } from "@/lib/crypto";

export function uploadRoot() {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }
  return path.join(process.cwd(), "data", "uploads");
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "document";
}

export async function storeUpload(input: {
  organizationId: string;
  documentId: string;
  filename: string;
  bytes: Buffer;
}) {
  const filename = `${generateToken(6)}-${safeName(input.filename)}`;
  const dir = path.join(process.cwd(), "data", "uploads", input.organizationId, input.documentId);
  await mkdir(dir, { recursive: true });
  const full = path.join(dir, filename);
  await writeFile(full, input.bytes);
  return path.posix.join(input.organizationId, input.documentId, filename);
}

export function resolveStoredPath(storageKey: string) {
  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
  const root = path.join(process.cwd(), "data", "uploads");
  const full = path.join(root, normalized);
  if (!full.startsWith(root)) {
    throw new Error("Invalid storage key.");
  }
  return full;
}

export async function removeStoredFile(storageKey?: string | null) {
  if (!storageKey) return;
  await unlink(resolveStoredPath(storageKey)).catch(() => undefined);
}
