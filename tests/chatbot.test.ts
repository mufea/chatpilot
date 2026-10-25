import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { OrganizationRole } from "@prisma/client";
import { registerUser, verifyEmailToken } from "../lib/auth/service";
import {
  ChatbotError,
  createChatbot,
  deleteChatbot,
  duplicateChatbot,
  getChatbotForOrg,
  listChatbots,
  setChatbotStatus,
  updateChatbot,
} from "../lib/chatbot/service";
import { acceptInvitation, ensureDefaultPlans, inviteMember } from "../lib/org/service";
import { OrgError } from "../lib/org/service";
import { resetDb, testDb } from "./helpers";

const db = testDb();

before(async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
});

after(async () => {
  await db.$disconnect();
});

async function ownerWorkspace(email: string, orgName: string) {
  return registerUser(db, {
    name: orgName,
    email,
    password: "ValidPass1",
    organizationName: orgName,
  });
}

test("creates, updates, lists, and soft-deletes a chatbot in one workspace", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await ownerWorkspace("owner-crud@example.com", "Crud Org");

  const created = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Harbor Assistant",
    description: "Store hours",
  });
  assert.equal(created.name, "Harbor Assistant");
  assert.equal(created.status, "DRAFT");
  assert.ok(created.configuration);

  const updated = await updateChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    chatbotId: created.id,
    data: {
      name: "Harbor Desk",
      welcomeMessage: "Welcome to Harbor Books.",
      systemInstructions: "Answer hours and returns only.",
      provider: "gemini",
      model: "gemini-2.5-flash",
      brandColor: "#0F766E",
      fallbackEnabled: true,
      fallbackProvider: "anthropic",
    },
  });
  assert.equal(updated.name, "Harbor Desk");
  assert.equal(updated.configuration?.provider, "gemini");
  assert.equal(updated.configuration?.model, "gemini-2.5-flash");
  assert.equal(updated.configuration?.fallbackEnabled, true);
  assert.equal(updated.configuration?.fallbackProvider, "anthropic");

  const listed = await listChatbots(db, owner.organization.id);
  assert.equal(listed.length, 1);

  await deleteChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    chatbotId: created.id,
  });
  const afterDelete = await listChatbots(db, owner.organization.id);
  assert.equal(afterDelete.length, 0);
  await assert.rejects(
    () => getChatbotForOrg(db, owner.organization.id, created.id),
    (error: unknown) => error instanceof ChatbotError && error.status === 404,
  );
});

test("enforces Free plan chatbot limits and duplicates into a draft", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await ownerWorkspace("owner-limit@example.com", "Limit Org");
  const first = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Only Bot",
  });

  await assert.rejects(
    () =>
      createChatbot(db, {
        organizationId: owner.organization.id,
        actorUserId: owner.user.id,
        name: "Second Bot",
      }),
    /allows 1 chatbot/,
  );

  await db.plan.update({
    where: { code: "FREE" },
    data: { limits: { chatbots: 2, knowledgeBases: 1, monthlyMessages: 200, teamMembers: 1, documentsPerKnowledgeBase: 5 } },
  });

  const copy = await duplicateChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    chatbotId: first.id,
  });
  assert.equal(copy.name, "Only Bot copy");
  assert.equal(copy.status, "DRAFT");
  assert.notEqual(copy.id, first.id);
  assert.notEqual(copy.publicId, first.publicId);
});

test("requires a verified email to publish", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await ownerWorkspace("owner-publish@example.com", "Publish Org");
  const chatbot = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Publish Bot",
  });

  await assert.rejects(
    () =>
      setChatbotStatus(db, {
        organizationId: owner.organization.id,
        actorUserId: owner.user.id,
        chatbotId: chatbot.id,
        status: "PUBLISHED",
        emailVerified: false,
      }),
    /Verify your email/,
  );

  await verifyEmailToken(db, owner.verificationToken!);
  const published = await setChatbotStatus(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    chatbotId: chatbot.id,
    status: "PUBLISHED",
    emailVerified: true,
  });
  assert.equal(published.status, "PUBLISHED");
});

test("rejects invalid providers and same-provider fallback", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await ownerWorkspace("owner-config@example.com", "Config Org");
  const chatbot = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Config Bot",
  });

  await assert.rejects(
    () =>
      updateChatbot(db, {
        organizationId: owner.organization.id,
        actorUserId: owner.user.id,
        chatbotId: chatbot.id,
        data: { name: "Config Bot", provider: "mock", model: "mock-chat" },
      }),
    /OpenAI, Gemini, or Anthropic/,
  );

  await assert.rejects(
    () =>
      updateChatbot(db, {
        organizationId: owner.organization.id,
        actorUserId: owner.user.id,
        chatbotId: chatbot.id,
        data: {
          name: "Config Bot",
          provider: "openai",
          model: "not-a-real-model",
        },
      }),
    /not available/,
  );

  await assert.rejects(
    () =>
      updateChatbot(db, {
        organizationId: owner.organization.id,
        actorUserId: owner.user.id,
        chatbotId: chatbot.id,
        data: {
          name: "Config Bot",
          provider: "openai",
          model: "gpt-4.1-mini",
          fallbackEnabled: true,
          fallbackProvider: "openai",
        },
      }),
    /different from the primary/,
  );
});

test("isolates chatbots across organizations", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const alpha = await ownerWorkspace("alpha-bot@example.com", "Alpha Bots");
  const beta = await ownerWorkspace("beta-bot@example.com", "Beta Bots");
  const alphaBot = await createChatbot(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
    name: "Alpha Bot",
  });

  await assert.rejects(
    () => getChatbotForOrg(db, beta.organization.id, alphaBot.id),
    (error: unknown) => error instanceof ChatbotError && error.status === 404,
  );
  await assert.rejects(
    () =>
      updateChatbot(db, {
        organizationId: beta.organization.id,
        actorUserId: beta.user.id,
        chatbotId: alphaBot.id,
        data: { name: "Hijacked" },
      }),
    /not found/,
  );

  const betaList = await listChatbots(db, beta.organization.id);
  assert.equal(betaList.some((item) => item.id === alphaBot.id), false);
});

test("agents cannot mutate chatbots", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await ownerWorkspace("owner-agent@example.com", "Agent Org");
  const agent = await registerUser(db, {
    name: "Agent User",
    email: "agent-bot@example.com",
    password: "ValidPass1",
  });
  const { token } = await inviteMember(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    email: "agent-bot@example.com",
    role: OrganizationRole.AGENT,
  });
  await acceptInvitation(db, {
    token,
    userId: agent.user.id,
    userEmail: "agent-bot@example.com",
  });

  await assert.rejects(
    () =>
      createChatbot(db, {
        organizationId: owner.organization.id,
        actorUserId: agent.user.id,
        name: "Agent Bot",
      }),
    (error: unknown) => error instanceof OrgError,
  );

  const chatbot = await createChatbot(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Owner Bot",
  });
  const readable = await getChatbotForOrg(db, owner.organization.id, chatbot.id);
  assert.equal(readable.id, chatbot.id);
});
