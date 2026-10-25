import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { formatStartupReport } from "@/lib/startup-check";

export async function GET() {
  const report = formatStartupReport();
  return NextResponse.json({
    status: report.ok ? "ok" : "degraded",
    service: "chatpilot-web",
    phase: 2,
    ai: {
      mockMode: appConfig.aiMockMode,
      platformKeys: appConfig.platformKeysConfigured,
    },
    config: {
      ok: report.ok,
      errors: report.errors.map((issue) => ({ key: issue.key, message: issue.message })),
      warnings: report.warnings.map((issue) => ({ key: issue.key, message: issue.message })),
    },
  });
}
