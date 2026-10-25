import { collectConfigIssues, type ConfigIssue } from "@/lib/config";

export function formatStartupReport(issues: ConfigIssue[] = collectConfigIssues()) {
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checkedKeys: issues.map((issue) => issue.key),
  };
}
