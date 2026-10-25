import { OrganizationRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { listKnowledgeBases } from "@/lib/knowledge/service";
import { hasOrgRole } from "@/lib/org/access";
import { cn } from "@/lib/utils";

export default async function KnowledgePage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const bases = await listKnowledgeBases(prisma, auth.activeOrganization.id);
  const canManage = auth.activeMembership
    ? hasOrgRole(auth.activeMembership, OrganizationRole.ADMIN)
    : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Knowledge bases</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingest documents and public pages, embed them, and attach them to a chatbot for grounded answers.
          </p>
        </div>
        {canManage ? (
          <Link href="/knowledge/new" className={cn(buttonVariants())}>
            New knowledge base
          </Link>
        ) : null}
      </div>
      {bases.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {bases.map((kb) => (
            <li key={kb.id} className="rounded-2xl border bg-card p-5">
              <p className="font-semibold">{kb.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{kb.description || "No description"}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {kb._count.documents} document{kb._count.documents === 1 ? "" : "s"} · linked to{" "}
                {kb._count.chatbotLinks} chatbot{kb._count.chatbotLinks === 1 ? "" : "s"}
              </p>
              <Link href={`/knowledge/${kb.id}`} className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border bg-card p-8">
          <h2 className="font-semibold">No knowledge bases yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The Free plan allows one knowledge base with five documents.
          </p>
        </div>
      )}
    </div>
  );
}
