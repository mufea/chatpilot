"use server";

import { OrganizationRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteOrganizationProviderKey,
  saveOrganizationProviderKey,
} from "@/lib/ai/credentials";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OrgError, requireMembership } from "@/lib/org/service";
import { providerIdSchema, providerKeySchema, type FormState } from "@/lib/validators";

function fieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value?.length) result[key] = value;
  }
  return result;
}

export async function saveProviderKeyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = providerKeySchema.safeParse({
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Enter a valid API key." };

  try {
    await requireMembership(prisma, auth.user.id, auth.activeOrganization.id, OrganizationRole.ADMIN);
    await saveOrganizationProviderKey(
      prisma,
      auth.activeOrganization.id,
      parsed.data.provider,
      parsed.data.apiKey,
    );
  } catch (error) {
    if (error instanceof OrgError) return { message: error.message };
    if (error instanceof Error) return { message: error.message };
    throw error;
  }
  revalidatePath("/settings/providers");
  return { ok: true, message: `${parsed.data.provider} key saved. The secret is not shown again.` };
}

export async function removeProviderKeyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = providerIdSchema.safeParse({ provider: formData.get("provider") });
  if (!parsed.success) return { message: "Unknown provider." };

  try {
    await requireMembership(prisma, auth.user.id, auth.activeOrganization.id, OrganizationRole.ADMIN);
    await deleteOrganizationProviderKey(prisma, auth.activeOrganization.id, parsed.data.provider);
  } catch (error) {
    if (error instanceof OrgError) return { message: error.message };
    throw error;
  }
  revalidatePath("/settings/providers");
  return { ok: true, message: `${parsed.data.provider} customer key removed.` };
}
