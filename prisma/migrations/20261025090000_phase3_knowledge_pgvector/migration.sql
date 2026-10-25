CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Document" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DocumentChunk" ADD COLUMN "embeddingVec" vector(1536);

CREATE INDEX "DocumentChunk_embeddingVec_hnsw" ON "DocumentChunk" USING hnsw ("embeddingVec" vector_cosine_ops);
