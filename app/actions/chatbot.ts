"use server";

import { ChatbotStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/session";
import {
  ChatbotError,
  createChatbot,
  deleteChatbot,
  duplicateChatbot,
  setChatbotStatus,
  updateChatbot,
} from "@/lib/chatbot/service";
import { prisma } from "@/lib/db";
import { OrgError } from "@/lib/org/service";
import { chatbotConfigSchema, createChatbotSchema, type FormState } from "@/lib/validators";

function fieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value?.length) result[key] = value;
  }
  return result;
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createChatbotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = createChatbotSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    const chatbot = await createChatbot(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      ...parsed.data,
    });
    redirect(`/chatbots/${chatbot.id}`);
  } catch (error) {
    if (error instanceof ChatbotError || error instanceof OrgError) return { message: error.message };
    throw error;
  }
}

export async function updateChatbotAction(
  chatbotId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = chatbotConfigSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    avatarUrl: formData.get("avatarUrl") || "",
    brandColor: formData.get("brandColor"),
    welcomeMessage: formData.get("welcomeMessage"),
    systemInstructions: formData.get("systemInstructions") ?? "",
    persona: formData.get("persona") || undefined,
    languages: formData.get("languages"),
    provider: formData.get("provider"),
    model: formData.get("model"),
    temperature: formData.get("temperature"),
    maxResponseTokens: formData.get("maxResponseTokens"),
    historyLimit: formData.get("historyLimit"),
    fallbackMessage: formData.get("fallbackMessage"),
    suggestedQuestions: formData.get("suggestedQuestions") ?? "",
    conversationLimit: formData.get("conversationLimit") || undefined,
    collectLeads: formData.get("collectLeads") || undefined,
    humanHandoffEnabled: formData.get("humanHandoffEnabled") || undefined,
    handoffMessage: formData.get("handoffMessage") || undefined,
    allowedDomains: formData.get("allowedDomains") ?? "",
    showSources: formData.get("showSources") || undefined,
    fallbackEnabled: formData.get("fallbackEnabled") || undefined,
    fallbackProvider: formData.get("fallbackProvider") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const conversationLimit = parsed.data.conversationLimit
    ? Number(parsed.data.conversationLimit)
    : null;

  try {
    await updateChatbot(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      chatbotId,
      data: {
        ...parsed.data,
        avatarUrl: parsed.data.avatarUrl || null,
        languages: splitLines(parsed.data.languages),
        suggestedQuestions: splitLines(parsed.data.suggestedQuestions),
        allowedDomains: splitLines(parsed.data.allowedDomains),
        conversationLimit: Number.isFinite(conversationLimit) ? conversationLimit : null,
        collectLeads: parsed.data.collectLeads === "on",
        humanHandoffEnabled: parsed.data.humanHandoffEnabled === "on",
        showSources: parsed.data.showSources === "on",
        fallbackEnabled: parsed.data.fallbackEnabled === "on",
        fallbackProvider: parsed.data.fallbackProvider || null,
      },
    });
  } catch (error) {
    if (error instanceof ChatbotError || error instanceof OrgError) return { message: error.message };
    throw error;
  }
  revalidatePath(`/chatbots/${chatbotId}`);
  revalidatePath("/chatbots");
  return { ok: true, message: "Chatbot saved." };
}

export async function publishChatbotAction(chatbotId: string, next: ChatbotStatus) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  await setChatbotStatus(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    chatbotId,
    status: next,
    emailVerified: Boolean(auth.user.emailVerifiedAt),
  });
  revalidatePath("/chatbots");
  revalidatePath(`/chatbots/${chatbotId}`);
}

export async function duplicateChatbotAction(chatbotId: string) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const copy = await duplicateChatbot(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    chatbotId,
  });
  redirect(`/chatbots/${copy.id}`);
}

export async function deleteChatbotAction(chatbotId: string) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  await deleteChatbot(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    chatbotId,
  });
  redirect("/chatbots");
}
