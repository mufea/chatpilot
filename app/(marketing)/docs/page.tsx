import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documentation" };

export default function DocsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
      <p className="mt-4 text-muted-foreground">
        Phase 1 documents the foundation. Later phases will add OpenAPI, widget embed contracts,
        and provider setup.
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
