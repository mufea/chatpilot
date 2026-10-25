import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");

  const [chatbotCount, publishedCount, creditAccount, subscription, knowledgeCount] = await Promise.all([
    prisma.chatbot.count({
      where: { organizationId: auth.activeOrganization.id, deletedAt: null },
    }),
    prisma.chatbot.count({
      where: { organizationId: auth.activeOrganization.id, status: "PUBLISHED", deletedAt: null },
    }),
    prisma.creditAccount.findUnique({
      where: { organizationId: auth.activeOrganization.id },
    }),
    prisma.subscription.findUnique({
      where: { organizationId: auth.activeOrganization.id },
      include: { plan: true },
    }),
    prisma.knowledgeBase.count({
      where: { organizationId: auth.activeOrganization.id },
    }),
  ]);

  const cards = [
    { label: "Chatbots", value: chatbotCount, hint: "Configure and play in Chatbots" },
    { label: "Published", value: publishedCount, hint: "Allowlist a domain to embed the widget" },
    { label: "Knowledge bases", value: knowledgeCount, hint: "Documents and URLs for retrieval" },
    { label: "Credit balance", value: creditAccount?.balance ?? 0, hint: "Welcome grant recorded in the ledger" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Workspace <span className="font-medium text-foreground">{auth.activeOrganization.name}</span>
          {subscription?.plan ? ` · ${subscription.plan.name} · ${subscription.status}` : " · No subscription row yet"}
        </p>
      </div>
      {!auth.user.emailVerifiedAt ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Verify your email before you can publish a chatbot.{" "}
          <Link href="/verify-email" className="font-medium text-primary hover:underline">
            Open verification
          </Link>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold">{card.value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{card.hint}</p>
          </article>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">What you can do now</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Create a chatbot, set instructions, and publish after verifying email.</li>
          <li>Send playground messages. Usage and credits are recorded from actual tokens.</li>
          <li>Ingest documents or public URLs, attach the knowledge base to a chatbot, and ask in the playground.</li>
          <li>Add encrypted OpenAI, Gemini, or Anthropic keys in Settings, or keep AI_MOCK_MODE on.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/chatbots" className={cn(buttonVariants())}>
            Open chatbots
          </Link>
          <Link href="/knowledge" className={cn(buttonVariants({ variant: "outline" }))}>
            Knowledge
          </Link>
        </div>
      </div>
    </div>
  );
}
