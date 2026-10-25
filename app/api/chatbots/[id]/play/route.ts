import { NextResponse } from "next/server";
import { AIError } from "@/lib/ai/errors";
import { CreditError } from "@/lib/ai/credits";
import { BillingError } from "@/lib/billing/errors";
import { getCurrentAuth } from "@/lib/auth/session";
import { playChatbot } from "@/lib/chatbot/play";
import { ChatbotError } from "@/lib/chatbot/service";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { playMessageSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const limit = consumeRateLimit(`play:${auth.user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many chat requests. Wait a moment." }, { status: 429 });
  }

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = playMessageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        for await (const event of playChatbot(prisma, {
          organizationId: auth.activeOrganization!.id,
          actorUserId: auth.user.id,
          chatbotId: id,
          conversationId: parsed.data.conversationId,
          message: parsed.data.message,
          abortSignal: request.signal,
        })) {
          send(event);
        }
      } catch (error) {
        if (error instanceof CreditError) {
          send({ type: "error", code: "credits", message: error.message });
        } else if (error instanceof BillingError) {
          send({ type: "error", code: error.code, message: error.message });
        } else if (error instanceof AIError || error instanceof ChatbotError) {
          send({ type: "error", code: "code" in error ? error.code : "chatbot", message: error.message });
        } else {
          send({ type: "error", code: "provider_error", message: "The model request failed." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
