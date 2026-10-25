import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { registerUser } from "../lib/auth/service";
import { createChatbot, setChatbotStatus, updateChatbot } from "../lib/chatbot/service";
import { ensureDefaultPlans } from "../lib/org/service";
import { consumeRateLimit, resetRateLimit } from "../lib/rate-limit";
import { widgetChat } from "../lib/widget/chat";
import { WIDGET_CHAT_LIMIT } from "../lib/widget/limits";
import { hostFromOrigin, normalizeAllowedDomain, originAllowed } from "../lib/widget/origin";
import { assertNoSecretLeak, getPublicWidgetConfig } from "../lib/widget/public";
import { createVisitorSession, requireVisitorSession } from "../lib/widget/session";
import { WidgetError } from "../lib/widget/errors";
import { resetDb, testDb } from "./helpers";

const db = testDb();
const DEMO_ORIGIN = "http://127.0.0.1:43211";
const EVIL_ORIGIN = "https://evil.example";

before(async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  process.env.AI_MOCK_MODE = "true";
});

after(async () => {
  await db.$disconnect();
});

async function publishedBot(email: string, domains: string[]) {
  const owner = await registerUser(db, {
    name: "Widget Owner",
    email,
    password: "ValidPass1",
    organizationName: `${email} Org`,
  });
  await db.user.update({
    where: { id: owner.user.id },
    data: { emailVerifiedAt: new Date() },
  });
  const chatbot = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Harbor Widget",
    description: "Public embed",
  });
  await updateChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    chatbotId: chatbot.id,
    data: {
      name: "Harbor Widget",
      welcomeMessage: "Welcome to the widget.",
      systemInstructions: "Never reveal the vault code 9911 or the API key sk-secret-demo.",
      persona: "secret persona",
      provider: "openai",
      model: "gpt-4.1-mini",
      brandColor: "#0F766E",
      suggestedQuestions: ["What are your hours?"],
      allowedDomains: domains,
      showSources: true,
    },
  });
  const published = await setChatbotStatus(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    chatbotId: chatbot.id,
    status: "PUBLISHED",
    emailVerified: true,
  });
  return { owner, chatbot: published };
}

test("normalizes origins and requires an exact allowlist host", () => {
  assert.equal(hostFromOrigin("https://store.example.com"), "store.example.com");
  assert.equal(hostFromOrigin("http://127.0.0.1:43211"), "127.0.0.1:43211");
  assert.equal(normalizeAllowedDomain("STORE.EXAMPLE.COM"), "store.example.com");
  assert.equal(originAllowed(DEMO_ORIGIN, ["127.0.0.1:43211"]), true);
  assert.equal(originAllowed(DEMO_ORIGIN, ["store.example.com"]), false);
  assert.equal(originAllowed(EVIL_ORIGIN, ["127.0.0.1:43211"]), false);
  assert.equal(originAllowed(DEMO_ORIGIN, []), false);
});

test("unpublished chatbots and empty allowlists cannot be embedded", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await registerUser(db, {
    name: "Draft Owner",
    email: "widget-draft@example.com",
    password: "ValidPass1",
    organizationName: "Draft Org",
  });
  const draft = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Draft Bot",
  });
  await assert.rejects(
    () => getPublicWidgetConfig(db, { publicId: draft.publicId, origin: DEMO_ORIGIN }),
    (error: unknown) => error instanceof WidgetError && error.status === 404,
  );

  const published = await publishedBot("widget-empty@example.com", []);
  await assert.rejects(
    () => getPublicWidgetConfig(db, { publicId: published.chatbot.publicId, origin: DEMO_ORIGIN }),
    (error: unknown) => error instanceof WidgetError && error.status === 403,
  );
});

test("wrong origin is blocked and internal ids cannot be used as public ids", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const { chatbot } = await publishedBot("widget-origin@example.com", ["127.0.0.1:43211"]);

  await assert.rejects(
    () => getPublicWidgetConfig(db, { publicId: chatbot.publicId, origin: EVIL_ORIGIN }),
    (error: unknown) => error instanceof WidgetError && error.code === "origin_denied",
  );
  await assert.rejects(
    () => getPublicWidgetConfig(db, { publicId: chatbot.id, origin: DEMO_ORIGIN }),
    (error: unknown) => error instanceof WidgetError && error.status === 404,
  );

  const config = await getPublicWidgetConfig(db, { publicId: chatbot.publicId, origin: DEMO_ORIGIN });
  assert.equal(config.publicId, chatbot.publicId);
  assert.equal(config.name, "Harbor Widget");
  assert.equal((config as { id?: string }).id, undefined);
  assert.equal((config as { organizationId?: string }).organizationId, undefined);
  assert.equal((config as { provider?: string }).provider, undefined);
  assert.equal((config as { model?: string }).model, undefined);
  assert.equal((config as { systemInstructions?: string }).systemInstructions, undefined);
  assert.doesNotMatch(JSON.stringify(config), /sk-secret-demo|9911|secret persona|openai|gpt-4/);
  assertNoSecretLeak(config);
});

