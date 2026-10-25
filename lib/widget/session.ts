import type { PrismaClient } from "@prisma/client";
import { generateToken, hashToken, sha256 } from "@/lib/crypto";
import { WidgetError } from "@/lib/widget/errors";
import { originAllowed } from "@/lib/widget/origin";
import { loadPublishedWidgetChatbot } from "@/lib/widget/public";

export type WidgetVisitorAuth = {
  sessionPublicId: string;
  token: string;
};

export async function createVisitorSession(
  db: PrismaClient,
  input: {
    publicId: string;
    origin: string | null;
    userAgent?: string | null;
    ip?: string | null;
  },
) {
  const chatbot = await loadPublishedWidgetChatbot(db, input.publicId);
  const allowed = chatbot.configuration?.allowedDomains ?? [];
  if (!allowed.length || !originAllowed(input.origin, allowed)) {
    throw new WidgetError("This website is not allowed to embed the chatbot.", 403, "origin_denied");
  }

  const token = generateToken(24);
  const session = await db.visitorSession.create({
    data: {
      tokenHash: hashToken(token),
      organizationId: chatbot.organizationId,
      chatbotId: chatbot.id,
      origin: input.origin,
      userAgent: input.userAgent?.slice(0, 300) || null,
      ipHash: input.ip ? sha256(input.ip) : null,
    },
  });

  return {
    sessionId: session.publicId,
    token,
    chatbotPublicId: chatbot.publicId,
  };
}

export async function requireVisitorSession(
  db: PrismaClient,
  input: {
    publicId: string;
    sessionPublicId: string;
    token: string;
    origin: string | null;
  },
) {
  const chatbot = await loadPublishedWidgetChatbot(db, input.publicId);
  const allowed = chatbot.configuration?.allowedDomains ?? [];
  if (!allowed.length || !originAllowed(input.origin, allowed)) {
    throw new WidgetError("This website is not allowed to embed the chatbot.", 403, "origin_denied");
  }
  if (!input.sessionPublicId || !input.token) {
    throw new WidgetError("Visitor session is required.", 401, "session_required");
  }

  const session = await db.visitorSession.findFirst({
    where: {
      publicId: input.sessionPublicId,
      tokenHash: hashToken(input.token),
      chatbotId: chatbot.id,
    },
  });
  if (!session) {
    throw new WidgetError("Visitor session is invalid.", 401, "session_invalid");
  }

  await db.visitorSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return { chatbot, session };
}
