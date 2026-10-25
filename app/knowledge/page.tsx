export default function KnowledgePage() {
  return (
    <div className="rounded-2xl border bg-card p-8">
      <h1 className="text-2xl font-semibold">Knowledge bases</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Document upload, URL ingestion, embeddings, and retrieval ship in Phase 3. The Prisma
        models already exist so later work does not require a schema rewrite.
      </p>
    </div>
  );
}
