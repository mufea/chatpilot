-- AlterTable
ALTER TABLE "ChatbotConfiguration" ADD COLUMN "fallbackEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatbotConfiguration" ADD COLUMN "fallbackProvider" TEXT;
