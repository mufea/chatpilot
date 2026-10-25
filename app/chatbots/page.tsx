import { OrganizationRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentAuth } from "@/lib/auth/session";
import { listChatbots } from "@/lib/chatbot/service";
import { prisma } from "@/lib/db";
import { hasOrgRole } from "@/lib/org/access";
import { cn } from "@/lib/utils";

export default async function ChatbotsPage() {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const chatbots = await listChatbots(prisma, auth.activeOrganization.id);
  const canManage = auth.activeMembership
    ? hasOrgRole(auth.activeMembership, OrganizationRole.ADMIN)
    : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Chatbots</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create, configure, and publish isolated assistants for this workspace.
          </p>
        </div>
        {canManage ? (
          <Link href="/chatbots/new" className={cn(buttonVariants())}>
            New chatbot
          </Link>
        ) : null}
      </div>
      {chatbots.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {chatbots.map((chatbot) => (
            <li key={chatbot.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{chatbot.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {chatbot.description || "No description"}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{chatbot.status}</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {chatbot.configuration?.provider}/{chatbot.configuration?.model}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/chatbots/${chatbot.id}`} className={cn(buttonVariants({ size: "sm" }))}>
                  Configure
                </Link>
                <Link
                  href={`/chatbots/${chatbot.id}/playground`}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                >
                  Playground
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border bg-card p-8">
          <h2 className="font-semibold">No chatbots yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the first assistant for {auth.activeOrganization.name}. The Free plan allows one
            chatbot.
          </p>
        </div>
      )}
    </div>
  );
}
