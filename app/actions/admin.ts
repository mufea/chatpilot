"use server";

import { PlatformRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { setUserPlatformRole } from "@/lib/admin/service";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function setPlatformRoleAction(userId: string, role: PlatformRole) {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  await setUserPlatformRole(prisma, {
    actorUserId: auth.user.id,
    actorRole: auth.user.platformRole,
    userId,
    role,
  });
}
