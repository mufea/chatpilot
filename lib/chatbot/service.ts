import { ChatbotStatus, OrganizationRole, type Prisma, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { defaultModelFor, getModelDefinition } from "@/lib/ai/models";
import { isProviderId, type ProviderId } from "@/lib/ai/types";
import { MAX_SYSTEM_INSTRUCTION_CHARS } from "@/lib/ai/prompts";
import { requireMembership } from "@/lib/org/service";
import { DEFAULT_PLANS, type PlanLimits } from "@/lib/plans";

export class ChatbotError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type ChatbotConfigInput = {
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  brandColor?: string;
  welcomeMessage?: string;
  systemInstructions?: string;
  persona?: string | null;
  languages?: string[];
  provider?: string;
  model?: string;
  temperature?: number;
  maxResponseTokens?: number;
  historyLimit?: number;
  fallbackMessage?: string;
  suggestedQuestions?: string[];
  conversationLimit?: number | null;
  collectLeads?: boolean;
  humanHandoffEnabled?: boolean;
  handoffMessage?: string | null;
  allowedDomains?: string[];
  showSources?: boolean;
  removeBranding?: boolean;
  fallbackEnabled?: boolean;
  fallbackProvider?: string | null;
};

const chatbotInclude = {
  configuration: true,
} satisfies Prisma.ChatbotInclude;

async function planLimits(db: PrismaClient, organizationId: string): Promise<PlanLimits> {
  const subscription = await db.subscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });
  const limits = subscription?.plan.limits as PlanLimits | undefined;
  return limits ?? DEFAULT_PLANS[0]!.limits;
}

export async function listChatbots(db: PrismaClient, organizationId: string) {
  return db.chatbot.findMany({
    where: { organizationId, deletedAt: null },
    include: chatbotInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getChatbotForOrg(db: PrismaClient, organizationId: string, chatbotId: string) {
  const chatbot = await db.chatbot.findFirst({
    where: { id: chatbotId, organizationId, deletedAt: null },
    include: { configuration: true, organization: true },
  });
  if (!chatbot) {
    throw new ChatbotError("Chatbot not found.", 404);
  }
  return chatbot;
}

export async function createChatbot(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; name: string; description?: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const limits = await planLimits(db, input.organizationId);
  const existing = await db.chatbot.count({
    where: { organizationId: input.organizationId, deletedAt: null },
  });
  if (existing >= limits.chatbots) {
    throw new ChatbotError(`This plan allows ${limits.chatbots} chatbot${limits.chatbots === 1 ? "" : "s"}.`);
  }

  const chatbot = await db.chatbot.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      configuration: { create: {} },
    },
    include: chatbotInclude,
  });
  await writeAuditLog(db, {
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: "chatbot.created",
    targetType: "chatbot",
    targetId: chatbot.id,
  });
  return chatbot;
}

export function normalizeConfig(input: ChatbotConfigInput) {
  const provider = (input.provider ?? "openai").toLowerCase();
  if (!isProviderId(provider) || provider === "mock") {
    throw new ChatbotError("Choose OpenAI, Gemini, or Anthropic.");
  }
  const model = input.model ?? defaultModelFor(provider);
  if (!getModelDefinition(provider as ProviderId, model)) {
    throw new ChatbotError("That model is not available for the selected provider.");
  }
  let fallbackProvider = input.fallbackProvider?.toLowerCase() || null;
  if (input.fallbackEnabled) {
    if (!fallbackProvider || !isProviderId(fallbackProvider) || fallbackProvider === "mock") {
      throw new ChatbotError("Choose a valid fallback provider.");
    }
    if (fallbackProvider === provider) {
      throw new ChatbotError("Fallback provider must be different from the primary provider.");
    }
  } else {
    fallbackProvider = null;
  }

  const color = input.brandColor ?? "#2563EB";
  if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
    throw new ChatbotError("Brand color must be a 6-digit hex value.");
  }

  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    avatarUrl: input.avatarUrl?.trim() || null,
    brandColor: color,
    welcomeMessage: (input.welcomeMessage ?? "Hi! How can I help you today?").trim().slice(0, 500),
    systemInstructions: (input.systemInstructions ?? "").slice(0, MAX_SYSTEM_INSTRUCTION_CHARS),
    persona: input.persona?.trim() || null,
    languages: (input.languages?.length ? input.languages : ["en"]).slice(0, 8),
    provider,
    model,
    temperature: Math.min(2, Math.max(0, input.temperature ?? 0.4)),
    maxResponseTokens: Math.min(4096, Math.max(16, input.maxResponseTokens ?? 512)),
    historyLimit: Math.min(40, Math.max(2, input.historyLimit ?? 20)),
    fallbackMessage: (input.fallbackMessage ?? "I am not sure I can help with that.").trim().slice(0, 500),
    suggestedQuestions: (input.suggestedQuestions ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8),
    conversationLimit: input.conversationLimit ?? null,
    collectLeads: Boolean(input.collectLeads),
    humanHandoffEnabled: Boolean(input.humanHandoffEnabled),
    handoffMessage: input.handoffMessage?.trim() || null,
    allowedDomains: (input.allowedDomains ?? [])
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 25),
    showSources: input.showSources ?? true,
    removeBranding: Boolean(input.removeBranding),
    fallbackEnabled: Boolean(input.fallbackEnabled),
    fallbackProvider,
  };
}

