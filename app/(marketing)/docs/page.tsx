import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documentation" };

export default function DocsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
      <p className="mt-4 text-muted-foreground">
        Phase 3 covers knowledge ingestion, pgvector retrieval, and cited playground answers.
        Later phases will add the widget, inbox, billing, and a public API.
      </p>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Local development</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Copy <code>.env.example</code> to <code>.env</code> and set <code>DATABASE_URL</code>.</li>
          <li>Start PostgreSQL with Docker Compose or a local server.</li>
          <li>Run <code>npx prisma migrate deploy</code> and <code>npm run db:seed</code>.</li>
          <li>Run <code>npm run check:env</code> to confirm required configuration without printing secrets.</li>
          <li>Start the app with <code>npm run dev -- --port 43180</code>.</li>
        </ol>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Sessions are stored in PostgreSQL and referenced by an httpOnly cookie. Email
          verification and password reset tokens are hashed at rest. In development, set
          <code> EMAIL_DELIVERY=console</code> and <code>ALLOW_DEV_MAILBOX=true</code> to read
          outbound messages at <code>/dev/mailbox</code>.
        </p>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Chatbots and providers</h2>
        <p className="text-sm text-muted-foreground">
          Create a chatbot under <code>/chatbots</code>, then test it in the playground. With
          <code>AI_MOCK_MODE=true</code> replies are deterministic. To call a live vendor, set
          <code>AI_MOCK_MODE=false</code> and add a platform key or an encrypted workspace key at
          <code>/settings/providers</code>. Secrets are never returned in API responses.
        </p>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Knowledge and retrieval</h2>
        <p className="text-sm text-muted-foreground">
          Upload <code>.txt</code>, <code>.md</code>, <code>.csv</code>, <code>.pdf</code>, or{" "}
          <code>.docx</code>, paste text, or ingest a public URL. Private, loopback, and link-local
          hosts are blocked. Documents are processed through the <code>BackgroundJob</code> queue,
          embedded, and stored in pgvector. Attach a knowledge base to a chatbot so playground
          answers can cite sources.
        </p>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Future widget contract</h2>
        <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs">
{`<script
  src="https://YOUR-DOMAIN/widget.js"
  data-chatbot-id="PUBLIC_CHATBOT_ID"
  async
></script>`}
        </pre>
        <p className="text-sm text-muted-foreground">
          The snippet is reserved. Phase 4 will publish the versioned bundle, origin checks, and
          visitor session rules. Do not embed it yet.
        </p>
      </section>
    </div>
  );
}
