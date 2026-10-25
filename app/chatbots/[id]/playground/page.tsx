import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlaygroundChat } from "@/components/chatbots/playground-chat";
import { buttonVariants } from "@/components/ui/button";
import { appConfig } from "@/lib/config";
import { getCurrentAuth } from "@/lib/auth/session";
import { getChatbotForOrg } from "@/lib/chatbot/service";
import { listOrganizationProviderStatus } from "@/lib/ai/credentials";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export default async function PlaygroundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const { id } = await params;
  const chatbot = await getChatbotForOrg(prisma, auth.activeOrganization.id, id).catch(() => null);
  if (!chatbot) notFound();
  const providers = await listOrganizationProviderStatus(prisma, auth.activeOrganization.id);
  const selected = chatbot.configuration?.provider ?? "openai";
  const selectedStatus = providers.find((item) => item.provider === selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{chatbot.name} playground</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {appConfig.aiMockMode
              ? "Mock mode is enabled for this environment."
              : selectedStatus?.hasCustomerKey || selectedStatus?.hasPlatformKey
                ? `Using ${selected} with a server-side key.`
                : `No ${selected} API key is configured. Requests will fail with a missing-credentials error.`}
          </p>
        </div>
        <Link href={`/chatbots/${chatbot.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
          Back to builder
        </Link>
      </div>
      <PlaygroundChat
        chatbotId={chatbot.id}
        welcomeMessage={chatbot.configuration?.welcomeMessage ?? "Hi! How can I help you today?"}
        suggestedQuestions={chatbot.configuration?.suggestedQuestions ?? []}
        mockMode={appConfig.aiMockMode}
        brandColor={chatbot.configuration?.brandColor ?? "#2563EB"}
      />
    </div>
  );
}
