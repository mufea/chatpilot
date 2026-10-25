import { MessageSender, type Conversation, type PrismaClient } from "@prisma/client";
import { resolveApiKey } from "@/lib/ai/credentials";
import { isAiMockMode } from "@/lib/ai/mode";
import { creditsFromUsage, refundReservation, reserveCredits, settleCredits } from "@/lib/ai/credits";
import { AIError } from "@/lib/ai/errors";
import { defaultModelFor } from "@/lib/ai/models";
import { buildSystemPrompt, toProviderMessages } from "@/lib/ai/prompts";
import { streamText } from "@/lib/ai/router";
import type { GenerateRequest, ProviderId, TokenUsage } from "@/lib/ai/types";
import { retrieveForChatbot } from "@/lib/knowledge/retrieve";
import type { Citation } from "@/lib/knowledge/types";
import { generateToken } from "@/lib/crypto";

export type AssistantTurnDelta =
  | { type: "delta"; text: string }
  | { type: "citations"; citations: Citation[] }
  | { type: "usage"; usage: TokenUsage; credits: number; provider: string; model: string }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

export type ChatbotForTurn = {
  id: string;
  name: string;
  organizationId: string;
  organization: { name: string };
  configuration: {
    provider: string;
    model: string;
    temperature: number;
    maxResponseTokens: number;
    historyLimit: number;
    fallbackMessage: string;
    fallbackEnabled: boolean;
    fallbackProvider: string | null;
    persona: string | null;
    systemInstructions: string;
    languages: string[];
    showSources: boolean;
  } | null;
};

export async function* runAssistantTurn(
  db: PrismaClient,
  input: {
    chatbot: ChatbotForTurn;
    conversation: Conversation;
    userText: string;
    abortSignal?: AbortSignal;
  },
): AsyncGenerator<AssistantTurnDelta> {
  const config = input.chatbot.configuration;
  if (!config) {
    throw new AIError("invalid_request", "This chatbot has no configuration.", false);
  }

  const history = await db.message.findMany({
    where: { conversationId: input.conversation.id },
    orderBy: { createdAt: "asc" },
    take: config.historyLimit,
  });

  const requestId = generateToken(16);
  const reservation = await reserveCredits(db, input.chatbot.organizationId, requestId);

  const primaryProvider = config.provider as ProviderId;
  let usedProvider = primaryProvider;
  let usedModel = config.model;
  let text = "";
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, source: "estimated" };
  let citations: Citation[] = [];

  try {
    await db.message.create({
      data: {
        conversationId: input.conversation.id,
        sender: MessageSender.VISITOR,
        content: input.userText,
      },
    });

    const retrieved = await retrieveForChatbot(db, {
      organizationId: input.chatbot.organizationId,
      chatbotId: input.chatbot.id,
      query: input.userText,
    });
    citations = retrieved.map((item) => ({
      documentId: item.documentId,
      title: item.title,
      chunkIndex: item.chunkIndex,
      snippet: item.snippet,
      score: item.score,
    }));
    if (citations.length) {
      yield { type: "citations", citations };
    }

    const system = buildSystemPrompt({
      organizationName: input.chatbot.organization.name,
      chatbotName: input.chatbot.name,
      persona: config.persona,
      systemInstructions: config.systemInstructions,
      fallbackMessage: config.fallbackMessage,
      languages: config.languages,
      sources: retrieved.map((item) => ({ title: item.title, snippet: item.snippet })),
    });

    const transcript = [
      ...history
        .filter((item) => item.sender === "VISITOR" || item.sender === "AI")
        .map((item) => ({
          role: item.sender === "AI" ? ("assistant" as const) : ("user" as const),
          content: item.content,
        })),
      { role: "user" as const, content: input.userText },
    ];

    const primaryRequest: GenerateRequest = {
      provider: primaryProvider,
      model: config.model,
      messages: toProviderMessages(system, transcript),
      temperature: config.temperature,
      maxOutputTokens: config.maxResponseTokens,
      abortSignal: input.abortSignal,
      apiKey: (await resolveApiKey(db, input.chatbot.organizationId, primaryProvider)).apiKey,
    };

    try {
      for await (const event of streamText(primaryRequest)) {
        if (event.type === "delta") {
          text += event.text;
          yield { type: "delta", text: event.text };
        }
        if (event.type === "usage") usage = event.usage;
      }
    } catch (error) {
      if (text || !config.fallbackEnabled || !config.fallbackProvider) {
        throw error;
      }
      const fallbackProvider = config.fallbackProvider as ProviderId;
      const fallbackRequest: GenerateRequest = {
        ...primaryRequest,
        provider: fallbackProvider,
        model: defaultModelFor(fallbackProvider),
        apiKey: (await resolveApiKey(db, input.chatbot.organizationId, fallbackProvider)).apiKey,
      };
      usedProvider = fallbackProvider;
      usedModel = fallbackRequest.model;
      for await (const event of streamText(fallbackRequest)) {
        if (event.type === "delta") {
          text += event.text;
          yield { type: "delta", text: event.text };
        }
        if (event.type === "usage") usage = event.usage;
      }
    }

    if (isAiMockMode()) {
      usedProvider = "mock";
      usedModel = "mock-chat";
    }

    const reply = text.trim() || config.fallbackMessage;
    const credits = creditsFromUsage(usage);
    await db.message.create({
      data: {
        conversationId: input.conversation.id,
        sender: MessageSender.AI,
        content: reply,
        citations: config.showSources ? citations : [],
        usage: {
          provider: usedProvider,
          model: usedModel,
          ...usage,
          credits,
          requestId,
        },
      },
    });
    await db.conversation.update({
      where: { id: input.conversation.id },
      data: { updatedAt: new Date() },
    });
    await settleCredits(db, {
      organizationId: input.chatbot.organizationId,
      accountId: reservation.accountId,
      requestId,
      reserved: reservation.reserved,
      actual: credits,
      usage,
      provider: usedProvider,
      model: usedModel,
      chatbotId: input.chatbot.id,
    });
    yield { type: "usage", usage, credits, provider: usedProvider, model: usedModel };
    yield { type: "done" };
  } catch (error) {
    await refundReservation(db, reservation.accountId, requestId, reservation.reserved);
    throw error;
  }
}

export async function assertConversationCapacity(
  db: PrismaClient,
  conversationId: string,
  conversationLimit: number | null,
) {
  if (!conversationLimit) return;
  const userTurns = await db.message.count({
    where: { conversationId, sender: MessageSender.VISITOR },
  });
  if (userTurns >= conversationLimit) {
    throw new AIError("invalid_request", "This conversation has reached its message limit.", false);
  }
}
