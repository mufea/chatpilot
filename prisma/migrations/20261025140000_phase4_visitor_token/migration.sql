-- Phase 4: hashed visitor session tokens for the public widget.

ALTER TABLE "VisitorSession" ADD COLUMN "tokenHash" TEXT;

UPDATE "VisitorSession"
SET "tokenHash" = "publicId"
WHERE "tokenHash" IS NULL;

ALTER TABLE "VisitorSession" ALTER COLUMN "tokenHash" SET NOT NULL;

CREATE UNIQUE INDEX "VisitorSession_tokenHash_key" ON "VisitorSession"("tokenHash");

CREATE INDEX "VisitorSession_chatbotId_idx" ON "VisitorSession"("chatbotId");
