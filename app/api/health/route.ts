import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatStartupReport } from "@/lib/startup-check";

export async function GET() {
  const report = formatStartupReport();
  let pgvector = false;
  try {
    const rows = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    pgvector = rows.length > 0;
  } catch {
    pgvector = false;
  }
  return NextResponse.json({
    status: report.ok ? "ok" : "degraded",
    service: "chatpilot-web",
    phase: 4,
    ai: {
      mockMode: appConfig.aiMockMode,
      platformKeys: appConfig.platformKeysConfigured,
    },
    rag: {
      pgvector,
      storage: process.env.STORAGE_DRIVER || "local",
    },
    widget: {
      version: "v1",
      script: "/widget/v1.js",
      alias: "/widget.js",
    },
    config: {
      ok: report.ok,
      errors: report.errors.map((issue) => ({ key: issue.key, message: issue.message })),
      warnings: report.warnings.map((issue) => ({ key: issue.key, message: issue.message })),
    },
  });
}
