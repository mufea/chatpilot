import { type PrismaClient } from "@prisma/client";
import { AIError } from "@/lib/ai/errors";
import { sanitizeUserMessage } from "@/lib/ai/prompts";
import { getChatbotForOrg } from "@/lib/chatbot/service";
import {
  assertConversationCapacity,
  runAssistantTurn,
  type AssistantTurnDelta,
} from "@/lib/chatbot/turn";
import { assertCanUseAi } from "@/lib/billing/entitlements";
import { requireMembership } from "@/lib/org/service";

export type PlayDelta =
  | { type: "conversation"; conversationId: string }
  | AssistantTurnDelta;

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
  await assertCanUseAi(db, input.organizationId);
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

  await assertConversationCapacity(db, conversation.id, config.conversationLimit);

  yield { type: "conversation", conversationId: conversation.id };
  yield* runAssistantTurn(db, {
    chatbot,
    conversation,
    userText,
    abortSignal: input.abortSignal,
  });
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
