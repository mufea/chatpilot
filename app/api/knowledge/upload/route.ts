import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth/session";
import { addUploadedDocument } from "@/lib/knowledge/ingest";
import { KnowledgeError } from "@/lib/knowledge/service";
import { processQueuedJobs } from "@/lib/knowledge/process";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const limit = consumeRateLimit(`upload:${auth.user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many uploads. Wait a moment." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const knowledgeBaseId = String(form?.get("knowledgeBaseId") ?? "");
  if (!knowledgeBaseId || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file and knowledge base." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const document = await addUploadedDocument(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      knowledgeBaseId,
      filename: file.name,
      mimeType: file.type,
      bytes,
    });
    await processQueuedJobs(prisma);
    const fresh = await prisma.document.findUnique({ where: { id: document.id } });
    return NextResponse.json({
      id: document.id,
      status: fresh?.status ?? document.status,
      title: fresh?.title ?? document.title,
      errorMessage: fresh?.errorMessage ?? null,
    });
  } catch (error) {
    if (error instanceof KnowledgeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 400 });
  }
}
