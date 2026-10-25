"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/session";
import {
  addPastedDocument,
  addUrlDocument,
  deleteDocument,
  retryDocument,
} from "@/lib/knowledge/ingest";
import { processQueuedJobs, scheduleJobProcessing } from "@/lib/knowledge/process";
import {
  KnowledgeError,
  createKnowledgeBase,
  deleteKnowledgeBase,
  setChatbotKnowledgeBases,
  updateKnowledgeBase,
} from "@/lib/knowledge/service";
import { prisma } from "@/lib/db";
import { OrgError } from "@/lib/org/service";
import {
  knowledgeBaseSchema,
  pastedDocumentSchema,
  urlDocumentSchema,
  type FormState,
} from "@/lib/validators";

function fieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value?.length) result[key] = value;
  }
  return result;
}

function asState(error: unknown): FormState {
  if (error instanceof KnowledgeError || error instanceof OrgError) return { message: error.message };
  throw error;
}

export async function createKnowledgeBaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = knowledgeBaseSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    const kb = await createKnowledgeBase(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      ...parsed.data,
    });
    redirect(`/knowledge/${kb.id}`);
  } catch (error) {
    return asState(error);
  }
}

export async function updateKnowledgeBaseAction(
  knowledgeBaseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = knowledgeBaseSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    await updateKnowledgeBase(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      knowledgeBaseId,
      ...parsed.data,
    });
  } catch (error) {
    return asState(error);
  }
  revalidatePath(`/knowledge/${knowledgeBaseId}`);
  revalidatePath("/knowledge");
  return { ok: true, message: "Knowledge base saved." };
}

export async function deleteKnowledgeBaseAction(knowledgeBaseId: string) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  await deleteKnowledgeBase(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    knowledgeBaseId,
  });
  redirect("/knowledge");
}

export async function addPastedDocumentAction(
  knowledgeBaseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = pastedDocumentSchema.safeParse({
    title: formData.get("title"),
    text: formData.get("text"),
    faq: formData.get("faq") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Check the pasted text." };
  try {
    await addPastedDocument(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      knowledgeBaseId,
      title: parsed.data.title,
      text: parsed.data.text,
      faq: parsed.data.faq === "on",
    });
    await processQueuedJobs(prisma);
  } catch (error) {
    return asState(error);
  }
  revalidatePath(`/knowledge/${knowledgeBaseId}`);
  return { ok: true, message: "Document queued and processed." };
}

export async function addUrlDocumentAction(
  knowledgeBaseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = urlDocumentSchema.safeParse({
    url: formData.get("url"),
    sitemap: formData.get("sitemap") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Enter a public http(s) URL." };
  try {
    await addUrlDocument(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      knowledgeBaseId,
      url: parsed.data.url,
      sitemap: parsed.data.sitemap === "on",
    });
    scheduleJobProcessing(prisma);
  } catch (error) {
    return asState(error);
  }
  revalidatePath(`/knowledge/${knowledgeBaseId}`);
  return { ok: true, message: "URL accepted. Ingestion is running in the background." };
}

export async function retryDocumentAction(knowledgeBaseId: string, documentId: string) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  await retryDocument(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    documentId,
  });
  await processQueuedJobs(prisma);
  revalidatePath(`/knowledge/${knowledgeBaseId}`);
}

export async function deleteDocumentAction(knowledgeBaseId: string, documentId: string) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  await deleteDocument(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    documentId,
  });
  revalidatePath(`/knowledge/${knowledgeBaseId}`);
}

export async function setChatbotKnowledgeAction(chatbotId: string, formData: FormData) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const knowledgeBaseIds = formData.getAll("knowledgeBaseIds").map(String).filter(Boolean);
  await setChatbotKnowledgeBases(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    chatbotId,
    knowledgeBaseIds,
  });
  revalidatePath(`/chatbots/${chatbotId}`);
  revalidatePath("/knowledge");
}
