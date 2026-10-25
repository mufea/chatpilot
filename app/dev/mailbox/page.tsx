import { notFound } from "next/navigation";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DevMailboxPage() {
  if (!appConfig.allowDevMailbox) notFound();
  const messages = await prisma.outboundEmail.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Development mailbox</h1>
      <p className="text-sm text-muted-foreground">
        Visible only when ALLOW_DEV_MAILBOX=true and NODE_ENV is not production. Messages are
        stored locally so you can complete verification without SMTP.
      </p>
      {messages.length ? (
        messages.map((message) => (
          <article key={message.id} className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-medium">{message.subject}</p>
            <p className="text-xs text-muted-foreground">
              To {message.to} · {message.purpose} · {message.createdAt.toISOString()}
            </p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{message.textBody}</pre>
          </article>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No outbound messages yet.</p>
      )}
    </div>
  );
}
