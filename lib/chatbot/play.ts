import { MessageSender, type PrismaClient } from "@prisma/client";
import { resolveApiKey } from "@/lib/ai/credentials";
import { isAiMockMode } from "@/lib/ai/mode";
import { creditsFromUsage, refundReservation, reserveCredits, settleCredits } from "@/lib/ai/credits";
import { AIError } from "@/lib/ai/errors";
import { defaultModelFor } from "@/lib/ai/models";
import { buildSystemPrompt, sanitizeUserMessage, toProviderMessages } from "@/lib/ai/prompts";
import { streamText } from "@/lib/ai/router";
import type { GenerateRequest, ProviderId, TokenUsage } from "@/lib/ai/types";
import { getChatbotForOrg } from "@/lib/chatbot/service";
import { retrieveForChatbot } from "@/lib/knowledge/retrieve";
import type { Citation } from "@/lib/knowledge/types";
import { generateToken } from "@/lib/crypto";
import { requireMembership } from "@/lib/org/service";

export type PlayDelta =
  | { type: "conversation"; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "citations"; citations: Citation[] }
  | { type: "usage"; usage: TokenUsage; credits: number; provider: string; model: string }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

export async function* playChatbot(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    chatbotId: string;
    conversationId?: string;
    message: string;
    abortSignal?: AbortSignal;
  },
): AsyncGenerator<PlayDelta> {
  await requireMembership(db, input.actorUserId, input.organizationId);
  const chatbot = await getChatbotForOrg(db, input.organizationId, input.chatbotId);
  const config = chatbot.configuration;
  if (!config) {
    throw new AIError("invalid_request", "This chatbot has no configuration.", false);
  }

  const userText = sanitizeUserMessage(input.message);
  if (!userText) {
    throw new AIError("invalid_request", "Message cannot be empty.", false);
  }

  let conversation = input.conversationId
    ? await db.conversation.findFirst({
        where: {
          id: input.conversationId,
          organizationId: input.organizationId,
          chatbotId: chatbot.id,
        },
      })
    : null;

  if (input.conversationId && !conversation) {
    throw new AIError("invalid_request", "Conversation not found for this chatbot.", false);
  }

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        organizationId: input.organizationId,
        chatbotId: chatbot.id,
        status: "AI_ACTIVE",
      },
    });
  }

  if (conversation.status === "HUMAN_TAKEOVER") {
    throw new AIError("invalid_request", "A teammate owns this conversation.", false);
  }

  const history = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: config.historyLimit,
  });
  const userTurns = history.filter((item) => item.sender === "VISITOR").length;
  if (config.conversationLimit && userTurns >= config.conversationLimit) {
    throw new AIError("invalid_request", "This conversation has reached its message limit.", false);
  }

  yield { type: "conversation", conversationId: conversation.id };

  const requestId = generateToken(16);
  const reservation = await reserveCredits(db, input.organizationId, requestId);

  const primaryProvider = config.provider as ProviderId;
  let usedProvider = primaryProvider;
  let usedModel = config.model;
  let text = "";
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, source: "estimated" };
  let citations: Citation[] = [];

  try {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        sender: MessageSender.VISITOR,
        content: userText,
      },
    });

    const retrieved = await retrieveForChatbot(db, {
      organizationId: input.organizationId,
      chatbotId: chatbot.id,
      query: userText,
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
      organizationName: chatbot.organization.name,
      chatbotName: chatbot.name,
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
      { role: "user" as const, content: userText },
    ];

    const primaryRequest: GenerateRequest = {
      provider: primaryProvider,
      model: config.model,
      messages: toProviderMessages(system, transcript),
      temperature: config.temperature,
      maxOutputTokens: config.maxResponseTokens,
      abortSignal: input.abortSignal,
      apiKey: (await resolveApiKey(db, input.organizationId, primaryProvider)).apiKey,
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
        apiKey: (await resolveApiKey(db, input.organizationId, fallbackProvider)).apiKey,
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
        conversationId: conversation.id,
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
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    await settleCredits(db, {
      organizationId: input.organizationId,
      accountId: reservation.accountId,
      requestId,
      reserved: reservation.reserved,
      actual: credits,
      usage,
      provider: usedProvider,
      model: usedModel,
      chatbotId: chatbot.id,
    });
    yield { type: "usage", usage, credits, provider: usedProvider, model: usedModel };
    yield { type: "done" };
  } catch (error) {
    await refundReservation(db, reservation.accountId, requestId, reservation.reserved);
    throw error;
  }
}

export async function resetPlaygroundConversation(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; chatbotId: string; conversationId: string },
) {
  await requireMembership(db, input.actorUserId, input.organizationId);
  await getChatbotForOrg(db, input.organizationId, input.chatbotId);
  await db.conversation.updateMany({
    where: {
      id: input.conversationId,
      organizationId: input.organizationId,
      chatbotId: input.chatbotId,
    },
    data: { status: "CLOSED", closedAt: new Date() },
  });
}
