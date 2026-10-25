import type { Metadata } from "next";

export const metadata: Metadata = { title: "Use cases" };

const cases = [
  {
    title: "Ecommerce stores",
    body: "Answer shipping, sizing, and return questions from your catalog and policies. Capture leads when a shopper wants a human.",
  },
  {
    title: "SaaS support",
    body: "Ground answers in product docs and release notes. Hand off to the inbox when the bot hits a confidence floor.",
  },
  {
    title: "Agencies",
    body: "Run multiple client workspaces from one ChatPilot account. White-label and higher seat limits arrive on Business.",
  },
  {
    title: "Internal help desks",
    body: "Publish an unpublished bot for employees only, attach policy documents, and keep tenant data isolated.",
  },
];

export default function UseCasesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Use cases</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        ChatPilot is for teams that need a durable chatbot product, not a one-off widget script.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {cases.map((item) => (
          <article key={item.title} className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
