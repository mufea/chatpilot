import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { createPrismaClient } from "../lib/db";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://chatpilot:chatpilot_dev@127.0.0.1:5432/chatpilot_test";

let migrated = false;

export function testDb(): PrismaClient {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.EMAIL_DELIVERY = "console";
  process.env.ALLOW_DEV_MAILBOX = "true";
  process.env.APP_URL = "http://127.0.0.1:43180";
  process.env.AI_MOCK_MODE = process.env.AI_MOCK_MODE ?? "true";
  process.env.APP_ENCRYPTION_KEY =
    process.env.APP_ENCRYPTION_KEY ??
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  if (!migrated) {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "inherit",
    });
    migrated = true;
  }
  return createPrismaClient(TEST_DATABASE_URL);
}

export async function resetDb(db: PrismaClient) {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "OutboundEmail",
      "AuditLog",
      "UsageRecord",
      "CreditLedgerEntry",
      "CreditAccount",
      "Message",
      "Conversation",
      "DocumentChunk",
      "Document",
      "ChatbotKnowledgeBase",
      "KnowledgeBase",
      "BackgroundJob",
      "ChatbotConfiguration",
      "Chatbot",
      "AIProviderConfiguration",
      "Subscription",
      "Invitation",
      "OrganizationMember",
      "Session",
      "Account",
      "VerificationToken",
      "Organization",
      "User"
    RESTART IDENTITY CASCADE
  `);
}
