"use server";

import { OrganizationRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  acceptInvitation,
  createOrganization,
  inviteMember,
  OrgError,
  removeMember,
  renameOrganization,
  updateMemberRole,
} from "@/lib/org/service";
import {
  acceptInviteSchema,
  invitationSchema,
  organizationSchema,
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

export async function createOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  const parsed = organizationSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const organization = await createOrganization(prisma, {
    name: parsed.data.name,
    ownerUserId: auth.user.id,
  });
  await prisma.session.updateMany({
    where: { userId: auth.user.id },
    data: { activeOrganizationId: organization.id },
  });
  redirect("/settings/organization");
}

export async function switchOrganizationAction(organizationId: string) {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  const allowed = auth.memberships.some((item) => item.organizationId === organizationId);
  if (!allowed) {
    throw new Error("You are not a member of that organization.");
  }
  await prisma.session.updateMany({
    where: { userId: auth.user.id },
    data: { activeOrganizationId: organizationId },
  });
  redirect("/dashboard");
}

export async function renameOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = organizationSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    await renameOrganization(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      name: parsed.data.name,
    });
  } catch (error) {
    if (error instanceof OrgError) return { message: error.message };
    throw error;
  }
  return { ok: true, message: "Workspace name updated." };
}

export async function inviteMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  const parsed = invitationSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    await inviteMember(prisma, {
      organizationId: auth.activeOrganization.id,
      actorUserId: auth.user.id,
      email: parsed.data.email,
      role: parsed.data.role as OrganizationRole,
    });
  } catch (error) {
    if (error instanceof OrgError) return { message: error.message };
    throw error;
  }
  return { ok: true, message: "Invitation sent." };
}

export async function updateMemberRoleAction(memberId: string, role: OrganizationRole) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  await updateMemberRole(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    memberId,
    role,
  });
}

export async function removeMemberAction(memberId: string) {
  const auth = await getCurrentAuth();
  if (!auth?.activeOrganization) redirect("/sign-in");
  await removeMember(prisma, {
    organizationId: auth.activeOrganization.id,
    actorUserId: auth.user.id,
    memberId,
  });
}

export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  const parsed = acceptInviteSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    const organization = await acceptInvitation(prisma, {
      token: parsed.data.token,
      userId: auth.user.id,
      userEmail: auth.user.email,
    });
    await prisma.session.updateMany({
      where: { userId: auth.user.id },
      data: { activeOrganizationId: organization.id },
    });
  } catch (error) {
    if (error instanceof OrgError) return { message: error.message };
    throw error;
  }
  redirect("/dashboard");
}
