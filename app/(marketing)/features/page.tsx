import type { Metadata } from "next";

export const metadata: Metadata = { title: "Features" };

const groups = [
  {
    title: "Available now",
    items: [
      "Email and password registration with hashed credentials",
      "Email verification and password reset",
      "Secure httpOnly session cookies",
      "Organization workspaces, invitations, and roles",
      "Account export and account deletion",
      "Platform super-admin directory",
      "Health, readiness, and configuration checks",
      "Chatbot CRUD, publish, duplicate, and soft-delete",
      "Playground with streaming replies and usage tracking",
      "OpenAI, Gemini, and Anthropic adapters with normalized errors",
      "Encrypted workspace API keys kept on the server",
      "Document and URL ingestion with SSRF protection",
      "pgvector retrieval, grounded replies, and source citations",
      "Versioned Shadow DOM website widget with isolated styles",
      "Visitor sessions, domain allowlisting, and widget rate limits",
      "Public chatbot ids that never expose provider credentials",
      "Configurable plans, atomic credit ledger, and server-side entitlements",
      "Stripe checkout and signature-verified webhooks",
      "Optional Midtrans notifications with SHA-512 verification",
      "Workspace analytics and platform audit logs",
    ],
  },
  {
    title: "Designed, not yet shipped",
    items: [
      "Live inbox and human handoff",
      "Versioned public API with hashed API keys",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Features that match the product, not the pitch deck</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        ChatPilot lists completed work separately from planned work. If a capability is not
        implemented, it will not appear as a live control that pretends to succeed.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold">{group.title}</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