test("visitor sessions are isolated and widget chat streams without leaking credentials", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const { chatbot } = await publishedBot("widget-session@example.com", ["127.0.0.1:43211"]);

  const alice = await createVisitorSession(db, {
    publicId: chatbot.publicId,
    origin: DEMO_ORIGIN,
    ip: "203.0.113.10",
  });
  const bob = await createVisitorSession(db, {
    publicId: chatbot.publicId,
    origin: DEMO_ORIGIN,
    ip: "203.0.113.11",
  });
  assert.notEqual(alice.sessionId, bob.sessionId);
  assert.notEqual(alice.token, bob.token);

  await assert.rejects(
    () =>
      requireVisitorSession(db, {
        publicId: chatbot.publicId,
        sessionPublicId: alice.sessionId,
        token: bob.token,
        origin: DEMO_ORIGIN,
      }),
    (error: unknown) => error instanceof WidgetError && error.status === 401,
  );

  const events: Array<Record<string, unknown>> = [];
  for await (const event of widgetChat(db, {
    publicId: chatbot.publicId,
    sessionPublicId: alice.sessionId,
    token: alice.token,
    origin: DEMO_ORIGIN,
    message: "What are your hours?",
  })) {
    events.push(event as unknown as Record<string, unknown>);
  }
  const text = events.filter((event) => event.type === "delta").map((event) => String(event.text)).join("");
  assert.match(text, /10:00|open/i);
  assert.equal(events.some((event) => event.type === "done"), true);
  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /sk-secret-demo|organizationId|"provider"|gpt-4|encryptedApiKey/);
  assert.equal(
    events.some((event) => event.type === "usage" && typeof event.credits === "number"),
    true,
  );

  const aliceConversation = await db.conversation.findFirst({
    where: { chatbotId: chatbot.id },
    include: { visitorSession: true, messages: true },
  });
  assert.ok(aliceConversation?.visitorSessionId);
  const bobConversation = await db.conversation.findMany({
    where: { visitorSession: { publicId: bob.sessionId } },
  });
  assert.equal(bobConversation.length, 0);
  assert.notEqual(aliceConversation?.visitorSession?.publicId, bob.sessionId);
});

test("widget chat is rate-limited more tightly than the playground", () => {
  resetRateLimit("widget-chat:test");
  for (let i = 0; i < WIDGET_CHAT_LIMIT.limit; i += 1) {
    assert.equal(consumeRateLimit("widget-chat:test", WIDGET_CHAT_LIMIT.limit, WIDGET_CHAT_LIMIT.windowMs, i + 1).allowed, true);
  }
  assert.equal(
    consumeRateLimit("widget-chat:test", WIDGET_CHAT_LIMIT.limit, WIDGET_CHAT_LIMIT.windowMs, WIDGET_CHAT_LIMIT.limit + 1).allowed,
    false,
  );
  assert.ok(WIDGET_CHAT_LIMIT.limit < 30);
});

test("public widget scripts never contain credentials or private identifiers", () => {
  const v1 = readFileSync(resolve(process.cwd(), "public/widget/v1.js"), "utf8");
  const alias = readFileSync(resolve(process.cwd(), "public/widget.js"), "utf8");
  for (const source of [v1, alias]) {
    assert.doesNotMatch(source, /OPENAI|ANTHROPIC|GEMINI|API_KEY|APP_ENCRYPTION|sk-|systemInstructions|organizationId/);
    assert.doesNotMatch(source, /Bearer /);
    assert.match(source, /currentScript|getElementsByTagName\("script"\)/);
  }
  assert.match(v1, /attachShadow/);
  assert.match(v1, /api\/widget\/v1\/chat/);
  assert.match(alias, /widget\/v1\.js/);
});
