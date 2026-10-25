import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { widgetPublicIdSchema } from "@/lib/validators";
import { resolveWidgetCors } from "@/lib/widget/cors";
import { widgetErrorResponse, widgetJson, widgetOptions, WIDGET_SESSION_LIMIT } from "@/lib/widget/http";
import { clientIp, requestOrigin, widgetPublicId } from "@/lib/widget/origin";
import { createVisitorSession } from "@/lib/widget/session";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return widgetOptions(request);
}

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const json = await request.json().catch(() => ({}));
  const publicId = widgetPublicId(request, typeof json === "object" && json ? (json as { publicId?: string }).publicId : undefined);
  const parsed = widgetPublicIdSchema.safeParse({ publicId });
  if (!parsed.success) {
    return widgetJson({ error: "A public chatbot id is required.", code: "invalid_request" }, 400, origin, false);
  }

  const ip = clientIp(request);
  const limit = consumeRateLimit(
    `widget-session:${ip}:${parsed.data.publicId}`,
    WIDGET_SESSION_LIMIT.limit,
    WIDGET_SESSION_LIMIT.windowMs,
  );
  if (!limit.allowed) {
    return widgetJson({ error: "Too many session requests. Wait a moment.", code: "rate_limited" }, 429, origin, false);
  }

  const cors = await resolveWidgetCors(prisma, request, parsed.data.publicId);
  try {
    const session = await createVisitorSession(prisma, {
      publicId: parsed.data.publicId,
      origin: cors.origin,
      userAgent: request.headers.get("user-agent"),
      ip,
    });
    return widgetJson(session, 200, cors.origin, true);
  } catch (error) {
    return widgetErrorResponse(error, cors.origin, cors.allowed);
  }
}
