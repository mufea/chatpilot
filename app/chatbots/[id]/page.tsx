import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatbotStatus, OrganizationRole } from "@prisma/client";
import {
  deleteChatbotAction,
  duplicateChatbotAction,
  publishChatbotAction,
} from "@/app/actions/chatbot";
import { BuilderForm } from "@/components/chatbots/builder-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentAuth } from "@/lib/auth/session";
import { getChatbotForOrg } from "@/lib/chatbot/service";
import { prisma } from "@/lib/db";
import { hasOrgRole } from "@/lib/org/access";
import { cn } from "@/lib/utils";

export default async function ChatbotEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const { id } = await params;
  const chatbot = await getChatbotForOrg(prisma, auth.activeOrganization.id, id).catch(() => null);
  if (!chatbot) notFound();
  const config = chatbot.configuration;
  const canManage = auth.activeMembership
    ? hasOrgRole(auth.activeMembership, OrganizationRole.ADMIN)
    : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{chatbot.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Status {chatbot.status} · public id {chatbot.publicId}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/chatbots/${chatbot.id}/playground`} className={cn(buttonVariants({ variant: "outline" }))}>
            Open playground
          </Link>
          {canManage ? (
            <>
              <form
                action={async () => {
                  "use server";
                  await publishChatbotAction(
                    chatbot.id,
                    chatbot.status === "PUBLISHED" ? ChatbotStatus.UNPUBLISHED : ChatbotStatus.PUBLISHED,
                  );
                }}
              >
                <Button type="submit" variant="outline">
                  {chatbot.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await duplicateChatbotAction(chatbot.id);
                }}
              >
                <Button type="submit" variant="outline">
                  Duplicate
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await deleteChatbotAction(chatbot.id);
                }}
              >
                <Button type="submit" variant="destructive">
                  Delete
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>
      <BuilderForm
        chatbotId={chatbot.id}
        canManage={canManage}
        initial={{
          name: chatbot.name,
          description: chatbot.description ?? "",
          avatarUrl: config?.avatarUrl ?? "",
          brandColor: config?.brandColor ?? "#2563EB",
          welcomeMessage: config?.welcomeMessage ?? "Hi! How can I help you today?",
          systemInstructions: config?.systemInstructions ?? "",
          persona: config?.persona ?? "",
          languages: (config?.languages ?? ["en"]).join(", "),
          provider: (config?.provider as "openai" | "gemini" | "anthropic") ?? "openai",
          model: config?.model ?? "gpt-4.1-mini",
          temperature: config?.temperature ?? 0.4,
          maxResponseTokens: config?.maxResponseTokens ?? 512,
          historyLimit: config?.historyLimit ?? 20,
          fallbackMessage: config?.fallbackMessage ?? "",
          suggestedQuestions: (config?.suggestedQuestions ?? []).join("\n"),
          conversationLimit: config?.conversationLimit?.toString() ?? "",
          collectLeads: config?.collectLeads ?? false,
          humanHandoffEnabled: config?.humanHandoffEnabled ?? false,
          handoffMessage: config?.handoffMessage ?? "",
          allowedDomains: (config?.allowedDomains ?? []).join("\n"),
          showSources: config?.showSources ?? true,
          fallbackEnabled: config?.fallbackEnabled ?? false,
          fallbackProvider: config?.fallbackProvider ?? "",
        }}
      />
    </div>
  );
}
