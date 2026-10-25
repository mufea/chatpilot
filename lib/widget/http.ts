import { NextResponse } from "next/server";
import { AIError } from "@/lib/ai/errors";
import { CreditError } from "@/lib/ai/credits";
import { WidgetError } from "@/lib/widget/errors";
import { corsHeaders, resolveWidgetCors } from "@/lib/widget/cors";
import { prisma } from "@/lib/db";

export { WIDGET_CHAT_LIMIT, WIDGET_CONFIG_LIMIT, WIDGET_SESSION_LIMIT } from "@/lib/widget/limits";

export function widgetJson(
  body: unknown,
  status: number,
  origin: string | null,
  allowed: boolean,
) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(origin, allowed),
  });
}

export function widgetErrorResponse(error: unknown, origin: string | null, allowed: boolean) {
  if (error instanceof WidgetError) {
    return widgetJson({ error: error.message, code: error.code }, error.status, origin, allowed && error.status < 500);
  }
  if (error instanceof CreditError) {
    return widgetJson({ error: error.message, code: "credits" }, 402, origin, allowed);
  }
  if (error instanceof AIError) {
    return widgetJson({ error: error.message, code: error.code }, error.status ?? 400, origin, allowed);
  }
  return widgetJson({ error: "The widget request failed.", code: "provider_error" }, 500, origin, false);
}

export async function widgetOptions(request: Request) {
  const cors = await resolveWidgetCors(prisma, request);
  return new NextResponse(null, {
    status: cors.allowed ? 204 : 403,
    headers: corsHeaders(cors.origin, cors.allowed),
  });
}

export function visitorAuthFrom(request: Request) {
  return {
    sessionPublicId: request.headers.get("x-chatpilot-session")?.trim() ?? "",
    token: request.headers.get("x-chatpilot-token")?.trim() ?? "",
  };
}

export function sseHeaders(origin: string | null, allowed: boolean): HeadersInit {
  return {
    ...corsHeaders(origin, allowed),
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  };
}
