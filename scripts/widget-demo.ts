import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { addPastedDocument } from "../lib/knowledge/ingest";
import { processQueuedJobs } from "../lib/knowledge/process";
import { createChatbot, setChatbotStatus, updateChatbot } from "../lib/chatbot/service";
import { createKnowledgeBase, setChatbotKnowledgeBases } from "../lib/knowledge/service";
import { registerUser } from "../lib/auth/service";
import { ensureDefaultPlans } from "../lib/org/service";

const PORT = Number(process.env.WIDGET_DEMO_PORT || 43211);
const APP_ORIGIN = (process.env.APP_URL || "http://127.0.0.1:43180").replace(/\/$/, "");
const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://chatpilot:chatpilot_dev@127.0.0.1:5432/chatpilot";

const DEMO_EMAIL = "harbor-widget-demo@example.com";
const DEMO_ALLOWED = ["127.0.0.1:43211", "localhost:43211"];

async function ensureDemoChatbot(db: PrismaClient) {
  await ensureDefaultPlans(db);

  let userId: string | undefined;
  let organizationId: string | undefined;
  const existingUser = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existingUser) {
    const organization = await db.organization.findFirst({
      where: { ownerId: existingUser.id, deletedAt: null },
    });
    userId = existingUser.id;
    organizationId = organization?.id;
  }
  if (!userId || !organizationId) {
    const created = await registerUser(db, {
      name: "Harbor Demo",
      email: DEMO_EMAIL,
      password: "ValidPass1",
      organizationName: "Harbor Books Demo",
    });
    userId = created.user.id;
    organizationId = created.organization.id;
  }

  await db.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });

  let chatbot = await db.chatbot.findFirst({
    where: { organizationId, deletedAt: null, name: "Harbor Desk" },
    include: { configuration: true },
  });

  if (!chatbot) {
    chatbot = await createChatbot(db, {
      organizationId,
      actorUserId: userId,
      name: "Harbor Desk",
      description: "Independent storefront widget demo",
    });
  }

  await updateChatbot(db, {
    organizationId,
    actorUserId: userId,
    chatbotId: chatbot.id,
    data: {
      name: "Harbor Desk",
      welcomeMessage: "Welcome to Harbor Books. Ask about hours, returns, or the quiet desk.",
      systemInstructions: "You are the Harbor Books desk. Answer only from store facts.",
      brandColor: "#8B3A2A",
      suggestedQuestions: ["What are your hours?", "How do returns work?", "Where is the quiet desk?"],
      allowedDomains: DEMO_ALLOWED,
      showSources: true,
      provider: "openai",
      model: "gpt-4.1-mini",
    },
  });

  const kb =
    (await db.knowledgeBase.findFirst({
      where: { organizationId, name: "Harbor facts" },
    })) ??
    (await createKnowledgeBase(db, {
      organizationId,
      actorUserId: userId,
      name: "Harbor facts",
    }));

  const existingDoc = await db.document.findFirst({
    where: { knowledgeBaseId: kb.id, title: "Store desk" },
  });
  if (!existingDoc) {
    await addPastedDocument(db, {
      organizationId,
      actorUserId: userId,
      knowledgeBaseId: kb.id,
      title: "Store desk",
      text: "Harbor Books opens at 09:00 for members and 10:00 for the public on weekdays, and 11:00–17:00 on weekends. Unopened titles can be returned within 21 days with a receipt. Members may reserve the quiet desk on the mezzanine after 14:00.",
    });
    await processQueuedJobs(db);
  }

  await setChatbotKnowledgeBases(db, {
    organizationId,
    actorUserId: userId,
    chatbotId: chatbot.id,
    knowledgeBaseIds: [kb.id],
  });

  const published = await setChatbotStatus(db, {
    organizationId,
    actorUserId: userId,
    chatbotId: chatbot.id,
    status: "PUBLISHED",
    emailVerified: true,
  });

  return published;
}

function renderPage(publicId: string) {
  const template = readFileSync(resolve(process.cwd(), "widget-demo/index.html"), "utf8");
  return template.replaceAll("__PUBLIC_ID__", publicId).replaceAll("__APP_ORIGIN__", APP_ORIGIN);
}

async function main() {
  const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const chatbot = await ensureDemoChatbot(db);
  const html = renderPage(chatbot.publicId);

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = request.url ?? "/";
    if (url.startsWith("/health")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          origin: `http://127.0.0.1:${PORT}`,
          publicId: chatbot.publicId,
          appOrigin: APP_ORIGIN,
        }),
      );
      return;
    }
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(html);
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(
      JSON.stringify({
        demo: `http://127.0.0.1:${PORT}`,
        app: APP_ORIGIN,
        publicId: chatbot.publicId,
        allowedDomains: DEMO_ALLOWED,
      }),
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
