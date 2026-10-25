import { NextResponse } from "next/server";
import { formatStartupReport } from "@/lib/startup-check";

export async function GET() {
  const report = formatStartupReport();
  return NextResponse.json({
    status: report.ok ? "ok" : "degraded",
    service: "chatpilot-web",
    phase: 1,
    config: {
      ok: report.ok,
      errors: report.errors.map((issue) => ({ key: issue.key, message: issue.message })),
      warnings: report.warnings.map((issue) => ({ key: issue.key, message: issue.message })),
    },
  });
}
