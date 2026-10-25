import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mockAdapter, mockReplyFor } from "../lib/ai/adapters/mock";
import {
  deleteOrganizationProviderKey,
  listOrganizationProviderStatus,
  resolveApiKey,
  saveOrganizationProviderKey,
} from "../lib/ai/credentials";
import { CreditError, creditsFromUsage, reserveCredits } from "../lib/ai/credits";
import { AIError, normalizeHttpError } from "../lib/ai/errors";
import { generateText, streamText } from "../lib/ai/router";
import { registerUser } from "../lib/auth/service";
import { playChatbot } from "../lib/chatbot/play";
import { createChatbot } from "../lib/chatbot/service";
import { ensureDefaultPlans } from "../lib/org/service";
import { resetDb, testDb } from "./helpers";

const db = testDb();

before(async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  process.env.AI_MOCK_MODE = "true";
});

after(async () => {
  process.env.AI_MOCK_MODE = "true";
  await db.$disconnect();
});

async function collectPlay(organizationId: string, actorUserId: string, chatbotId: string, message: string) {
  const events: Array<Record<string, unknown>> = [];
  for await (const event of playChatbot(db, { organizationId, actorUserId, chatbotId, message })) {
    events.push(event as unknown as Record<string, unknown>);
  }
  return events;
}

test("mock adapter is deterministic and streams usage", async () => {
  const text = mockReplyFor("What are your hours?");
  assert.match(text, /10:00/);
  const result = await mockAdapter.generate({
    provider: "mock",
    model: "mock-chat",
    messages: [{ role: "user", content: "hours" }],
    apiKey: "mock-key",
  });
  assert.equal(result.usage.source, "provider");
  assert.ok(result.usage.inputTokens >= 1);
  assert.ok(result.usage.outputTokens >= 1);

  let streamed = "";
  let usage = null;
  for await (const event of mockAdapter.stream({
    provider: "mock",
    model: "mock-chat",
    messages: [{ role: "user", content: "hours" }],
    apiKey: "mock-key",
  })) {
    if (event.type === "delta") streamed += event.text;
    if (event.type === "usage") usage = event.usage;
  }
  assert.equal(streamed, result.text);
  assert.ok(usage);
});

test("mock timeout and fail tokens refund reserved credits", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await registerUser(db, {
    name: "Mock Fail",
    email: "mock-fail@example.com",
    password: "ValidPass1",
    organizationName: "Mock Fail Org",
  });
  const chatbot = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Fail Bot",
  });

  const before = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  assert.ok(before);
  await assert.rejects(
    () => collectPlay(owner.organization.id, owner.user.id, chatbot.id, "please __timeout__ now"),
    (error: unknown) => error instanceof AIError && error.code === "timeout",
  );
  await assert.rejects(
    () => collectPlay(owner.organization.id, owner.user.id, chatbot.id, "please __fail__ now"),
    (error: unknown) => error instanceof AIError && error.code === "provider_error",
  );
  const after = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  assert.equal(after?.balance, before?.balance);
  const usage = await db.usageRecord.count({ where: { organizationId: owner.organization.id } });
  assert.equal(usage, 0);
});

test("playground mock stream records actual usage and deducts credits", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await registerUser(db, {
    name: "Play Owner",
    email: "play-owner@example.com",
    password: "ValidPass1",
    organizationName: "Play Org",
  });
  const chatbot = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Play Bot",
  });
  const before = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  const events = await collectPlay(owner.organization.id, owner.user.id, chatbot.id, "What are your hours?");
  const text = events
    .filter((event) => event.type === "delta")
    .map((event) => String(event.text))
    .join("");
  assert.match(text, /10:00/);
  const usageEvent = events.find((event) => event.type === "usage");
  assert.ok(usageEvent);
  assert.ok((usageEvent.credits as number) >= 1);
  const after = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  assert.equal(after?.balance, (before?.balance ?? 0) - (usageEvent.credits as number));
  const record = await db.usageRecord.findFirst({ where: { organizationId: owner.organization.id } });
  assert.ok(record);
  assert.equal(record.provider, "mock");
  assert.ok(record.inputTokens + record.outputTokens >= 1);
  const messages = await db.message.findMany({ where: { conversationId: events[0]?.conversationId as string } });
  assert.equal(messages.some((item) => item.sender === "VISITOR"), true);
  assert.equal(messages.some((item) => item.sender === "AI"), true);
});

test("missing credentials fail closed when mock mode is off", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await registerUser(db, {
    name: "Creds Owner",
    email: "creds-owner@example.com",
    password: "ValidPass1",
    organizationName: "Creds Org",
  });
  const previous = process.env.AI_MOCK_MODE;
  const openai = process.env.OPENAI_API_KEY;
  process.env.AI_MOCK_MODE = "false";
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => resolveApiKey(db, owner.organization.id, "openai"),
      (error: unknown) => error instanceof AIError && error.code === "missing_credentials",
    );
  } finally {
    process.env.AI_MOCK_MODE = previous ?? "true";
    if (openai) process.env.OPENAI_API_KEY = openai;
  }
});

