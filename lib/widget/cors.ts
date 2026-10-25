import { originAllowed, requestOrigin, widgetPublicId } from "@/lib/widget/origin";
import { loadPublishedWidgetChatbot } from "@/lib/widget/public";
import type { PrismaClient } from "@prisma/client";

export const WIDGET_CORS_HEADERS = "content-type,x-chatpilot-session,x-chatpilot-token,x-chatpilot-public-id";

export function corsHeaders(origin: string | null, allowed: boolean): Record<string, string> {
  const headers: Record<string, string> = { vary: "Origin" };
  if (origin && allowed) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET,POST,OPTIONS";
    headers["access-control-allow-headers"] = WIDGET_CORS_HEADERS;
    headers["access-control-max-age"] = "600";
  }
  return headers;
}

export async function resolveWidgetCors(
  db: PrismaClient,
  request: Request,
  bodyPublicId?: string,
): Promise<{ origin: string | null; allowed: boolean; publicId: string | null }> {
  const origin = requestOrigin(request);
  const publicId = widgetPublicId(request, bodyPublicId);
  if (!origin || !publicId) {
    return { origin, allowed: false, publicId };
  }
  try {
    const chatbot = await loadPublishedWidgetChatbot(db, publicId);
    return {
      origin,
      allowed: originAllowed(origin, chatbot.configuration?.allowedDomains ?? []),
      publicId,
    };
  } catch {
    return { origin, allowed: false, publicId };
  }
}
