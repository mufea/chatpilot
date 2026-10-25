import { collectConfigIssues } from "../lib/config";

const issues = collectConfigIssues();
const errors = issues.filter((issue) => issue.level === "error");
const warnings = issues.filter((issue) => issue.level === "warning");

console.log("ChatPilot configuration check");
console.log(`errors=${errors.length} warnings=${warnings.length}`);
for (const issue of issues) {
  console.log(`${issue.level}: ${issue.key} - ${issue.message}`);
}

if (errors.length) {
  process.exit(1);
}
