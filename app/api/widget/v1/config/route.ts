import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { widgetPublicIdSchema } from "@/lib/validators";
import { resolveWidgetCors } from "@/lib/widget/cors";
import { widgetErrorResponse, widgetJson, widgetOptions, WIDGET_CONFIG_LIMIT } from "@/lib/widget/http";
import { clientIp, requestOrigin, widgetPublicId } from "@/lib/widget/origin";
import { assertNoSecretLeak, getPublicWidgetConfig } from "@/lib/widget/public";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return widgetOptions(request);
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const publicId = widgetPublicId(request);
  const parsed = widgetPublicIdSchema.safeParse({ publicId });
  if (!parsed.success) {
    return widgetJson({ error: "A public chatbot id is required.", code: "invalid_request" }, 400, origin, false);
  }

  const limit = consumeRateLimit(`widget-config:${clientIp(request)}`, WIDGET_CONFIG_LIMIT.limit, WIDGET_CONFIG_LIMIT.windowMs);
  if (!limit.allowed) {
    return widgetJson({ error: "Too many widget requests. Wait a moment.", code: "rate_limited" }, 429, origin, false);
  }

  const cors = await resolveWidgetCors(prisma, request, parsed.data.publicId);
  try {
    const config = await getPublicWidgetConfig(prisma, {
      publicId: parsed.data.publicId,
      origin: cors.origin,
    });
    assertNoSecretLeak(config);
    return widgetJson(config, 200, cors.origin, true);
  } catch (error) {
    return widgetErrorResponse(error, cors.origin, cors.allowed);
  }
}