test("customer keys are encrypted and never listed in status", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await registerUser(db, {
    name: "Key Owner",
    email: "key-owner@example.com",
    password: "ValidPass1",
    organizationName: "Key Org",
  });
  const previous = process.env.AI_MOCK_MODE;
  const openai = process.env.OPENAI_API_KEY;
  process.env.AI_MOCK_MODE = "false";
  delete process.env.OPENAI_API_KEY;
  try {
    await saveOrganizationProviderKey(db, owner.organization.id, "openai", "sk-test-customer-key");
    const row = await db.aIProviderConfiguration.findUnique({
      where: { organizationId_provider: { organizationId: owner.organization.id, provider: "openai" } },
    });
    assert.ok(row?.encryptedApiKey);
    assert.doesNotMatch(row.encryptedApiKey, /sk-test-customer-key/);
    const resolved = await resolveApiKey(db, owner.organization.id, "openai");
    assert.equal(resolved.source, "customer");
    assert.equal(resolved.apiKey, "sk-test-customer-key");
    const status = await listOrganizationProviderStatus(db, owner.organization.id);
    const openaiStatus = status.find((item) => item.provider === "openai");
    assert.equal(openaiStatus?.hasCustomerKey, true);
    assert.equal(JSON.stringify(status).includes("sk-test"), false);
    await deleteOrganizationProviderKey(db, owner.organization.id, "openai");
    await assert.rejects(
      () => resolveApiKey(db, owner.organization.id, "openai"),
      (error: unknown) => error instanceof AIError && error.code === "missing_credentials",
    );
  } finally {
    process.env.AI_MOCK_MODE = previous ?? "true";
    if (openai) process.env.OPENAI_API_KEY = openai;
  }
});

test("credit reservations serialize concurrent usage", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await registerUser(db, {
    name: "Credit Owner",
    email: "credit-owner@example.com",
    password: "ValidPass1",
    organizationName: "Credit Org",
  });
  await db.creditAccount.update({
    where: { organizationId: owner.organization.id },
    data: { balance: 3, lifetimeUsed: 0 },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) => reserveCredits(db, owner.organization.id, `concurrent-${index}`, 1)),
  );
  const accepted = results.filter((item) => item.status === "fulfilled");
  const rejected = results.filter((item) => item.status === "rejected");
  assert.equal(accepted.length, 3);
  assert.equal(rejected.length, 5);
  assert.ok(rejected.every((item) => item.status === "rejected" && item.reason instanceof CreditError));
  const account = await db.creditAccount.findUnique({ where: { organizationId: owner.organization.id } });
  assert.equal(account?.balance, 0);
});

test("normalized HTTP errors map vendor status codes", () => {
  assert.equal(normalizeHttpError("OpenAI", 401, "bad key").code, "invalid_credentials");
  assert.equal(normalizeHttpError("Gemini", 429, "slow down").code, "rate_limited");
  assert.equal(normalizeHttpError("Anthropic", 400, "bad json").code, "invalid_request");
  assert.equal(normalizeHttpError("OpenAI", 500, "oops").code, "provider_error");
  assert.equal(creditsFromUsage({ inputTokens: 100, outputTokens: 100, source: "provider" }), 1);
  assert.equal(creditsFromUsage({ inputTokens: 1200, outputTokens: 800, source: "provider" }), 2);
});

test("playground cannot stream another organization's chatbot", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const alpha = await registerUser(db, {
    name: "Alpha Play",
    email: "alpha-play@example.com",
    password: "ValidPass1",
    organizationName: "Alpha Play Org",
  });
  const beta = await registerUser(db, {
    name: "Beta Play",
    email: "beta-play@example.com",
    password: "ValidPass1",
    organizationName: "Beta Play Org",
  });
  const chatbot = await createChatbot(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
    name: "Secret Bot",
  });
  await assert.rejects(
    () => collectPlay(beta.organization.id, beta.user.id, chatbot.id, "hello"),
    /not found/,
  );
});

test("router uses the mock adapter while AI_MOCK_MODE is on", async () => {
  process.env.AI_MOCK_MODE = "true";
  const result = await generateText({
    provider: "openai",
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: "refund policy" }],
    apiKey: "unused",
  });
  assert.match(result.text, /30 days/);
  let streamed = "";
  for await (const event of streamText({
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    messages: [{ role: "user", content: "refund" }],
    apiKey: "unused",
  })) {
    if (event.type === "delta") streamed += event.text;
  }
  assert.match(streamed, /30 days/);
});
