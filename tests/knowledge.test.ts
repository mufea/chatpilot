import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { OrganizationRole } from "@prisma/client";
import { registerUser } from "../lib/auth/service";
import { createChatbot } from "../lib/chatbot/service";
import { playChatbot } from "../lib/chatbot/play";
import { addPastedDocument, addUploadedDocument, addUrlDocument, retryDocument } from "../lib/knowledge/ingest";
import { processDocument, processQueuedJobs } from "../lib/knowledge/process";
import { retrieveForChatbot } from "../lib/knowledge/retrieve";
import {
  KnowledgeError,
  createKnowledgeBase,
  getKnowledgeBaseForOrg,
  listKnowledgeBases,
  setChatbotKnowledgeBases,
} from "../lib/knowledge/service";
import { acceptInvitation, ensureDefaultPlans, inviteMember } from "../lib/org/service";
import { OrgError } from "../lib/org/service";
import { resetDb, testDb } from "./helpers";

const db = testDb();

before(async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  process.env.AI_MOCK_MODE = "true";
});

after(async () => {
  await db.$disconnect();
});

async function workspace(email: string, name: string) {
  return registerUser(db, {
    name,
    email,
    password: "ValidPass1",
    organizationName: name,
  });
}

test("creates knowledge bases with plan limits and tenant isolation", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const alpha = await workspace("kb-alpha@example.com", "Alpha KB");
  const beta = await workspace("kb-beta@example.com", "Beta KB");
  const kb = await createKnowledgeBase(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
    name: "Policies",
  });
  await assert.rejects(
    () =>
      createKnowledgeBase(db, {
        organizationId: alpha.organization.id,
        actorUserId: alpha.user.id,
        name: "Second",
      }),
    /allows 1 knowledge base/,
  );
  await assert.rejects(
    () => getKnowledgeBaseForOrg(db, beta.organization.id, kb.id),
    (error: unknown) => error instanceof KnowledgeError && error.status === 404,
  );
  const betaList = await listKnowledgeBases(db, beta.organization.id);
  assert.equal(betaList.some((item) => item.id === kb.id), false);
});

test("agents cannot create knowledge bases", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("kb-owner@example.com", "Owner KB");
  const agent = await registerUser(db, {
    name: "Agent",
    email: "kb-agent@example.com",
    password: "ValidPass1",
  });
  const { token } = await inviteMember(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    email: "kb-agent@example.com",
    role: OrganizationRole.AGENT,
  });
  await acceptInvitation(db, { token, userId: agent.user.id, userEmail: "kb-agent@example.com" });
  await assert.rejects(
    () =>
      createKnowledgeBase(db, {
        organizationId: owner.organization.id,
        actorUserId: agent.user.id,
        name: "Agent KB",
      }),
    (error: unknown) => error instanceof OrgError,
  );
});

test("ingests pasted text, embeds with pgvector, and retries failures", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("kb-ingest@example.com", "Ingest Org");
  const kb = await createKnowledgeBase(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Store facts",
  });
  const document = await addPastedDocument(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    knowledgeBaseId: kb.id,
    title: "Hours",
    text: "Harbor Books opens at 09:00 for members and 10:00 for the public. Returns are accepted for 21 days.",
  });
  const processed = await processQueuedJobs(db);
  assert.ok(processed >= 1);
  const ready = await db.document.findUnique({ where: { id: document.id }, include: { chunks: true } });
  assert.equal(ready?.status, "READY");
  assert.ok((ready?.chunks.length ?? 0) >= 1);
  const vectors = await db.$queryRaw<Array<{ has: boolean }>>`
    SELECT ("embeddingVec" IS NOT NULL) AS has FROM "DocumentChunk" WHERE "documentId" = ${document.id} LIMIT 1
  `;
  assert.equal(vectors[0]?.has, true);

  await db.document.update({ where: { id: document.id }, data: { status: "FAILED", errorMessage: "forced" } });
  await retryDocument(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    documentId: document.id,
  });
  await processQueuedJobs(db);
  const retried = await db.document.findUnique({ where: { id: document.id } });
  assert.equal(retried?.status, "READY");
  assert.equal(retried?.errorMessage, null);
});

