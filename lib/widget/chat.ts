import type { PrismaClient } from "@prisma/client";
import { AIError } from "@/lib/ai/errors";
import { sanitizeUserMessage } from "@/lib/ai/prompts";
import { assertConversationCapacity, runAssistantTurn } from "@/lib/chatbot/turn";
import { WidgetError } from "@/lib/widget/errors";
import { requireVisitorSession } from "@/lib/widget/session";
import type { Citation } from "@/lib/knowledge/types";

export type WidgetChatDelta =
  | { type: "delta"; text: string }
  | { type: "citations"; citations: Array<Pick<Citation, "title" | "snippet" | "score">> }
  | { type: "usage"; credits: number }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

export async function* widgetChat(
  db: PrismaClient,
  input: {
    publicId: string;
    sessionPublicId: string;
    token: string;
    origin: string | null;
    message: string;
    abortSignal?: AbortSignal;
  },
): AsyncGenerator<WidgetChatDelta> {
  const { chatbot, session } = await requireVisitorSession(db, input);
  const config = chatbot.configuration;
  if (!config) {
    throw new WidgetError("Chatbot is not available.", 404, "not_found");
  }

  const userText = sanitizeUserMessage(input.message);
  if (!userText) {
    throw new AIError("invalid_request", "Message cannot be empty.", false);
  }

  let conversation = await db.conversation.findFirst({
    where: {
      chatbotId: chatbot.id,
      organizationId: chatbot.organizationId,
      visitorSessionId: session.id,
      status: { in: ["OPEN", "AI_ACTIVE"] },
    },
    orderBy: { startedAt: "desc" },
  });

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        organizationId: chatbot.organizationId,
        chatbotId: chatbot.id,
        visitorSessionId: session.id,
        status: "AI_ACTIVE",
      },
    });
  }

  if (conversation.status === "HUMAN_TAKEOVER") {
    throw new AIError("invalid_request", "A teammate owns this conversation.", false);
  }

  await assertConversationCapacity(db, conversation.id, config.conversationLimit);

  for await (const event of runAssistantTurn(db, {
    chatbot,
    conversation,
    userText,
    abortSignal: input.abortSignal,
  })) {
    if (event.type === "delta") {
      yield event;
    } else if (event.type === "citations") {
      if (config.showSources) {
        yield {
          type: "citations",
          citations: event.citations.map((item) => ({
            title: item.title,
            snippet: item.snippet,
            score: item.score,
          })),
        };
      }
    } else if (event.type === "usage") {
      yield { type: "usage", credits: event.credits };
    } else if (event.type === "done") {
      yield { type: "done" };
    } else if (event.type === "error") {
      yield event;
    }
  }
}