export async function updateChatbot(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; chatbotId: string; data: ChatbotConfigInput },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const chatbot = await getChatbotForOrg(db, input.organizationId, input.chatbotId);
  const data = normalizeConfig(input.data);
  const updated = await db.chatbot.update({
    where: { id: chatbot.id },
    data: {
      name: data.name,
      description: data.description,
      configuration: {
        upsert: {
          create: {
            avatarUrl: data.avatarUrl,
            brandColor: data.brandColor,
            welcomeMessage: data.welcomeMessage,
            systemInstructions: data.systemInstructions,
            persona: data.persona,
            languages: data.languages,
            provider: data.provider,
            model: data.model,
            temperature: data.temperature,
            maxResponseTokens: data.maxResponseTokens,
            historyLimit: data.historyLimit,
            fallbackMessage: data.fallbackMessage,
            suggestedQuestions: data.suggestedQuestions,
            conversationLimit: data.conversationLimit,
            collectLeads: data.collectLeads,
            humanHandoffEnabled: data.humanHandoffEnabled,
            handoffMessage: data.handoffMessage,
            allowedDomains: data.allowedDomains,
            showSources: data.showSources,
            removeBranding: data.removeBranding,
            fallbackEnabled: data.fallbackEnabled,
            fallbackProvider: data.fallbackProvider,
          },
          update: {
            avatarUrl: data.avatarUrl,
            brandColor: data.brandColor,
            welcomeMessage: data.welcomeMessage,
            systemInstructions: data.systemInstructions,
            persona: data.persona,
            languages: data.languages,
            provider: data.provider,
            model: data.model,
            temperature: data.temperature,
            maxResponseTokens: data.maxResponseTokens,
            historyLimit: data.historyLimit,
            fallbackMessage: data.fallbackMessage,
            suggestedQuestions: data.suggestedQuestions,
            conversationLimit: data.conversationLimit,
            collectLeads: data.collectLeads,
            humanHandoffEnabled: data.humanHandoffEnabled,
            handoffMessage: data.handoffMessage,
            allowedDomains: data.allowedDomains,
            showSources: data.showSources,
            removeBranding: data.removeBranding,
            fallbackEnabled: data.fallbackEnabled,
            fallbackProvider: data.fallbackProvider,
          },
        },
      },
    },
    include: chatbotInclude,
  });
  return updated;
}

export async function setChatbotStatus(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    chatbotId: string;
    status: ChatbotStatus;
    emailVerified: boolean;
  },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  if (input.status === ChatbotStatus.PUBLISHED && !input.emailVerified) {
    throw new ChatbotError("Verify your email before publishing a chatbot.");
  }
  const chatbot = await getChatbotForOrg(db, input.organizationId, input.chatbotId);
  return db.chatbot.update({
    where: { id: chatbot.id },
    data: { status: input.status },
    include: chatbotInclude,
  });
}

export async function duplicateChatbot(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; chatbotId: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const limits = await planLimits(db, input.organizationId);
  const existing = await db.chatbot.count({
    where: { organizationId: input.organizationId, deletedAt: null },
  });
  if (existing >= limits.chatbots) {
    throw new ChatbotError(`This plan allows ${limits.chatbots} chatbot${limits.chatbots === 1 ? "" : "s"}.`);
  }
  const source = await getChatbotForOrg(db, input.organizationId, input.chatbotId);
  const config = source.configuration;
  return db.chatbot.create({
    data: {
      organizationId: input.organizationId,
      name: `${source.name} copy`,
      description: source.description,
      status: ChatbotStatus.DRAFT,
      configuration: config
        ? {
            create: {
              avatarUrl: config.avatarUrl,
              brandColor: config.brandColor,
              welcomeMessage: config.welcomeMessage,
              systemInstructions: config.systemInstructions,
              persona: config.persona,
              languages: config.languages,
              provider: config.provider,
              model: config.model,
              temperature: config.temperature,
              maxResponseTokens: config.maxResponseTokens,
              historyLimit: config.historyLimit,
              fallbackMessage: config.fallbackMessage,
              suggestedQuestions: config.suggestedQuestions,
              conversationLimit: config.conversationLimit,
              collectLeads: config.collectLeads,
              humanHandoffEnabled: config.humanHandoffEnabled,
              handoffMessage: config.handoffMessage,
              allowedDomains: config.allowedDomains,
              showSources: config.showSources,
              removeBranding: config.removeBranding,
              fallbackEnabled: config.fallbackEnabled,
              fallbackProvider: config.fallbackProvider,
            },
          }
        : { create: {} },
    },
    include: chatbotInclude,
  });
}

export async function deleteChatbot(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; chatbotId: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId, OrganizationRole.ADMIN);
  const chatbot = await getChatbotForOrg(db, input.organizationId, input.chatbotId);
  await db.chatbot.update({
    where: { id: chatbot.id },
    data: { deletedAt: new Date(), status: ChatbotStatus.UNPUBLISHED },
  });
}
