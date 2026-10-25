import { ChatbotStatus, type PrismaClient } from "@prisma/client";
import { WidgetError } from "@/lib/widget/errors";
import { originAllowed } from "@/lib/widget/origin";

const chatbotInclude = {
  configuration: true,
  organization: { select: { name: true } },
} as const;

export type PublishedWidgetChatbot = Awaited<ReturnType<typeof loadPublishedWidgetChatbot>>;

export type PublicWidgetConfig = {
  publicId: string;
  name: string;
  welcomeMessage: string;
  brandColor: string;
  avatarUrl: string | null;
  suggestedQuestions: string[];
  languages: string[];
  showSources: boolean;
  removeBranding: boolean;
  fallbackMessage: string;
  collectLeads: boolean;
  humanHandoffEnabled: boolean;
};

const SECRET_KEYS = [
  "organizationId",
  "id",
  "provider",
  "model",
  "systemInstructions",
  "persona",
  "fallbackProvider",
  "encryptedApiKey",
  "apiKey",
  "temperature",
  "maxResponseTokens",
] as const;

export async function loadPublishedWidgetChatbot(db: PrismaClient, publicId: string) {
  const chatbot = await db.chatbot.findFirst({
    where: { publicId, deletedAt: null },
    include: chatbotInclude,
  });
  if (!chatbot || chatbot.status !== ChatbotStatus.PUBLISHED || !chatbot.configuration) {
    throw new WidgetError("Chatbot is not available.", 404, "not_found");
  }
  return chatbot;
}

export function toPublicWidgetConfig(chatbot: PublishedWidgetChatbot): PublicWidgetConfig {
  const config = chatbot.configuration!;
  return {
    publicId: chatbot.publicId,
    name: chatbot.name,
    welcomeMessage: config.welcomeMessage,
    brandColor: config.brandColor,
    avatarUrl: config.avatarUrl,
    suggestedQuestions: config.suggestedQuestions,
    languages: config.languages,
    showSources: config.showSources,
    removeBranding: config.removeBranding,
    fallbackMessage: config.fallbackMessage,
    collectLeads: config.collectLeads,
    humanHandoffEnabled: config.humanHandoffEnabled,
  };
}

export async function getPublicWidgetConfig(
  db: PrismaClient,
  input: { publicId: string; origin: string | null },
): Promise<PublicWidgetConfig> {
  const chatbot = await loadPublishedWidgetChatbot(db, input.publicId);
  const allowed = chatbot.configuration?.allowedDomains ?? [];
  if (!allowed.length) {
    throw new WidgetError("This chatbot has no allowed website domains.", 403, "origin_denied");
  }
  if (!originAllowed(input.origin, allowed)) {
    throw new WidgetError("This website is not allowed to embed the chatbot.", 403, "origin_denied");
  }
  return toPublicWidgetConfig(chatbot);
}

export function assertNoSecretLeak(payload: unknown): void {
  const json = JSON.stringify(payload);
  for (const key of SECRET_KEYS) {
    if (new RegExp(`"${key}"\\s*:`).test(json)) {
      throw new WidgetError("Public widget payload contained a private field.", 500, "leak");
    }
  }
}