test("uploads a text file and crawls a public URL through a stub fetch", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const owner = await workspace("kb-file@example.com", "File Org");
  await db.plan.update({
    where: { code: "FREE" },
    data: { limits: { chatbots: 1, knowledgeBases: 1, monthlyMessages: 200, teamMembers: 1, documentsPerKnowledgeBase: 5 } },
  });
  await ensureDefaultPlans(db);
  const kb = await createKnowledgeBase(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    name: "Files",
  });
  const uploaded = await addUploadedDocument(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    knowledgeBaseId: kb.id,
    filename: "shipping.txt",
    mimeType: "text/plain",
    bytes: Buffer.from("Standard shipping arrives in 4 business days."),
  });
  await processQueuedJobs(db);
  const fileDoc = await db.document.findUnique({ where: { id: uploaded.id } });
  assert.equal(fileDoc?.status, "READY");
  assert.match(fileDoc?.extractedText ?? "", /4 business days/);

  const urlDoc = await addUrlDocument(db, {
    organizationId: owner.organization.id,
    actorUserId: owner.user.id,
    knowledgeBaseId: kb.id,
    url: "https://example.com/help",
  });
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("sitemap")) {
      return new Response("<urlset><loc>https://example.com/help</loc></urlset>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    }
    return new Response("<html><title>Help</title><p>Gift cards never expire.</p></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
  await processDocument(db, urlDoc.id, fetchImpl);
  const crawled = await db.document.findUnique({ where: { id: urlDoc.id } });
  assert.equal(crawled?.status, "READY");
  assert.match(crawled?.extractedText ?? "", /Gift cards never expire/);
});

test("retrieval and playground citations stay inside the tenant", async () => {
  await resetDb(db);
  await ensureDefaultPlans(db);
  const alpha = await workspace("kb-rag-a@example.com", "Rag Alpha");
  const beta = await workspace("kb-rag-b@example.com", "Rag Beta");
  const kb = await createKnowledgeBase(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
    name: "Alpha facts",
  });
  await addPastedDocument(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
    knowledgeBaseId: kb.id,
    title: "Members desk",
    text: "Harbor members may use the quiet desk on the mezzanine after 08:30.",
  });
  await processQueuedJobs(db);
  const chatbot = await createChatbot(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
    name: "Alpha bot",
  });
  await setChatbotKnowledgeBases(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
    chatbotId: chatbot.id,
    knowledgeBaseIds: [kb.id],
  });
  const betaBot = await createChatbot(db, {
    organizationId: beta.organization.id,
    actorUserId: beta.user.id,
    name: "Beta bot",
  });

  const hits = await retrieveForChatbot(db, {
    organizationId: alpha.organization.id,
    chatbotId: chatbot.id,
    query: "Where is the quiet desk for members?",
  });
  assert.ok(hits.length >= 1);
  assert.match(hits[0]!.content, /quiet desk/);

  const leaked = await retrieveForChatbot(db, {
    organizationId: beta.organization.id,
    chatbotId: betaBot.id,
    query: "Where is the quiet desk for members?",
  });
  assert.equal(leaked.length, 0);

  await assert.rejects(
    () =>
      setChatbotKnowledgeBases(db, {
        organizationId: beta.organization.id,
        actorUserId: beta.user.id,
        chatbotId: betaBot.id,
        knowledgeBaseIds: [kb.id],
      }),
    /do not belong/,
  );

  const events: Array<Record<string, unknown>> = [];
  for await (const event of playChatbot(db, {
    organizationId: alpha.organization.id,
    actorUserId: alpha.user.id,
    chatbotId: chatbot.id,
    message: "Where can members sit quietly?",
  })) {
    events.push(event as unknown as Record<string, unknown>);
  }
  const citations = events.find((event) => event.type === "citations")?.citations as Array<{ title: string }> | undefined;
  assert.ok(citations?.length);
  const text = events.filter((event) => event.type === "delta").map((event) => String(event.text)).join("");
  assert.match(text, /knowledge base|quiet desk|mezzanine/i);
});
