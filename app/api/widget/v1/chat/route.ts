import { AIError } from "@/lib/ai/errors";
import { CreditError } from "@/lib/ai/credits";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { widgetChatSchema } from "@/lib/validators";
import { widgetChat } from "@/lib/widget/chat";
import { resolveWidgetCors } from "@/lib/widget/cors";
import { WidgetError } from "@/lib/widget/errors";
import { sseHeaders, visitorAuthFrom, widgetJson, widgetOptions, WIDGET_CHAT_LIMIT } from "@/lib/widget/http";
import { clientIp, requestOrigin, widgetPublicId } from "@/lib/widget/origin";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return widgetOptions(request);
}

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const json = await request.json().catch(() => null);
  const publicId = widgetPublicId(
    request,
    json && typeof json === "object" ? (json as { publicId?: string }).publicId : undefined,
  );
  const parsed = widgetChatSchema.safeParse({
    ...(json && typeof json === "object" ? json : {}),
    publicId,
  });
  if (!parsed.success) {
    return widgetJson({ error: "Invalid widget chat request.", code: "invalid_request" }, 400, origin, false);
  }

  const auth = visitorAuthFrom(request);
  const ip = clientIp(request);
  const limit = consumeRateLimit(
    `widget-chat:${ip}:${auth.sessionPublicId || parsed.data.publicId}`,
    WIDGET_CHAT_LIMIT.limit,
    WIDGET_CHAT_LIMIT.windowMs,
  );
  if (!limit.allowed) {
    return widgetJson({ error: "Too many chat requests. Wait a moment.", code: "rate_limited" }, 429, origin, false);
  }

  const cors = await resolveWidgetCors(prisma, request, parsed.data.publicId);
  if (!cors.allowed) {
    return widgetJson(
      { error: "This website is not allowed to embed the chatbot.", code: "origin_denied" },
      403,
      cors.origin,
      false,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        for await (const event of widgetChat(prisma, {
          publicId: parsed.data.publicId,
          sessionPublicId: auth.sessionPublicId,
          token: auth.token,
          origin: cors.origin,
          message: parsed.data.message,
          abortSignal: request.signal,
        })) {
          send(event);
        }
      } catch (error) {
        if (error instanceof CreditError) {
          send({ type: "error", code: "credits", message: error.message });
        } else if (error instanceof WidgetError || error instanceof AIError) {
          send({ type: "error", code: "code" in error ? error.code : "widget", message: error.message });
        } else {
          send({ type: "error", code: "provider_error", message: "The model request failed." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders(cors.origin, true) });
}
